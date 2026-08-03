# HireFit - Autonomous AI Recruitment Platform 🚀

**HireFit** is an AI-powered recruitment copilot that automates the initial screening of candidates. It employs a **Multi-Agent System** to parse resumes, analyze job descriptions, and provide human-like reasoning for candidate suitability using **Google Gemini**. HR users sign up / log in before uploading resumes; results are shared across all logged-in HR accounts.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)
![Architecture](https://img.shields.io/badge/architecture-monorepo-orange.svg)

<div align="center">
  <img src="assets/hirefit-dashboard.png" alt="HireFit Dashboard" width="800" />
  <p><em>The HireFit Dashboard - AI-powered candidate screening</em></p>
</div>

## 📸 Screenshots

<div align="center">
  <table>
    <tr>
      <td align="center"><img src="assets/hirefit-login.png" alt="HireFit Login" width="260" /><br /><em>Sign in</em></td>
      <td align="center"><img src="assets/hirefit-dashboard.png" alt="HireFit Dashboard" width="260" /><br /><em>Dashboard</em></td>
      <td align="center"><img src="assets/hirefit-candidate-detail.png" alt="HireFit Candidate Analysis" width="260" /><br /><em>Candidate Analysis</em></td>
    </tr>
  </table>
</div>

## 🏗️ Architecture Overview

This project is structured as a Monorepo containing two distinct microservices:

1.  **Frontend (`/frontend`):**
    -   Built with **Next.js 16**, TypeScript, and Tailwind CSS.
    -   Provides a responsive Dashboard for HR managers, plus Login/Signup pages.
    -   Next.js API routes proxy requests to the backend (auth, analyze, status, analyses).
    -   Handles drag-and-drop uploads and real-time status polling.

2.  **Backend (`/backend`):**
    -   Built with **FastAPI** (Python 3.11+).
    -   **Auth:** Simple self-service HR accounts (signup/login), password-hashed (PBKDF2) and stored in Postgres; sessions use signed bearer tokens.
    -   **Asynchronous Engine:** Uses **Celery & Redis** to offload heavy AI processing.
    -   **Agentic Framework:** Powered by **Agno** (formerly Phidata) to orchestrate AI teams.
    -   **LLM:** Google Gemini (model id configured in `backend/app/agents.py`).
    -   **Observability:** Full trace management and **strict** Prompt Engineering via **Langfuse** — the worker fails fast if required prompts aren't published there.

## 📂 Repository Structure

```bash
agentic-hire/
├── frontend/                 # Next.js 16 Client Application
│   ├── app/
│   │   ├── page.tsx          # Dashboard (upload + results)
│   │   ├── login/            # Login page
│   │   ├── signup/           # Signup page
│   │   └── api/              # Proxy routes to the backend (auth, analyze, status, analyses)
│   ├── .env.local            # Frontend Environment Variables
│   └── README.md             # Specific Frontend Documentation
│
├── backend/                  # Python AI Microservice
│   ├── app/
│   │   ├── main.py           # FastAPI entrypoint & routes
│   │   ├── tasks.py          # Celery app + resume analysis task
│   │   ├── agents.py         # Agno agents/team, Gemini + Langfuse config
│   │   ├── auth.py           # Password hashing + bearer token auth
│   │   ├── database.py       # SQLAlchemy models (AnalysisResult, User)
│   │   └── schemas.py        # CandidateEvaluation output schema
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .venv/                # Virtual Environment
│   ├── .env                  # Backend Environment Variables
│   └── README.md             # Specific Backend Documentation
│
├── AGENTS.md                 # Notes for AI coding agents working in this repo
├── README.md                 # You are here
└── .gitignore                # Global gitignore
```

## 🚀 Quick Start Guide

To run the full system locally, you need to start the Backend (API + Worker) and the Frontend.

### Prerequisites

- Node.js 20+
- Python 3.11+
- Redis and PostgreSQL from **Railway** (or local Docker for testing)

### Environment Configuration 🔑

Before running the system, you must create environment files for both the backend and frontend.

#### Backend Environment (`.env`)

Create a `.env` file in the `backend/` directory with Railway credentials for **Redis** and **PostgreSQL**:

```bash
# backend/.env

# Google Gemini API Key
GOOGLE_API_KEY=your_gemini_api_key_here

# Railway PostgreSQL (obtain from Railway dashboard)
DATABASE_URL=postgresql://postgres:your_password@your_host.proxy.rlwy.net:port/railway

# Railway Redis (obtain from Railway dashboard)
REDIS_URL=redis://default:your_password@your_host.proxy.rlwy.net:port

# Langfuse (Observability & required prompt management - the worker crashes
# on startup if resume-parser-instructions, job-analyst-instructions, or
# hr-team-lead-instructions aren't published here)
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com

# Signs HR session tokens - required for login/signup to work, keep random and secret
AUTH_SECRET=some_random_secret_string
```

#### Frontend Environment (`.env.local`)

Create a `.env.local` file in the `frontend/` directory:

```bash
# frontend/.env.local

# Backend API URL
BACKEND_API_URL=http://localhost:8000
```

### Step 1: Start the Backend

(See `backend/README.md` for full details)

```bash
cd backend
# 1. Install dependencies
uv sync  # or pip install -r requirements.txt

# 2. Run the API Server (Terminal A)
uv run python -m app.main

# 3. Run the Celery Worker (Terminal B)
uv run celery -A app.tasks.celery_app worker --loglevel=info
# Windows: the default pool doesn't work, use --pool=solo instead
uv run celery -A app.tasks.celery_app worker --pool=solo --loglevel=info
```

### Step 2: Start the Frontend

(See `frontend/README.md` for full details)

```bash
cd frontend
# 1. Install dependencies
npm install

# 2. Run the Development Server
npm run dev
```

Visit http://localhost:3000, sign up for an HR account (self-service, stored in the `users` Postgres table), then log in to upload resumes.

## 🛠️ Technology Stack

| Component      | Technology                                    |
|----------------|-----------------------------------------------|
| Frontend       | Next.js 16, TypeScript, Tailwind CSS, Lucide React |
| Backend API    | FastAPI, Uvicorn                              |
| Auth           | Self-service HR accounts, PBKDF2 password hashing, signed bearer tokens |
| AI Agents      | Agno (Phidata), Google Gemini                 |
| Async Tasks    | Celery, Redis                                 |
| Database       | PostgreSQL, SQLAlchemy                        |
| Observability  | Langfuse (Tracing & Prompt Management)        |
| Deployment     | Vercel (Frontend), Railway (Backend)          |


