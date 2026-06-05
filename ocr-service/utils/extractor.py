from functools import lru_cache
from pathlib import Path
import re

import cv2
import easyocr
import numpy as np
from PIL import Image


IGNORED_NAME_TERMS = {
    "mrp",
    "batch",
    "lot",
    "mfg",
    "manufactured",
    "manufacture",
    "exp",
    "expiry",
    "expires",
    "pkd",
    "packed",
    "best before",
    "use by",
    "net wt",
    "net weight",
    "price",
}

DATE_LIKE_RE = re.compile(
    r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|"
    r"\d{1,2}\s+[a-z]{3,9}\s+\d{2,4}|[a-z]{3,9}\s+\d{1,2}\s+\d{2,4})\b",
    re.IGNORECASE,
)


@lru_cache(maxsize=1)
def get_reader():
    return easyocr.Reader(["en"], gpu=False)


def preprocess_image(image_path: Path) -> np.ndarray:
    image = cv2.imread(str(image_path))

    if image is None:
        pil_image = Image.open(image_path).convert("RGB")
        image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, None, h=10, templateWindowSize=7, searchWindowSize=21)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)

    return enhanced


def _box_area(box) -> float:
    points = np.array(box, dtype=np.float32)
    return float(cv2.contourArea(points))


def run_ocr(image_path: Path) -> list[dict]:
    processed_image = preprocess_image(image_path)
    results = get_reader().readtext(processed_image, detail=1, paragraph=False)

    blocks = []
    for box, text, confidence in results:
        clean_text = " ".join(str(text).split())
        if not clean_text:
            continue

        blocks.append(
            {
                "text": clean_text,
                "confidence": float(confidence or 0),
                "area": _box_area(box),
                "box": box,
            }
        )

    return blocks


def _is_product_name_candidate(text: str) -> bool:
    normalized = text.strip().lower()

    if len(normalized) < 3:
        return False

    if DATE_LIKE_RE.search(normalized):
        return False

    return not any(term in normalized for term in IGNORED_NAME_TERMS)


def extract_product_name(ocr_blocks: list[dict]) -> str | None:
    candidates = [block for block in ocr_blocks if _is_product_name_candidate(block["text"])]

    if not candidates:
        return None

    best = max(candidates, key=lambda block: block["area"] * max(block["confidence"], 0.1))
    return best["text"]


def average_confidence(ocr_blocks: list[dict]) -> float:
    if not ocr_blocks:
        return 0.0

    score = sum(block["confidence"] for block in ocr_blocks) / len(ocr_blocks)
    return round(max(0.0, min(score, 1.0)), 2)
