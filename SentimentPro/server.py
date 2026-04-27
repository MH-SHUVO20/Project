"""
BanglaSentiment Pro — FastAPI Server
Serves the frontend and provides API endpoints.
Run:  python server.py
Open: http://localhost:9090
"""

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path

# ── App ──────────────────────────────────────────────
app = FastAPI(
    title="BanglaSentiment Pro",
    description="Advanced Bengali Language Sentiment & Emotion Analysis",
    version="1.0.0",
)

# ── Paths ────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent

# ── Static files (CSS, JS, assets) ──────────────────
app.mount("/css",    StaticFiles(directory=BASE_DIR / "css"),    name="css")
app.mount("/js",     StaticFiles(directory=BASE_DIR / "js"),     name="js")
app.mount("/html",   StaticFiles(directory=BASE_DIR / "html"),   name="html")

if (BASE_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=BASE_DIR / "assets"), name="assets")

# ── Page routes ──────────────────────────────────────
@app.get("/")
async def root():
    """Redirect to login page."""
    return FileResponse(BASE_DIR / "index.html")


@app.get("/html/{page_name}.html")
async def serve_page(page_name: str):
    """Serve any .html page by name from the html/ folder."""
    file_path = BASE_DIR / "html" / f"{page_name}.html"
    if file_path.is_file():
        return FileResponse(file_path)
    return JSONResponse({"error": "Page not found"}, status_code=404)


@app.get("/{page_name}.html")
async def serve_page_legacy(page_name: str):
    """Legacy route — redirect old top-level .html URLs to /html/."""
    file_path = BASE_DIR / "html" / f"{page_name}.html"
    if file_path.is_file():
        return FileResponse(file_path)
    return JSONResponse({"error": "Page not found"}, status_code=404)


@app.get("/api/health")
async def health_check():
    """Static frontend server health check."""
    return {"status": "ok", "service": "sentimentpro-frontend"}


# ── Run ──────────────────────────────────────────────
if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 9090))
    print(f"\n  BanglaSentiment Pro is live!")
    print(f"  -> http://localhost:{port}\n")
    reload = os.environ.get("FRONTEND_RELOAD", "false").lower() == "true"
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=reload)
