# BanglaSentiment Pro

> **Advanced Bengali & Banglish Sentiment and Emotion Analysis System**  
> Multi-task Deep Learning with BanglaBERT · FastAPI · PostgreSQL · Real-time Dashboard

![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-2.11-EE4C2C?logo=pytorch&logoColor=white)

---

## Overview

BanglaSentiment Pro is a full-stack NLP application for Bengali (বাংলা) and Banglish text sentiment and emotion analysis. It combines a **Multi-task BanglaBERT** deep learning model with a production-grade **research Banglish normalizer** to deliver accurate predictions for e-commerce reviews, social media text, and mixed-script Bangla content.

### Key Features

| Feature | Description |
|---------|-------------|
| **Multi-task Prediction** | Simultaneous sentiment (positive/neutral/negative) and emotion (happy/love/sadness/fear/anger/other) classification |
| **Banglish Normalization** | Research-grade phonetic normalizer with dialect mapping, phrase normalization, and Unicode canonicalization |
| **Hybrid Inference** | Rule-based heuristics + BanglaBERT deep learning with intelligent fallback |
| **API Key Authentication** | JWT + API key dual authentication for programmatic access |
| **Real-time Dashboard** | Live analytics with sentiment distribution, confidence scores, and history tracking |
| **Batch Processing** | Process up to 200 texts in a single API call |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Vanilla JS)                   │
│  Login → Dashboard → Analysis → Results → History → Settings │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST API (JSON)
┌───────────────────────────┴─────────────────────────────────┐
│                    FastAPI Backend                           │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Auth     │  │ API Keys     │  │ Inference Engine       │ │
│  │ JWT+Key  │  │ SHA-256 hash │  │ Normalizer→Heuristic   │ │
│  │ bcrypt   │  │ CRUD         │  │ →BanglaBERT→Fallback   │ │
│  └──────────┘  └──────────────┘  └────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ PostgreSQL: users, predictions, batch_jobs,          │   │
│  │             feedback, api_keys                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| **Backend** | FastAPI, Uvicorn, Pydantic v2 |
| **Database** | PostgreSQL, SQLAlchemy 2.0 ORM |
| **Auth** | JWT (python-jose) + API Key (SHA-256 hashed) + bcrypt |
| **ML Model** | Multi-task BanglaBERT (PyTorch, Transformers) |
| **NLP** | Research Banglish Normalizer, bnunicodenormalizer, phonetic-bangla |
| **Deploy** | Render (render.yaml IaC) |

---

## Project Structure

```
SentimentPro/
├── app/                          # Backend package
│   ├── __init__.py               # dotenv loader
│   ├── main.py                   # FastAPI routes + frontend serving
│   ├── auth.py                   # JWT + API Key authentication
│   ├── database.py               # SQLAlchemy engine + session
│   ├── models.py                 # ORM models (User, Prediction, ApiKey, etc.)
│   ├── schema.py                 # DB migration (idempotent ALTER/CREATE)
│   ├── inference.py              # Hybrid inference engine
│   ├── run.py                    # Local dev runner
│   ├── model/                    # Model weights (not in Git)
│   │   ├── banglabert_multitask/
│   │   │   └── best_model.pt     # Fine-tuned BanglaBERT (442MB)
│   │   └── tokenizer/            # BanglaBERT tokenizer files
│   └── Normalizer/
│       ├── normalizer_research.py # Banglish normalizer engine
│       └── resources/             # Lexicons (banglish_map, dialect_map, etc.)
├── html/                         # Frontend pages
│   ├── login.html
│   ├── dashboard.html
│   ├── analysis.html
│   ├── results.html
│   ├── history.html
│   └── settings.html
├── css/                          # Stylesheets
├── js/                           # JavaScript modules
│   ├── api.js                    # API client (all backend calls)
│   ├── dashboard.js
│   ├── analysis.js
│   ├── results.js
│   ├── history.js
│   └── settings.js               # API key management UI
├── scripts/                      # DB utilities
│   ├── create_db.py
│   ├── migrate_db.py
│   └── db_health.py
├── index.html                    # Entry redirect
├── server.py                     # Standalone frontend server
├── test_normalizer.py            # Normalizer smoke test
├── requirements.txt              # Python dependencies
├── render.yaml                   # Render deployment (IaC)
├── .env.example                  # Environment template
└── .gitignore
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Get JWT token |
| `GET` | `/auth/me` | Current user profile |
| `PATCH` | `/auth/me` | Update profile/settings |
| `POST` | `/auth/change-password` | Change password |
| `DELETE` | `/auth/me` | Delete account |

### Prediction
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/predict` | Single text prediction |
| `POST` | `/predict/batch` | Batch prediction (up to 200) |

### History & Feedback
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/history` | Prediction history |
| `DELETE` | `/history/{id}` | Delete prediction |
| `DELETE` | `/history` | Clear all history |
| `GET` | `/stats` | User analytics |
| `POST` | `/feedback/{id}` | Submit correction |

### API Keys
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api-keys` | Generate new API key |
| `GET` | `/api-keys` | List keys (prefix only) |
| `DELETE` | `/api-keys/{id}` | Revoke a key |

### API Key Usage

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -H "X-API-Key: bsp_YOUR_KEY_HERE" \
  -d '{"text": "product ta onek valo"}'
```

---

## Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- PostgreSQL 14+
- Model weights in `app/model/` (see Model Setup below)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USER/SentimentPro.git
cd SentimentPro

# 2. Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
copy .env.example .env       # Windows
# cp .env.example .env       # macOS/Linux
# Edit .env with your DB credentials

# 5. Create PostgreSQL database
python scripts/create_db.py

# 6. Start the server
python app/run.py
```

Open **http://localhost:8000** — the API serves both the frontend and backend.

### Model Setup

The BanglaBERT model weight (`best_model.pt`, 442MB) is too large for GitHub.  
Place it manually:

```
app/model/banglabert_multitask/best_model.pt
app/model/tokenizer/tokenizer.json
app/model/tokenizer/vocab.txt
app/model/tokenizer/special_tokens_map.json
app/model/tokenizer/tokenizer_config.json
```

> **Note:** If model files are missing, the system falls back to rule-based heuristic prediction (still functional for demos).

---

## Deploy to Render

1. **Push to GitHub** (model weights excluded via `.gitignore`)
2. Go to [render.com](https://render.com) → **New** → **Blueprint**
3. Connect your GitHub repo — Render auto-detects `render.yaml`
4. Click **Apply** — creates both the web service and PostgreSQL database
5. The app will be live at `https://banglasentiment-pro.onrender.com`

> **Note:** Render free tier has 512MB RAM. The PyTorch model requires more memory, so the system will use heuristic-based prediction on free tier. Upgrade to Starter plan for full model inference.

---

## Inference Pipeline

```
Input Text
    │
    ▼
┌─────────────────────┐
│ Banglish Normalizer  │  Phonetic mapping, dialect normalization,
│ (Research-grade)     │  Unicode canonicalization, span protection
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Rule-based Heuristic │  Regex patterns for sentiment/emotion
│ (High confidence)    │  keywords in Bangla/Banglish/English
└──────────┬──────────┘
           │ if ambiguous
           ▼
┌─────────────────────┐
│ BanglaBERT Model     │  Multi-task: sentiment head + emotion head
│ (Fine-tuned)         │  Softmax probabilities → confidence score
└──────────┬──────────┘
           │ if model unavailable
           ▼
┌─────────────────────┐
│ Fallback Prediction  │  Statistical heuristic with
│ (Always available)   │  character-level analysis
└─────────────────────┘
```

---

## Security

- **Passwords:** bcrypt hashed (72-byte limit enforced)
- **JWT:** HS256 with configurable expiry (default 2 hours)
- **API Keys:** SHA-256 hashed storage, shown only once at creation
- **CORS:** Configurable origins via environment variable
- **Input:** Pydantic validation on all endpoints with max-length constraints
- **SQL:** SQLAlchemy ORM (parameterized queries, no raw SQL injection)

---

## License

This project was developed as part of an NLP course project.
