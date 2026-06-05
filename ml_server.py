"""
EXPIRA ML Server — run with: python ml_server.py
Exposes your 3 ML modules as a REST API on port 5001
"""
from dotenv import load_dotenv
load_dotenv()  
from flask import Flask, request, jsonify
from flask_cors import CORS
from ocr_engine import extract_expiry_from_image
from classifier import classify_product, get_classification_details
from remainder_scheduler import check_reminders_for_user
import os

app = Flask(__name__)
CORS(app)  # allows Sanu's Node.js to call this server

# ── ENDPOINT 1: OCR scan ─────────────────────────────────────
@app.route("/ml/scan", methods=["POST"])
def scan_product():
    """
    Sanu's backend sends an image here.
    We run OCR and return the expiry date + category.
    """
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400

    image_file = request.files["image"]
    image_bytes = image_file.read()

    # Step 1: Extract expiry date using OCR
    ocr_result = extract_expiry_from_image(image_bytes)

    # Step 2: Classify product category
    if ocr_result.get("product_name"):
        category = classify_product(ocr_result["product_name"])
        ocr_result["category"] = category
    else:
        ocr_result["category"] = "grocery"  # default

    return jsonify(ocr_result)


# ── ENDPOINT 2: Run reminder check ──────────────────────────
@app.route("/ml/reminders", methods=["POST"])
def trigger_reminders():
    """
    Sanu's backend calls this to trigger email alerts.
    Body: { "products": [...], "user_email": "...", "user_name": "..." }
    """
    data = request.json
    products  = data.get("products", [])
    email     = data.get("user_email")
    name      = data.get("user_name", "User")

    result = check_reminders_for_user(email, name, products)
    return jsonify(result)


# ── ENDPOINT 3: Classify only (no image needed) ─────────────
@app.route("/ml/classify", methods=["POST"])
def classify():
    """
    Classify a product by its name text only.
    Body: { "name": "Paracetamol 500mg" }
    """
    name = request.json.get("name", "")
    details = get_classification_details(name)
    return jsonify(details)


if __name__ == "__main__":
    print("EXPIRA ML Server running on http://localhost:5001")
    app.run(port=5001, debug=True)