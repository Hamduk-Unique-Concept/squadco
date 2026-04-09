# TrustLayer AI Engine

This folder is intentionally deployable on its own.

## Purpose

The AI engine is the scoring and explanation service for:

- transaction risk analysis
- credit scoring
- statement parsing
- LLM-generated explanations

It should be deployed separately from the dashboard stack.

## Production shape

Deploy this folder as:

- one Render web service for FastAPI
- one Render worker service for queued background jobs

The dashboard API calls this service through `AI_ENGINE_URL`. Banks never call it directly.

## Deploy to Render

You can deploy this folder by itself on Render.

Required env vars:

- `AI_ENGINE_SECRET`
- `NVIDIA_API_KEY`
- `NVIDIA_BASE_URL`
- `LOG_LEVEL` optional

Use:

- Python version: `3.11`
- build command: `pip install -r requirements.txt`
- web start command: `uvicorn main:app --host 0.0.0.0 --port $PORT --workers 4`
- worker start command: `python worker.py`

Health endpoint:

- `/health`
- `/metrics`

## Dashboard/API integration

The Node dashboard API does not host the AI logic directly. It calls the deployed AI engine using:

- `AI_ENGINE_URL`
- `AI_ENGINE_SECRET`

That means:

- `apps/ai-engine` can live on Render
- `apps/api` can live with the dashboard stack

## Current endpoints

- `POST /analyze-risk`
- `POST /score-credit`
- `POST /parse-statement`
- `POST /explain`
- `POST /predict-balance`
- `POST /categorize`
- `GET /health`
- `GET /metrics`

## Working production behaviors in this repo

Already implemented:

- strict internal secret gate between control API and AI engine
- request ID propagation support
- LLM fallback chain
- statement size/page/row limits
- AI explanation no longer blocks bank transaction decisions
- safe fallback decision from the control API if the AI engine is unavailable
- categorization and balance prediction endpoints available for assistant context

Still to add with external infra:

- Redis caching
- Redis/RQ async queues
- dead-letter queue
- Sentry integration
- org-level analytics and alert wiring
