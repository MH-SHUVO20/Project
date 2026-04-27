import sys
import os

# Ensure the app module is accessible
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.inference import predict_single, _normalize_text

test_cases = [
    "onek sundor product, packaging ta valo chilo na",
    "khub bhalo service daraz er, ami khushi",
    "baje product, kono kajer na",
    "taka nosto, ekdom baje",
    "vanga box paisi",
    "amar eti valo lageni",
    "আমার মেয়ে এই খেলনাটা পেয়ে এত খুশি হয়েছে। সে একদম ভালোবেসে ফেলেছে।"
]

print("--- Testing Banglish Normalization and Inference ---")
for text in test_cases:
    print(f"\n[Raw] {text}")
    print(f"[Normalized] {_normalize_text(text)}")
    res = predict_single(text)
    print(f"[Prediction] Sentiment: {res.get('sentiment')}, Emotion: {res.get('emotion')}, Confidence: {res.get('confidence')}")
