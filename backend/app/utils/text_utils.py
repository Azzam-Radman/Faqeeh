"""Arabic text utilities for normalisation, tokenisation, and extraction."""

from __future__ import annotations

import re
import unicodedata
from typing import List

try:
    from langdetect import detect, LangDetectException
    _langdetect_available = True
except ImportError:
    _langdetect_available = False

# ---------------------------------------------------------------------------
# Arabic Unicode ranges and patterns
# ---------------------------------------------------------------------------

# Tashkeel / diacritics (harakat + shadda + sukun + tatweel)
_TASHKEEL = re.compile(
    r"[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]"
)

# Tatweel (kashida)
_TATWEEL = re.compile(r"ـ")

# Hamza / alef variants -> normalised alef
_ALEF_VARIANTS = re.compile(r"[إأآٱ]")
# Alef maqsoura -> ya
_ALEF_MAQSOURA = re.compile(r"ى")
# Teh marbuta -> ha
_TEH_MARBUTA = re.compile(r"ة")
# Waw with hamza above/below
_WAW_HAMZA = re.compile(r"[ؤ]")
# Ya with hamza
_YA_HAMZA = re.compile(r"[ئ]")
# Hamza alone
_HAMZA = re.compile(r"[ء]")

# Tokenisation: split on whitespace and common punctuation
_TOKENISE_PATTERN = re.compile(
    r"[\s،؛؟ـ،؛؟!\"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~‌‍‎‏]+"
)

# Arabic stop words to filter during keyword extraction
_ARABIC_STOP_WORDS = {
    "في", "من", "إلى", "على", "عن", "مع", "هذا", "هذه", "ذلك", "تلك",
    "التي", "الذي", "الذين", "اللاتي", "اللواتي", "وهو", "وهي", "فهو",
    "فهي", "وهذا", "وهذه", "فإن", "أن", "إن", "لا", "لم", "لن", "قد",
    "كان", "كانت", "يكون", "تكون", "هو", "هي", "هم", "هن", "أنت",
    "أنا", "نحن", "وأن", "أو", "أم", "بل", "لكن", "ثم", "حتى", "كما",
    "إذا", "إذ", "حين", "عند", "بعد", "قبل", "منذ", "مذ", "ما", "مما",
    "مه", "وما", "فما", "بما", "لما", "أما", "أمه", "إلا", "لئن", "لو",
    "لولا", "لوما", "هل", "همزة", "الـ", "ال", "و", "ف", "ب", "ك", "ل",
    "لل", "وال", "فال", "بال", "كال",
}

# Fiqh topic keywords for detection
_FIQH_TOPICS = {
    "طهارة": ["طهارة", "وضوء", "غسل", "تيمم", "نجاسة", "طاهر", "نجس"],
    "صلاة": ["صلاة", "صلوات", "نية", "قبلة", "ركعة", "سجود", "ركوع", "تشهد", "أذان", "إقامة"],
    "زكاة": ["زكاة", "نصاب", "حول", "مال", "فقير", "مسكين", "صدقة"],
    "صيام": ["صيام", "صوم", "رمضان", "إفطار", "سحور", "فطر", "مفطرات"],
    "حج": ["حج", "عمرة", "إحرام", "طواف", "سعي", "مكة", "منى", "عرفة"],
    "نكاح": ["نكاح", "زواج", "عقد", "مهر", "ولي", "شاهد", "خطبة", "زوج", "زوجة"],
    "طلاق": ["طلاق", "خلع", "فسخ", "عدة", "رجعة", "بائن", "مطلقة"],
    "بيع": ["بيع", "شراء", "عقد", "ثمن", "مبيع", "ربا", "غرر", "خيار", "إجارة", "قرض"],
}


def normalize_arabic(text: str) -> str:
    """Remove diacritics/tashkeel, normalise hamza/alef variants, remove tatweel.

    Args:
        text: Input Arabic text.

    Returns:
        Normalised Arabic text.
    """
    if not text:
        return text

    # Remove tashkeel
    text = _TASHKEEL.sub("", text)
    # Remove tatweel
    text = _TATWEEL.sub("", text)
    # Normalise alef variants to plain alef
    text = _ALEF_VARIANTS.sub("ا", text)
    # Normalise alef maqsoura to ya
    text = _ALEF_MAQSOURA.sub("ي", text)
    # Normalise teh marbuta to ha
    text = _TEH_MARBUTA.sub("ه", text)

    return text.strip()


def arabic_tokenize(text: str) -> List[str]:
    """Split Arabic text into tokens by whitespace and punctuation.

    Args:
        text: Input text.

    Returns:
        List of non-empty token strings.
    """
    normalised = normalize_arabic(text)
    tokens = _TOKENISE_PATTERN.split(normalised)
    return [t for t in tokens if t and len(t) > 1]


def detect_language(text: str) -> str:
    """Detect whether the text is Arabic or English.

    Args:
        text: Input text.

    Returns:
        'ar' or 'en'.
    """
    if not text or not text.strip():
        return "ar"

    # Quick heuristic: count Arabic characters
    arabic_chars = sum(1 for ch in text if "؀" <= ch <= "ۿ")
    if arabic_chars / max(len(text.strip()), 1) > 0.3:
        return "ar"

    if _langdetect_available:
        try:
            lang = detect(text)
            return "ar" if lang == "ar" else "en"
        except LangDetectException:
            pass

    return "en"


def extract_scholar_mentions(text: str, scholars_list: List[dict]) -> List[dict]:
    """Find scholar names mentioned in the query text.

    Args:
        text: Query text.
        scholars_list: List of scholar dicts with at least 'name_ar' and 'id'.

    Returns:
        List of matching scholar dicts.
    """
    normalised_query = normalize_arabic(text)
    matches = []
    seen_ids = set()

    for scholar in scholars_list:
        scholar_id = scholar.get("id", "")
        if scholar_id in seen_ids:
            continue

        name_ar = normalize_arabic(scholar.get("name_ar", ""))
        name_en = scholar.get("name_en", "") or ""

        # Check Arabic name
        if name_ar and name_ar in normalised_query:
            matches.append(scholar)
            seen_ids.add(scholar_id)
            continue

        # Check individual parts of Arabic name (e.g. "النووي" matches "الإمام النووي")
        parts = name_ar.split()
        for part in parts:
            if len(part) > 3 and part in normalised_query:
                matches.append(scholar)
                seen_ids.add(scholar_id)
                break

        # Check English name (case-insensitive)
        if name_en and name_en.lower() in text.lower():
            if scholar_id not in seen_ids:
                matches.append(scholar)
                seen_ids.add(scholar_id)

    return matches


def extract_topic_keywords(text: str) -> List[str]:
    """Extract fiqh topic-related keywords from text.

    Args:
        text: Input text (Arabic or English).

    Returns:
        List of detected topic keyword strings.
    """
    normalised = normalize_arabic(text)
    tokens = set(arabic_tokenize(normalised))
    detected_keywords: List[str] = []

    for topic, keywords in _FIQH_TOPICS.items():
        for kw in keywords:
            norm_kw = normalize_arabic(kw)
            if norm_kw in normalised or norm_kw in tokens:
                detected_keywords.append(kw)

    # Also keep meaningful tokens not in stop words
    meaningful = [t for t in tokens if t not in _ARABIC_STOP_WORDS and len(t) > 2]
    for word in meaningful:
        if word not in detected_keywords:
            detected_keywords.append(word)

    return detected_keywords[:20]  # cap to avoid noise


def clean_text(text: str) -> str:
    """General text cleaning: strip extra whitespace, control characters, zero-width chars.

    Args:
        text: Input text.

    Returns:
        Cleaned text.
    """
    if not text:
        return ""

    # Remove control characters except newline/tab
    text = "".join(ch for ch in text if unicodedata.category(ch)[0] != "C" or ch in "\n\t")

    # Remove zero-width characters
    text = re.sub(r"[​-‏‪-‮﻿]", "", text)

    # Collapse multiple spaces/tabs
    text = re.sub(r"[ \t]+", " ", text)

    # Collapse more than 2 newlines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()
