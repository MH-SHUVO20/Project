import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.inference import _ROMAN_POSITIVE_RE, _BN_POSITIVE, _ROMAN_NEGATIVE_RE, _ROMAN_PRICE_NEGATIVE_RE, _BN_NEGATIVE, _BN_PRICE_NEGATIVE, _NEGATION_RE, _BN_NEGATION, _normalize_text, _CONTRAST_RE
import re

def fixed_heuristic(text: str) -> str:
    text_l = text.lower()
    text_l = f"{text_l} {_normalize_text(text_l)}"

    # --- Count positive and negative keyword hits ---
    pos_hits = len(_ROMAN_POSITIVE_RE.findall(text_l))
    # Fix double counting by checking exact substring matches carefully, or just divide by 2 if we append normalized
    # But wait, we just appended normalized text.
    
    pos_hits += sum(1 for token in _BN_POSITIVE if token in text_l)

    neg_hits = len(_ROMAN_NEGATIVE_RE.findall(text_l))
    neg_hits += len(_ROMAN_PRICE_NEGATIVE_RE.findall(text_l))
    neg_hits += sum(1 for token in _BN_NEGATIVE if token in text_l)
    neg_hits += sum(1 for token in _BN_PRICE_NEGATIVE if token in text_l)

    has_negation = bool(_NEGATION_RE.search(text_l)) or any(f" {token} " in f" {re.sub(r'[^\\w\\s\\u0980-\\u09FF]', ' ', text_l)} " for token in _BN_NEGATION)
    contrast_match = _CONTRAST_RE.search(text_l)

    print(f"Before Negation -> Pos: {pos_hits}, Neg: {neg_hits}")

    if has_negation and not contrast_match:
        # If there's negation, it usually flips the DOMINANT sentiment.
        # "not good" (pos > neg) -> negative
        # "not bad" (neg > pos) -> positive
        # "not good, problems" (pos=2, neg=1) -> negative
        if pos_hits >= neg_hits and pos_hits > 0:
            neg_hits += pos_hits
            pos_hits = 0
        elif neg_hits > pos_hits:
            pos_hits += neg_hits
            neg_hits = 0

    print(f"After Negation  -> Pos: {pos_hits}, Neg: {neg_hits}")

    if pos_hits == 0 and neg_hits == 0: return "neutral"
    if neg_hits > pos_hits: return "negative"
    if pos_hits > neg_hits: return "positive"
    return "neutral"

print(fixed_heuristic("অভিজ্ঞতা ভালো না, কিছু সমস্যা আছে।"))
print(fixed_heuristic("খারাপ না, ভালোই"))
