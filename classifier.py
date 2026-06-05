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

# ─── TRAINING DATA ───────────────────────────────────────────────────────────

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


# ─── MODEL TRAINING ──────────────────────────────────────────────────────────

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
            ngram_range=(1, 2),       # Unigrams + bigrams
            min_df=1,
            max_features=500,
            sublinear_tf=True,        # Apply log normalization
        )),
        ("clf", LogisticRegression(
            max_iter=1000,
            C=1.0,                    # Regularization strength
            multi_class="multinomial",
            solver="lbfgs",
        )),
    ])

    pipeline.fit(X, y)

    # Quick validation
    scores = cross_val_score(pipeline, X, y, cv=3, scoring="accuracy")
    logger.info(f"Classifier CV accuracy: {scores.mean():.2f} ± {scores.std():.2f}")

    return pipeline


# ─── SINGLETON CLASSIFIER ────────────────────────────────────────────────────

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


# ─── CLI TEST ────────────────────────────────────────────────────────────────

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