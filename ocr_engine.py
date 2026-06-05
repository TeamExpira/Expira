"""
EXPIRA - OCR Engine
Extracts expiry dates from product label images using:
  1. pytesseract (Tesseract OCR) for text extraction
  2. OpenCV for image preprocessing
  3. Regex patterns for date detection
  4. Anthropic Claude Vision API as fallback
"""

import re
import io
import base64
import logging
from datetime import datetime, timedelta
from typing import Optional

import cv2
import numpy as np
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import anthropic

logger = logging.getLogger(__name__)

# ─── DATE PATTERNS ───────────────────────────────────────────────────────────

DATE_PATTERNS = [
    # DD/MM/YYYY or DD-MM-YYYY
    (r"\b(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})\b", "%d/%m/%Y"),
    # MM/YYYY or MM-YYYY
    (r"\b(\d{2})[\/\-](\d{4})\b", "%m/%Y"),
    # DD MON YYYY  e.g. 13 JUN 2026
    (r"\b(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})\b", "%d %b %Y"),
    # MON YYYY  e.g. JUN 2026
    (r"\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})\b", "%b %Y"),
    # YYYY-MM-DD (ISO)
    (r"\b(\d{4})[\/\-](\d{2})[\/\-](\d{2})\b", "%Y-%m-%d"),
    # YYYY/MM
    (r"\b(\d{4})[\/\-](\d{2})\b", "%Y/%m"),
]

# Keywords that usually precede an expiry date on labels
EXPIRY_KEYWORDS = [
    "exp", "expiry", "expiry date", "expires", "use by", "use before",
    "best before", "bb", "best by", "sell by", "bbf", "exp date",
    "exp.", "exp:", "best before end", "bbe",
]


# ─── IMAGE PREPROCESSING ─────────────────────────────────────────────────────

def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """
    Enhance image for better OCR accuracy.
    Pipeline: grayscale → denoise → sharpen → threshold → resize
    """
    # Decode bytes to numpy array
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Denoise
    denoised = cv2.fastNlMeansDenoising(gray, h=10)

    # Increase contrast (CLAHE)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)

    # Sharpen using kernel
    kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
    sharpened = cv2.filter2D(enhanced, -1, kernel)

    # Adaptive thresholding (handles uneven lighting)
    thresh = cv2.adaptiveThreshold(
        sharpened, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )

    # Upscale if too small (OCR works better on larger images)
    h, w = thresh.shape
    if w < 800:
        scale = 800 / w
        thresh = cv2.resize(thresh, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    return thresh


def extract_text_with_tesseract(image_bytes: bytes) -> str:
    """Run Tesseract OCR on preprocessed image."""
    processed = preprocess_image(image_bytes)
    pil_img = Image.fromarray(processed)

    # Config: treat as single uniform block of text
    custom_config = r"--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./-: "
    text = pytesseract.image_to_string(pil_img, config=custom_config)
    return text.strip()


# ─── DATE PARSING ────────────────────────────────────────────────────────────

def find_expiry_in_text(text: str) -> Optional[dict]:
    """
    Search OCR text for expiry date.
    Returns dict with {raw_text, parsed_date, confidence} or None.
    """
    text_upper = text.upper()
    lines = text_upper.splitlines()

    # Priority: look for lines containing expiry keywords first
    priority_lines = []
    for line in lines:
        for kw in EXPIRY_KEYWORDS:
            if kw.upper() in line:
                priority_lines.append(line)
                break

    search_corpus = " ".join(priority_lines) if priority_lines else text_upper

    # Try each date pattern
    for pattern, fmt in DATE_PATTERNS:
        matches = re.findall(pattern, search_corpus, re.IGNORECASE)
        if matches:
            raw = matches[0] if isinstance(matches[0], str) else " ".join(matches[0])
            try:
                # Reconstruct date string from groups
                if "/" in fmt and fmt.count("/") == 2:
                    parsed = datetime.strptime("/".join(matches[0]), fmt.replace("%d/%m/%Y", "").strip() or fmt)
                else:
                    joined = " ".join(str(m) for m in matches[0]) if isinstance(matches[0], tuple) else raw
                    parsed = datetime.strptime(joined, fmt)

                # Sanity: date should be in future (or recent past)
                if parsed.year < 2020 or parsed.year > 2035:
                    continue

                confidence = "high" if priority_lines else "medium"
                return {
                    "raw_date": raw,
                    "expiry_date": parsed.date().isoformat(),
                    "confidence": confidence,
                }
            except ValueError:
                continue

    # Fallback: extract any 4-digit year that looks like a future date
    years = re.findall(r"\b(202[5-9]|203\d)\b", search_corpus)
    if years:
        return {
            "raw_date": f"Year {years[0]} found",
            "expiry_date": f"{years[0]}-12-31",
            "confidence": "low",
        }

    return None


# ─── CLAUDE VISION FALLBACK ──────────────────────────────────────────────────

def extract_with_claude_vision(image_bytes: bytes, media_type: str = "image/jpeg") -> dict:
    """
    Use Anthropic Claude Vision API as a fallback when Tesseract fails.
    Costs API tokens but much more accurate on complex labels.
    """
    client = anthropic.Anthropic()
    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": """Extract from this product label:
1. Product name
2. Expiry date (format: YYYY-MM-DD)
3. Category: grocery / medicine / personal_care

Reply ONLY with JSON: {"name":"...","expiry":"YYYY-MM-DD","category":"...","raw_date":"...","confidence":"high/medium/low"}"""}
            ]
        }]
    )

    import json
    text = message.content[0].text.strip()
    text = re.sub(r"```json|```", "", text).strip()
    return json.loads(text)


# ─── MAIN ENTRY POINT ────────────────────────────────────────────────────────

def extract_expiry_from_image(image_bytes: bytes, media_type: str = "image/jpeg") -> dict:
    """
    Main OCR pipeline:
      1. Preprocess image
      2. Run Tesseract OCR
      3. Parse dates with regex
      4. Fall back to Claude Vision if needed
    """
    result = {
        "success": False,
        "product_name": None,
        "expiry_date": None,
        "raw_date": None,
        "confidence": "low",
        "ocr_text": "",
        "method": "tesseract",
        "notes": "",
    }

    # Step 1: Tesseract OCR
    try:
        raw_text = extract_text_with_tesseract(image_bytes)
        result["ocr_text"] = raw_text
        logger.info(f"Tesseract OCR output: {raw_text[:200]}")

        # Step 2: Parse dates
        date_result = find_expiry_in_text(raw_text)
        if date_result:
            result.update({
                "success": True,
                "expiry_date": date_result["expiry_date"],
                "raw_date": date_result["raw_date"],
                "confidence": date_result["confidence"],
                "method": "tesseract+regex",
            })
            return result

    except Exception as e:
        logger.warning(f"Tesseract failed: {e}")

    # Step 3: Claude Vision fallback
    try:
        logger.info("Falling back to Claude Vision API")
        claude_result = extract_with_claude_vision(image_bytes, media_type)
        result.update({
            "success": True,
            "product_name": claude_result.get("name"),
            "expiry_date": claude_result.get("expiry"),
            "raw_date": claude_result.get("raw_date"),
            "confidence": claude_result.get("confidence", "medium"),
            "method": "claude_vision",
        })
    except Exception as e:
        logger.error(f"Claude Vision also failed: {e}")
        # Last resort: 30-day default
        fallback = (datetime.utcnow() + timedelta(days=30)).date().isoformat()
        result.update({
            "expiry_date": fallback,
            "notes": "Could not read label automatically. Please verify manually.",
            "confidence": "low",
            "method": "fallback",
        })

    return result