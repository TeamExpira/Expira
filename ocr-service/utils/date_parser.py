from datetime import date
import re

from dateutil.parser import parse
from dateutil.relativedelta import relativedelta


MONTHS = (
    "jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|"
    "aug|august|sep|sept|september|oct|october|nov|november|dec|december"
)

EXPIRY_DATE_PATTERNS = [
    re.compile(r"\b(?:exp|expiry|expires|use by|best before)[:\s-]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b", re.I),
    re.compile(rf"\b(?:exp|expiry|expires|use by|best before)[:\s-]*(\d{{1,2}}\s+(?:{MONTHS})\.?,?\s+\d{{2,4}})\b", re.I),
    re.compile(rf"\b(?:exp|expiry|expires|use by|best before)[:\s-]*((?:{MONTHS})\.?\s+\d{{1,2}},?\s+\d{{2,4}})\b", re.I),
]

GENERIC_DATE_PATTERNS = [
    re.compile(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b", re.I),
    re.compile(r"\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b", re.I),
    re.compile(rf"\b(\d{{1,2}}\s+(?:{MONTHS})\.?,?\s+\d{{2,4}})\b", re.I),
    re.compile(rf"\b((?:{MONTHS})\.?\s+\d{{1,2}},?\s+\d{{2,4}})\b", re.I),
]

RELATIVE_BEST_BEFORE_RE = re.compile(
    r"\bbest\s+before[:\s-]*(\d{1,2})\s*(day|days|month|months|year|years)\b",
    re.I,
)

REFERENCE_DATE_RE = re.compile(
    r"\b(?:mfg|mfd|manufactured|pkd|packed)[:\s-]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b",
    re.I,
)


def _parse_date(raw_value: str):
    try:
        cleaned_value = raw_value.strip()
        yearfirst = bool(re.match(r"^\d{4}[/-]\d{1,2}[/-]\d{1,2}$", cleaned_value))
        parsed = parse(cleaned_value, dayfirst=not yearfirst, yearfirst=yearfirst, fuzzy=True)
        return parsed.date()
    except (TypeError, ValueError, OverflowError):
        return None


def _to_iso(parsed_date: date | None) -> str | None:
    return parsed_date.isoformat() if parsed_date else None


def _extract_absolute_date(text: str, patterns: list[re.Pattern]) -> dict:
    for pattern in patterns:
        match = pattern.search(text)
        if not match:
            continue

        raw_date = match.group(1).strip()
        parsed_date = _parse_date(raw_date)
        if parsed_date:
            return {"expiry_date": _to_iso(parsed_date), "raw_date": raw_date}

    return {"expiry_date": None, "raw_date": None}


def _extract_relative_best_before(text: str) -> dict:
    relative_match = RELATIVE_BEST_BEFORE_RE.search(text)
    if not relative_match:
        return {"expiry_date": None, "raw_date": None}

    amount = int(relative_match.group(1))
    unit = relative_match.group(2).lower()
    raw_date = relative_match.group(0).strip()

    reference_match = REFERENCE_DATE_RE.search(text)
    reference_date = _parse_date(reference_match.group(1)) if reference_match else date.today()

    if not reference_date:
        return {"expiry_date": None, "raw_date": raw_date}

    if unit.startswith("day"):
        expiry_date = reference_date + relativedelta(days=amount)
    elif unit.startswith("month"):
        expiry_date = reference_date + relativedelta(months=amount)
    else:
        expiry_date = reference_date + relativedelta(years=amount)

    return {"expiry_date": _to_iso(expiry_date), "raw_date": raw_date}


def extract_expiry_date(text: str) -> dict:
    if not text:
        return {"expiry_date": None, "raw_date": None}

    labelled_result = _extract_absolute_date(text, EXPIRY_DATE_PATTERNS)
    if labelled_result["expiry_date"]:
        return labelled_result

    relative_result = _extract_relative_best_before(text)
    if relative_result["expiry_date"]:
        return relative_result

    return _extract_absolute_date(text, GENERIC_DATE_PATTERNS)
