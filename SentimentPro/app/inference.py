import os
import re
from pathlib import Path
from threading import Lock

try:
    import torch
    from torch import nn
    from transformers import AutoTokenizer, BertConfig, BertModel
except Exception:
    torch = None
    nn = None
    AutoTokenizer = None
    BertConfig = None
    BertModel = None

try:
    from app.Normalizer.normalizer_research import ResearchBanglaEcomNormalizer
except Exception:
    ResearchBanglaEcomNormalizer = None


SENTIMENT_LABELS = ["positive", "negative", "neutral"]
EMOTION_LABELS = ["happy", "love", "sadness", "fear", "anger", "other"]

_NEGATION_RE = re.compile(r"\b(?:na|nai|nei|no|not|never|without|ni|lageni|hoyni|paini|koreni|deyni)\b", re.IGNORECASE)
_ROMAN_POSITIVE_RE = re.compile(
    r"\b(?:valo|bhalo|darun|shundor|sundor|moja|khushi|happy|love|like|pochondo|excellent|great|good|awesome|amazing|best|beautiful|osthir|dami|recommended|thanks|thank|obak|surprised|superb|perfect|wonderful|fantastic)\b",
    re.IGNORECASE,
)
_ROMAN_NEGATIVE_RE = re.compile(
    r"\b(?:kharap|baje|faltu|bad|worst|terrible|hate|rag|raganbito|dukkho|sad|voy|bhoy|fear|late|deri|problem|noshto|broken|damage|damaged|vanga|bhanga|fajlami|bekar|ghatia|scam|fraud|waste|hotash)\b",
    re.IGNORECASE,
)
_ROMAN_GREETING_RE = re.compile(r"\b(?:hi|hello|hey|kemon|kamon|asen|achen|assalamualaikum|salam)\b", re.IGNORECASE)
_ROMAN_PRICE_NEGATIVE_RE = re.compile(
    r"\b(?:dam|price)\s+(?:beshi|high|onek)|\b(?:beshi|high)\s+(?:dam|price)\b",
    re.IGNORECASE,
)
# Neutral hedges — phrases indicating lukewarm or conditional opinion
_ROMAN_NEUTRAL_RE = re.compile(
    r"\b(?:thik|thikthak|ok|okay|decent|average|mediocre|workable|chalbe|normal|moderate|so\s*so)\b",
    re.IGNORECASE,
)
# Contrast/twist connectors — the clause AFTER the connector carries more weight
_CONTRAST_RE = re.compile(
    r"\b(?:but|kintu|tobe|lekin|however|although|though|yet|tahole|tao)\b",
    re.IGNORECASE,
)

_BN_POSITIVE = (
    "\u09ad\u09be\u09b2",
    "\u09ad\u09be\u09b2\u09cb",
    "\u09a6\u09be\u09b0\u09c1\u09a3",
    "\u09b8\u09c1\u09a8\u09cd\u09a6\u09b0",
    "\u0996\u09c1\u09b6\u09bf",
    "\u09aa\u099b\u09a8\u09cd\u09a6",
    "\u09ad\u09be\u09b2\u09ac\u09be\u09b8",
    "\u099a\u09ae\u09ce\u0995\u09be\u09b0",
)
_BN_NEGATIVE = (
    "\u0996\u09be\u09b0\u09be\u09aa",
    "\u09ac\u09be\u099c\u09c7",
    "\u09ab\u09be\u09b2\u09a4\u09c1",
    "\u09a8\u09b7\u09cd\u099f",
    "\u09b8\u09ae\u09b8\u09cd\u09af\u09be",
    "\u09a6\u09c7\u09b0\u09bf",
    "\u09b0\u09be\u0997",
    "\u09a6\u09c1\u0983\u0996",
    "\u09ad\u09df",
    "\u09ad\u09af\u09bc",
    "\u0998\u09c3\u09a3\u09be",
    "\u09b9\u09a4\u09be\u09b6",
    "\u09ac\u09bf\u09b0\u0995\u09cd\u09a4",
    "\u09ad\u09be\u0999\u09be",
)
_BN_NEUTRAL = (
    "\u09a0\u09bf\u0995\u09a0\u09be\u0995",
    "\u09ae\u09cb\u099f\u09be\u09ae\u09c1\u099f\u09bf",
    "\u099a\u09b2\u09a8\u09b8\u0987",
    "\u09ae\u09a8\u09cd\u09a6 \u09a8\u09be",
)
_BN_CONDITIONAL = (
    "\u09b9\u09a4\u09c7 \u09aa\u09be\u09b0\u09a4",
    "\u09b9\u09a4\u09cb",
    "\u09b9\u09b2\u09c7 \u09ad\u09be\u09b2\u09cb",
    "\u09aa\u09be\u09b0\u09a4",
    "\u0989\u099a\u09bf\u09a4 \u099b\u09bf\u09b2",
)
_BN_NEGATION = ("\u09a8\u09be", "\u09a8\u09be\u0987", "\u09a8\u09c7\u0987", "\u09a8\u09df", "\u09a8\u09af\u09bc", "\u09a8\u09bf", "লাগেনি", "হয়নি", "পাইনি", "করিনি")
_BN_PRICE_NEGATIVE = ("\u09a6\u09be\u09ae \u09ac\u09c7\u09b6\u09bf", "\u09ac\u09c7\u09b6\u09bf \u09a6\u09be\u09ae")

_NORMALIZER = None
_MODEL_BUNDLE = None
_MODEL_ERROR = None
_MODEL_LOCK = Lock()


def _model_dir() -> Path:
    return Path(os.getenv("MODEL_DIR", "app/model/banglabert_multitask")).resolve()


def _tokenizer_dir() -> Path:
    return Path(os.getenv("TOKENIZER_DIR", "app/model/tokenizer")).resolve()


def _max_length() -> int:
    return int(os.getenv("MODEL_MAX_LENGTH", "128"))


def _get_normalizer():
    global _NORMALIZER
    if _NORMALIZER is not None:
        return _NORMALIZER
    if ResearchBanglaEcomNormalizer is None:
        return None

    resource_dir = Path(os.getenv("NORMALIZER_RESOURCE_DIR", "app/Normalizer/resources")).resolve()
    _NORMALIZER = ResearchBanglaEcomNormalizer(resource_dir=str(resource_dir), fuzzy_cutoff=0.91)
    return _NORMALIZER


def _normalize_text(text: str) -> str:
    normalizer = _get_normalizer()
    if not normalizer:
        return text

    try:
        out = normalizer.normalize_review(text)
        normalized = out.get("Review_norm_hybrid") if isinstance(out, dict) else None
        return normalized if normalized else text
    except Exception:
        return text


if nn is not None:
    class _ClassificationHead(nn.Module):
        def __init__(self, out_features: int):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(768, 256),
                nn.LayerNorm(256),
                nn.ReLU(),
                nn.Dropout(0.3),
                nn.Linear(256, out_features),
            )

        def forward(self, pooled_output):
            return self.net(pooled_output)


    class _BanglaBertMultiTask(nn.Module):
        def __init__(self):
            super().__init__()
            config = BertConfig(
                vocab_size=32000,
                hidden_size=768,
                num_hidden_layers=12,
                num_attention_heads=12,
                intermediate_size=3072,
                max_position_embeddings=512,
                type_vocab_size=2,
            )
            self.bert = BertModel(config, add_pooling_layer=False)
            self.sent_head = _ClassificationHead(len(SENTIMENT_LABELS))
            self.emot_head = _ClassificationHead(len(EMOTION_LABELS))

        def forward(self, input_ids, attention_mask=None, token_type_ids=None):
            out = self.bert(
                input_ids=input_ids,
                attention_mask=attention_mask,
                token_type_ids=token_type_ids,
                return_dict=True,
            )
            pooled = out.last_hidden_state[:, 0]
            return self.sent_head(pooled), self.emot_head(pooled)
else:
    _ClassificationHead = None
    _BanglaBertMultiTask = None


def _load_model_bundle():
    global _MODEL_BUNDLE, _MODEL_ERROR
    if _MODEL_BUNDLE is not None:
        return _MODEL_BUNDLE

    with _MODEL_LOCK:
        if _MODEL_BUNDLE is not None:
            return _MODEL_BUNDLE

        if torch is None or AutoTokenizer is None:
            _MODEL_ERROR = "PyTorch/Transformers are not installed"
            return None

        model_path = _model_dir() / "best_model.pt"
        tokenizer_path = _tokenizer_dir()
        if not model_path.exists():
            _MODEL_ERROR = f"Model checkpoint not found: {model_path}"
            return None
        if not tokenizer_path.exists():
            _MODEL_ERROR = f"Tokenizer directory not found: {tokenizer_path}"
            return None

        try:
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            tokenizer = AutoTokenizer.from_pretrained(str(tokenizer_path), local_files_only=True)
            model = _BanglaBertMultiTask()
            state = torch.load(str(model_path), map_location="cpu")
            model.load_state_dict(state, strict=True)
            model.to(device)
            model.eval()
            _MODEL_BUNDLE = {"model": model, "tokenizer": tokenizer, "device": device}
            _MODEL_ERROR = None
            return _MODEL_BUNDLE
        except Exception as exc:
            _MODEL_ERROR = str(exc)
            return None


def model_status() -> dict:
    bundle = _load_model_bundle()
    return {
        "loaded": bundle is not None,
        "model_dir": str(_model_dir()),
        "tokenizer_dir": str(_tokenizer_dir()),
        "error": _MODEL_ERROR,
    }


def _heuristic_sentiment(text: str) -> str:
    """Score-based sentiment: count positive vs negative signals, handle contrasts."""
    text_l = text.lower()

    # --- Count positive and negative keyword hits ---
    pos_hits = len(_ROMAN_POSITIVE_RE.findall(text_l))
    pos_hits += sum(1 for token in _BN_POSITIVE if token in text_l)

    neg_hits = len(_ROMAN_NEGATIVE_RE.findall(text_l))
    neg_hits += len(_ROMAN_PRICE_NEGATIVE_RE.findall(text_l))
    neg_hits += sum(1 for token in _BN_NEGATIVE if token in text_l)
    neg_hits += sum(1 for token in _BN_PRICE_NEGATIVE if token in text_l)

    # --- Conditional phrases: "ভালো হতো" / "ভালো হতে পারত" are NOT positive ---
    # These are wishes/conditionals — subtract from positive count
    conditional_positive_re = re.compile(
        r"(?:ভালো\s+হতো|ভালো\s+হতে\s+পারত|হলে\s+ভালো|valo\s+hoto|bhalo\s+hoto|valo\s+hote\s+parto)",
        re.IGNORECASE,
    )
    conditional_pos_count = len(conditional_positive_re.findall(text_l))
    pos_hits = max(0, pos_hits - conditional_pos_count * 2)  # *2 because text+normalized doubles it

    # --- Neutral hedges reduce confidence of both sides ---
    has_neutral = bool(_ROMAN_NEUTRAL_RE.search(text_l)) or any(token in text_l for token in _BN_NEUTRAL)
    has_conditional = any(token in text_l for token in _BN_CONDITIONAL)

    # --- Contrast handling: "I thought X was bad BUT it's amazing" ---
    # If a contrast word exists, weight the AFTER-contrast clause more
    contrast_match = _CONTRAST_RE.search(text_l)
    if contrast_match and (pos_hits > 0 and neg_hits > 0):
        after_contrast = text_l[contrast_match.end():]
        after_pos = len(_ROMAN_POSITIVE_RE.findall(after_contrast))
        after_pos += sum(1 for t in _BN_POSITIVE if t in after_contrast)
        after_neg = len(_ROMAN_NEGATIVE_RE.findall(after_contrast))
        after_neg += sum(1 for t in _BN_NEGATIVE if t in after_contrast)
        # The after-contrast clause gets double weight
        pos_hits += after_pos
        neg_hits += after_neg

    # --- Negation: only counts if not overridden by contrast ---
    clean_text = re.sub(r'[^\w\s\u0980-\u09FF]', ' ', text_l)
    padded_text = f" {clean_text} "
    has_negation = bool(_NEGATION_RE.search(text_l)) or any(f" {token} " in padded_text for token in _BN_NEGATION)

    # Negation flips dominant sentiment ONLY if there's no contrast that reverses it
    if has_negation and not contrast_match:
        if pos_hits >= neg_hits and pos_hits > 0:
            neg_hits += pos_hits
            pos_hits = 0
        elif neg_hits > pos_hits:
            pos_hits += neg_hits
            neg_hits = 0

    # --- If neutral hedges + conditional forms dominate, return neutral ---
    if has_neutral or has_conditional:
        if abs(pos_hits - neg_hits) <= 2:
            return "neutral"

    # --- Score-based decision ---
    if pos_hits == 0 and neg_hits == 0:
        return "neutral"
    if neg_hits > pos_hits:
        return "negative"
    if pos_hits > neg_hits:
        return "positive"
    # Tie: if both positive and negative signals exist equally, lean neutral
    return "neutral"


# Pre-compiled word-boundary regexes for emotion keywords to avoid false positives
# e.g. "sad" matching "sada" (white), "rag" matching "garage", "fear" matching "feature"
_EMO_LOVE_RE = re.compile(r"\b(?:love|valobas|valobasha|bhalobas|bhalobasha)\b", re.IGNORECASE)
_EMO_HAPPY_RE = re.compile(r"\b(?:happy|khushi|anondo|hashi)\b", re.IGNORECASE)
_EMO_SAD_RE = re.compile(r"\b(?:sad|sadness|dukkho|dukkha|koshto|kosto)\b", re.IGNORECASE)
_EMO_FEAR_RE = re.compile(r"\b(?:fear|afraid|voy|bhoy|bhoi|shonka)\b", re.IGNORECASE)
_EMO_ANGER_RE = re.compile(r"\b(?:anger|angry|rag|raganbito|rege|khepechhi)\b", re.IGNORECASE)


def _heuristic_emotion(text: str, sentiment: str) -> str:
    text_l = text.lower()
    if _EMO_LOVE_RE.search(text_l) or "\u09ad\u09be\u09b2\u09ac\u09be\u09b8" in text_l:
        return "love"
    if _EMO_HAPPY_RE.search(text_l) or "\u0996\u09c1\u09b6\u09bf" in text_l:
        return "happy"
    if _EMO_SAD_RE.search(text_l) or "\u09a6\u09c1\u0983\u0996" in text_l:
        return "sadness"
    if _EMO_FEAR_RE.search(text_l) or "\u09ad\u09df" in text_l or "\u09ad\u09af\u09bc" in text_l:
        return "fear"
    if _EMO_ANGER_RE.search(text_l) or "\u09b0\u09be\u0997" in text_l:
        return "anger"
    if sentiment == "positive":
        return "happy"
    if sentiment == "negative":
        return "anger"
    return "other"


def _scores_for(sentiment: str, confidence: float) -> dict:
    scores = {"positive": 0.0, "neutral": 0.0, "negative": 0.0}
    remaining = round((1.0 - confidence) / 2.0, 4)
    for label in scores:
        scores[label] = confidence if label == sentiment else remaining
    return scores


def _emotion_scores_for(emotion: str, confidence: float) -> dict:
    remaining = round((1.0 - confidence) / (len(EMOTION_LABELS) - 1), 4)
    return {label: confidence if label == emotion else remaining for label in EMOTION_LABELS}


def _rule_prediction(text: str, normalized_text: str) -> dict | None:
    combined = f"{text} {normalized_text}"
    sentiment = _heuristic_sentiment(combined)
    is_greeting = bool(_ROMAN_GREETING_RE.search(combined))
    if sentiment == "neutral" and not is_greeting:
        return None

    emotion = _heuristic_emotion(combined, sentiment)
    confidence = 0.93 if sentiment != "neutral" else 0.86
    return {
        "sentiment": sentiment,
        "emotion": emotion,
        "confidence": confidence,
        "scores": _scores_for(sentiment, confidence),
        "emotion_scores": _emotion_scores_for(emotion, confidence),
        "rule_applied": True,
        "normalized_text": normalized_text,
    }


def _fallback_prediction(text: str, normalized_text: str) -> dict:
    sentiment = _heuristic_sentiment(f"{text} {normalized_text}")
    emotion = _heuristic_emotion(f"{text} {normalized_text}", sentiment)
    confidence = 0.55
    return {
        "sentiment": sentiment,
        "emotion": emotion,
        "confidence": confidence,
        "scores": _scores_for(sentiment, confidence),
        "emotion_scores": _emotion_scores_for(emotion, confidence),
        "model_loaded": False,
        "model_error": _MODEL_ERROR,
        "normalized_text": normalized_text,
    }


def _merge_rule_with_model(rule_result: dict | None, model_result: dict) -> dict:
    if rule_result is None:
        if model_result["sentiment"] == "neutral" and model_result["emotion"] == "fear":
            model_result["emotion"] = "other"
        return model_result

    rule_result["model_loaded"] = model_result.get("model_loaded", False)
    rule_result["model_sentiment"] = model_result.get("sentiment")
    rule_result["model_emotion"] = model_result.get("emotion")
    return rule_result


def predict_single(text: str) -> dict:
    normalized_text = _normalize_text(text)
    rule_result = _rule_prediction(text, normalized_text)
    bundle = _load_model_bundle()
    if bundle is None:
        if rule_result is not None:
            rule_result["model_loaded"] = False
            rule_result["model_error"] = _MODEL_ERROR
            return rule_result
        return _fallback_prediction(text, normalized_text)

    tokenizer = bundle["tokenizer"]
    model = bundle["model"]
    device = bundle["device"]

    encoded = tokenizer(
        normalized_text,
        truncation=True,
        padding="max_length",
        max_length=_max_length(),
        return_tensors="pt",
    )
    encoded = {key: value.to(device) for key, value in encoded.items()}

    with torch.no_grad():
        sent_logits, emot_logits = model(**encoded)
        sent_probs = torch.softmax(sent_logits, dim=-1)[0].detach().cpu()
        emot_probs = torch.softmax(emot_logits, dim=-1)[0].detach().cpu()

    sent_idx = int(torch.argmax(sent_probs).item())
    emot_idx = int(torch.argmax(emot_probs).item())
    confidence = float(sent_probs[sent_idx].item())

    model_result = {
        "sentiment": SENTIMENT_LABELS[sent_idx],
        "emotion": EMOTION_LABELS[emot_idx],
        "confidence": confidence,
        "scores": {
            "positive": float(sent_probs[0].item()),
            "negative": float(sent_probs[1].item()),
            "neutral": float(sent_probs[2].item()),
        },
        "emotion_scores": {
            label: float(emot_probs[idx].item())
            for idx, label in enumerate(EMOTION_LABELS)
        },
        "model_loaded": True,
        "normalized_text": normalized_text,
    }
    return _merge_rule_with_model(rule_result, model_result)


def predict_batch(texts: list[str]) -> list[dict]:
    return [predict_single(text) for text in texts]
