# AGENTS

This file helps AI coding agents work effectively in the `agentic-hire` monorepo.

## Project overview

- `frontend/`: Next.js 16 App Router UI written in TypeScript. It proxies resume uploads to the backend and polls analysis status.
- `backend/`: FastAPI Python microservice with Celery worker tasks. It extracts resume text, queues analysis, and stores results in PostgreSQL.
- The system is designed for asynchronous AI processing using Agno, Google Gemini, and Langfuse-managed prompts.

## Key goals for agent work

- Preserve the frontend/backend separation.
- Keep the backend asynchronous: API server handles upload + DB save, worker processes AI analysis.
- Respect strict prompt management via Langfuse in `backend/app/agents.py`.
- Do not hardcode credentials or prompt text in source files.

## Important files

- `backend/app/main.py`: FastAPI entrypoint, upload handling, resume extraction, Celery task enqueue.
- `backend/app/tasks.py`: Celery worker task that runs the Agno HR team and saves results.
- `backend/app/agents.py`: AI team definition, Langfuse prompt loading, Gemini model configuration, output schema.
- `backend/app/schemas.py`: Pydantic schema for `CandidateEvaluation` and structured evaluator output.
- `backend/app/database.py`: DB initialization and `AnalysisResult` ORM model.
- `frontend/app/api/analyze/route.ts`: Next.js proxy route sending multipart form data to backend `/analyze`.
- `frontend/app/api/status/[id]/route.ts`: Polling route for analysis status.

## Local development commands

### Backend
```bash
cd backend
uv sync   # or pip install -r requirements.txt
uv run python -m app.main
uv run celery -A app.tasks.celery_app worker --loglevel=info
```

On Windows, if celery worker fails with the default pool, use:
```bash
uv run celery -A app.tasks.celery_app worker --pool=solo --loglevel=info
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Required environment variables

### `backend/.env`

- `GOOGLE_API_KEY` or `GEMINI_API_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL`
- `AUTH_SECRET` (signs session tokens; keep it random and secret)

HR accounts are self-service (Sign Up page) and stored, password-hashed, in the `users` Postgres table - no env var needed to add one.

### `frontend/.env.local`

- `BACKEND_API_URL=http://localhost:8000`

## Runtime behavior notes

- Backend uploads are not persisted to disk; resume text is extracted in memory and sent to Celery.
- Celery tasks call `get_hr_team(session_id)` and require Langfuse prompts:
  - `resume-parser-instructions`
  - `job-analyst-instructions`
  - `hr-team-lead-instructions`
- If prompt loading fails, the worker should crash loudly.
- Results are stored in `AnalysisResult.result_metadata` and `result_text` for display.

## Anthropic / provider note

- This repository currently uses Google Gemini models in `backend/app/agents.py`.
- If a task requires Anthropic support, the correct place to modify is `backend/app/agents.py` and potentially `requirements.txt` to add Anthropic SDK dependencies.

## When editing

- Avoid changing API contract between frontend and backend unless the frontend proxy route and backend endpoints are updated together.
- Keep CORS origins aligned with `frontend` local and deployed URLs.
- Preserve the output schema defined in `backend/app/schemas.py` when modifying AI response handling.

## Useful docs

- Root README: `README.md`
- Backend README: `backend/README.md`
- Frontend README: `frontend/README.md`
