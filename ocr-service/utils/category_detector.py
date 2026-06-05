KEYWORD_CATEGORY_MAP = {
    "milk": "Dairy",
    "curd": "Dairy",
    "yogurt": "Dairy",
    "yoghurt": "Dairy",
    "cheese": "Dairy",
    "butter": "Dairy",
    "bread": "Bakery",
    "bun": "Bakery",
    "cake": "Bakery",
    "chips": "Snacks",
    "biscuit": "Snacks",
    "cookie": "Snacks",
    "namkeen": "Snacks",
    "juice": "Beverages",
    "cola": "Beverages",
    "soda": "Beverages",
    "water": "Beverages",
    "tea": "Beverages",
    "coffee": "Beverages",
}


def detect_category(text: str | None) -> str:
    normalized = (text or "").lower()

    for keyword, category in KEYWORD_CATEGORY_MAP.items():
        if keyword in normalized:
            return category

    return "General"
