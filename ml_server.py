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

EXPIRY_KEYWORDS = [
    "exp", "expiry", "expiry date", "expires", "use by", "use before",
    "best before", "bb", "best by", "sell by", "bbf", "exp date",
    "exp.", "exp:", "best before end", "bbe",
]


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """
    Enhance image for better OCR accuracy.
    Pipeline: grayscale → denoise → sharpen → threshold → resize
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    denoised = cv2.fastNlMeansDenoising(gray, h=10)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)

    kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
    sharpened = cv2.filter2D(enhanced, -1, kernel)

    thresh = cv2.adaptiveThreshold(
        sharpened, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )

    h, w = thresh.shape
    if w < 800:
        scale = 800 / w
        thresh = cv2.resize(thresh, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    return thresh


def extract_text_with_tesseract(image_bytes: bytes) -> str:
    """Run Tesseract OCR on preprocessed image."""
    processed = preprocess_image(image_bytes)
    pil_img = Image.fromarray(processed)

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

    priority_lines = []
    for line in lines:
        for kw in EXPIRY_KEYWORDS:
            if kw.upper() in line:
                priority_lines.append(line)
                break

    search_corpus = " ".join(priority_lines) if priority_lines else text_upper

    for pattern, fmt in DATE_PATTERNS:
        matches = re.findall(pattern, search_corpus, re.IGNORECASE)
        if matches:
            raw = matches[0] if isinstance(matches[0], str) else " ".join(matches[0])
            try:
                if "/" in fmt and fmt.count("/") == 2:
                    parsed = datetime.strptime("/".join(matches[0]), fmt.replace("%d/%m/%Y", "").strip() or fmt)
                else:
                    joined = " ".join(str(m) for m in matches[0]) if isinstance(matches[0], tuple) else raw
                    parsed = datetime.strptime(joined, fmt)

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

    years = re.findall(r"\b(202[5-9]|203\d)\b", search_corpus)
    if years:
        return {
            "raw_date": f"Year {years[0]} found",
            "expiry_date": f"{years[0]}-12-31",
            "confidence": "low",
        }

    return None


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

    try:
        raw_text = extract_text_with_tesseract(image_bytes)
        result["ocr_text"] = raw_text
        logger.info(f"Tesseract OCR output: {raw_text[:200]}")

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
        fallback = (datetime.utcnow() + timedelta(days=30)).date().isoformat()
        result.update({
            "expiry_date": fallback,
            "notes": "Could not read label automatically. Please verify manually.",
            "confidence": "low",
            "method": "fallback",
        })

    return result

"""
EXPIRA - Product Classifier
Uses TF-IDF + Logistic Regression to categorize products
into: grocery, medicine, personal_care

This is a lightweight, interpretable ML approach that trains
instantly on startup — no external model files needed.
"""

import re
import logging
from typing import Literal

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import cross_val_score

logger = logging.getLogger(__name__)

TRAINING_DATA = [
    # --- MEDICINE ---
    ("paracetamol 500mg tablet",        "medicine"),
    ("amoxicillin capsule 250mg",       "medicine"),
    ("ibuprofen syrup 100ml",           "medicine"),
    ("vitamin c supplement 1000mg",     "medicine"),
    ("omeprazole capsule",              "medicine"),
    ("dolo 650 tablet",                 "medicine"),
    ("azithromycin 500",                "medicine"),
    ("cetirizine antihistamine",        "medicine"),
    ("insulin injection pen",           "medicine"),
    ("metformin 500 mg",                "medicine"),
    ("cough syrup 100ml",               "medicine"),
    ("calcium carbonate supplement",    "medicine"),
    ("zinc tablet 50mg",                "medicine"),
    ("iron folic acid tablet",          "medicine"),
    ("multivitamin capsule daily",      "medicine"),
    ("eye drops solution 10ml",         "medicine"),
    ("nasal spray 15ml",               "medicine"),
    ("antacid tablet mint",             "medicine"),
    ("antiseptic cream 30g",            "medicine"),
    ("pain relief patch",               "medicine"),

    # --- GROCERY ---
    ("whole wheat bread loaf",          "grocery"),
    ("organic full cream milk 1l",      "grocery"),
    ("greek yogurt 400g",               "grocery"),
    ("cheddar cheese block",            "grocery"),
    ("chicken breast pack 500g",        "grocery"),
    ("eggs dozen free range",           "grocery"),
    ("orange juice carton 1l",          "grocery"),
    ("tomato ketchup sauce",            "grocery"),
    ("basmati rice 5kg bag",            "grocery"),
    ("olive oil extra virgin",          "grocery"),
    ("potato chips snack 150g",         "grocery"),
    ("dark chocolate bar 70%",          "grocery"),
    ("almond butter jar",               "grocery"),
    ("green tea bags 50 pack",          "grocery"),
    ("pasta spaghetti 500g",            "grocery"),
    ("breakfast cereal corn flakes",    "grocery"),
    ("coconut water 250ml",             "grocery"),
    ("salted butter 200g",              "grocery"),
    ("mixed nuts trail",               "grocery"),
    ("apple cider vinegar 500ml",       "grocery"),

    # --- PERSONAL CARE ---
    ("face wash foam cleanser 100ml",   "personal_care"),
    ("moisturizer spf 50 sunscreen",    "personal_care"),
    ("shampoo anti dandruff 400ml",     "personal_care"),
    ("conditioner hair repair",         "personal_care"),
    ("body lotion aloe vera 200ml",     "personal_care"),
    ("deodorant roll on 50ml",          "personal_care"),
    ("toothpaste whitening 100g",       "personal_care"),
    ("lip balm spf 15",                 "personal_care"),
    ("hand cream moisturiser",          "personal_care"),
    ("nail polish remover acetone",     "personal_care"),
    ("face serum vitamin c",            "personal_care"),
    ("hair oil coconut",                "personal_care"),
    ("perfume eau de toilette 50ml",    "personal_care"),
    ("bath soap bar 100g",              "personal_care"),
    ("mouthwash antiseptic 250ml",      "personal_care"),
    ("eye cream under eye dark circle", "personal_care"),
    ("toner face witch hazel",          "personal_care"),
    ("makeup remover wipes",            "personal_care"),
    ("beard oil jojoba 30ml",           "personal_care"),
    ("face mask sheet brightening",     "personal_care"),
]



def clean_text(text: str) -> str:
    """Lowercase, remove special chars, normalize spaces."""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def build_and_train_classifier() -> Pipeline:
    """Train TF-IDF + Logistic Regression pipeline."""
    X = [clean_text(item[0]) for item in TRAINING_DATA]
    y = [item[1] for item in TRAINING_DATA]

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 2),     
            min_df=1,
            max_features=500,
            sublinear_tf=True,       
        )),
        ("clf", LogisticRegression(
            max_iter=1000,
            C=1.0,                   
            multi_class="multinomial",
            solver="lbfgs",
        )),
    ])

    pipeline.fit(X, y)

    scores = cross_val_score(pipeline, X, y, cv=3, scoring="accuracy")
    logger.info(f"Classifier CV accuracy: {scores.mean():.2f} ± {scores.std():.2f}")

    return pipeline



_classifier: Pipeline | None = None


def get_classifier() -> Pipeline:
    global _classifier
    if _classifier is None:
        logger.info("Training product classifier...")
        _classifier = build_and_train_classifier()
        logger.info("Classifier ready.")
    return _classifier


def classify_product(product_name: str) -> Literal["grocery", "medicine", "personal_care"]:
    """
    Classify a product by name.
    Returns: 'grocery' | 'medicine' | 'personal_care'
    """
    clf = get_classifier()
    cleaned = clean_text(product_name)
    prediction = clf.predict([cleaned])[0]
    proba = clf.predict_proba([cleaned])[0]
    confidence = round(float(max(proba)) * 100, 1)
    logger.info(f"Classified '{product_name}' as '{prediction}' ({confidence}% confidence)")
    return prediction


def get_classification_details(product_name: str) -> dict:
    """Return prediction + probabilities for all classes."""
    clf = get_classifier()
    cleaned = clean_text(product_name)
    classes = clf.classes_
    proba = clf.predict_proba([cleaned])[0]
    return {
        "prediction": clf.predict([cleaned])[0],
        "probabilities": {c: round(float(p) * 100, 1) for c, p in zip(classes, proba)},
    }


if __name__ == "__main__":
    test_products = [
        "Cough Syrup Cherry 100ml",
        "Whole Grain Oats 500g",
        "Anti-Aging Serum 30ml",
        "Augmentin 625",
        "Mango Juice 250ml",
        "Sunscreen SPF 50+",
    ]
    print("\nEXPIRA Product Classifier Demo\n" + "=" * 40)
    for prod in test_products:
        details = get_classification_details(prod)
        pred = details["prediction"]
        conf = details["probabilities"][pred]
        print(f"  {prod:<35} → {pred:<15} ({conf}%)")


"""
EXPIRA - Reminder Scheduler
Background job that checks expiry dates and sends alerts.

Uses:
  - APScheduler for background task scheduling
  - SMTP (smtplib) for email notifications
  - Twilio SDK for SMS (optional)
  - Flask-Mail as alternative email backend
"""

import logging
import smtplib
import os
from datetime import datetime, date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)


SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER", "your-email@gmail.com")
SMTP_PASS = os.getenv("SMTP_PASS", "your-app-password")
FROM_NAME = "EXPIRA Smart Tracker"


def get_status_color(days_left: int) -> str:
    if days_left < 0:
        return "#ef4444"  
    elif days_left <= 7:
        return "#f97316"   
    elif days_left <= 30:
        return "#eab308"  
    return "#22c55e"     


def build_email_html(user_name: str, items: List[dict]) -> str:
    """Build a styled HTML email for expiry reminders."""
    rows = ""
    for item in items:
        days = item["days_left"]
        color = get_status_color(days)
        label = "EXPIRED" if days < 0 else f"{days} days left"
        rows += f"""
        <tr>
          <td style="padding:12px;border-bottom:1px solid #1e1b4b;">{item['name']}</td>
          <td style="padding:12px;border-bottom:1px solid #1e1b4b;text-transform:capitalize">{item['category'].replace('_',' ')}</td>
          <td style="padding:12px;border-bottom:1px solid #1e1b4b;">{item['expiry_date']}</td>
          <td style="padding:12px;border-bottom:1px solid #1e1b4b;color:{color};font-weight:700">{label}</td>
        </tr>"""

    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="background:#06040f;margin:0;padding:20px;font-family:'Helvetica Neue',Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;">
        <div style="text-align:center;padding:30px 0 20px;">
          <h1 style="font-family:monospace;font-size:28px;background:linear-gradient(90deg,#a78bfa,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:0;">⏱ EXPIRA</h1>
          <p style="color:#64748b;font-size:13px;margin:4px 0 0;">Smart Expiry Intelligence</p>
        </div>

        <div style="background:#0f0a1e;border-radius:16px;border:1px solid #1e1b4b;padding:24px;margin-bottom:20px;">
          <h2 style="color:#e2e8f0;font-size:18px;margin:0 0 8px;">Hey {user_name} 👋</h2>
          <p style="color:#64748b;margin:0 0 20px;font-size:14px;">
            You have <strong style="color:#a78bfa">{len(items)} item(s)</strong> expiring soon. Here's your update:
          </p>

          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#1e1b4b;">
                <th style="padding:10px;text-align:left;color:#a78bfa;">Product</th>
                <th style="padding:10px;text-align:left;color:#a78bfa;">Category</th>
                <th style="padding:10px;text-align:left;color:#a78bfa;">Expiry</th>
                <th style="padding:10px;text-align:left;color:#a78bfa;">Status</th>
              </tr>
            </thead>
            <tbody style="color:#cbd5e1;">
              {rows}
            </tbody>
          </table>
        </div>

        <div style="text-align:center;color:#334155;font-size:12px;">
          You're receiving this because you enabled reminders in EXPIRA.<br>
          <a href="#" style="color:#4f46e5;">Manage notification settings</a>
        </div>
      </div>
    </body>
    </html>"""


def send_email_reminder(to_email: str, user_name: str, items: List[dict]):
    """Send HTML email reminder via SMTP."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"⏱ EXPIRA: {len(items)} item(s) expiring soon"
        msg["From"] = f"{FROM_NAME} <{SMTP_USER}>"
        msg["To"] = to_email

        html_body = build_email_html(user_name, items)
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, to_email, msg.as_string())

        logger.info(f"Email sent to {to_email} for {len(items)} expiring items")

    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")


def send_sms_reminder(phone: str, user_name: str, items: List[dict]):
    """
    Optional: Send SMS using Twilio.
    Requires: pip install twilio
    Set env vars: TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM
    """
    try:
        from twilio.rest import Client
        client = Client(os.getenv("TWILIO_SID"), os.getenv("TWILIO_TOKEN"))

        names = ", ".join(i["name"] for i in items[:3])
        if len(items) > 3:
            names += f" +{len(items)-3} more"

        body = f"⏱ EXPIRA Alert: {names} {'is' if len(items)==1 else 'are'} expiring soon. Check your dashboard!"
        client.messages.create(body=body, from_=os.getenv("TWILIO_FROM"), to=phone)
        logger.info(f"SMS sent to {phone}")

    except ImportError:
        logger.warning("Twilio not installed. Skipping SMS.")
    except Exception as e:
        logger.error(f"SMS failed to {phone}: {e}")



def check_and_send_reminders(app):
    """
    Daily job:
      1. Query all products expiring in ≤30 days
      2. Group by user
      3. Send email (and SMS if configured)
      4. Mark reminder_sent flags to avoid duplicates
    """
    from database import db, User, Product

    with app.app_context():
        today = date.today()
        users = User.query.all()

        for user in users:
            products = Product.query.filter_by(user_id=user.id).all()
            alert_items = []

            for p in products:
                days_left = (p.expiry_date - today).days

                # 7-day critical alert
                if 0 <= days_left <= 7 and not p.reminder_sent_7:
                    alert_items.append({**p.to_dict(), "days_left": days_left})
                    p.reminder_sent_7 = True

                # 30-day early warning
                elif 7 < days_left <= 30 and not p.reminder_sent_30:
                    alert_items.append({**p.to_dict(), "days_left": days_left})
                    p.reminder_sent_30 = True

            if alert_items:
                send_email_reminder(user.email, user.name, alert_items)
                logger.info(f"Reminders sent to {user.email}: {len(alert_items)} items")

        db.session.commit()
        logger.info(f"Reminder job complete at {datetime.utcnow().isoformat()}")


def start_scheduler(app):
    """Initialize and start the background scheduler."""
    scheduler = BackgroundScheduler(timezone="Asia/Kolkata")

    # Run daily at 8:00 AM IST
    scheduler.add_job(
        func=lambda: check_and_send_reminders(app),
        trigger=CronTrigger(hour=8, minute=0),
        id="daily_reminder",
        name="Daily Expiry Reminder",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Reminder scheduler started — runs daily at 08:00 IST")
    return scheduler

def check_reminders_for_user(email: str, name: str, products: list) -> dict:
    """
    Called directly by ml_server.py
    products = list of dicts: [{name, expiry_date, category, days_left}, ...]
    """
    from datetime import date, datetime

    alert_items = []
    for p in products:
        days = p.get("days_left", 999)
        if days <= 30:
            alert_items.append(p)

    if alert_items:
        send_email_reminder(email, name, alert_items)
        return {"sent": True, "alert_count": len(alert_items)}

    return {"sent": False, "alert_count": 0}