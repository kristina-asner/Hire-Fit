import os
import sys
import base64
import logging
from dotenv import load_dotenv
from langfuse import Langfuse  # Import the Langfuse SDK

# Windows consoles often default to a non-UTF-8 codepage (e.g. cp1255), which
# crashes on the emoji used in this module's print()/logger calls. Force UTF-8
# so startup doesn't die before the server can bind to a port.
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Agno Imports
from agno.agent import Agent
from agno.team import Team
from agno.models.google import Gemini
from agno.db.postgres import PostgresDb

# Local Imports
from app.database import DATABASE_URL
from app.schemas import CandidateEvaluation

# OpenTelemetry / Tracing Imports
from openinference.instrumentation.agno import AgnoInstrumentor
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

load_dotenv()

# --- Logger Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Langfuse & Tracing Configuration ---
public_key = os.getenv("LANGFUSE_PUBLIC_KEY")
secret_key = os.getenv("LANGFUSE_SECRET_KEY")
langfuse_host = os.getenv("LANGFUSE_BASE_URL")

if not public_key or not secret_key:
    logger.warning("⚠️ Warning: Langfuse keys missing. Tracing skipped.")
else:
    # 1. Create Auth Header for OTEL
    LANGFUSE_AUTH = base64.b64encode(
        f"{public_key}:{secret_key}".encode()
    ).decode()

    # 2. Configure OTEL Endpoint
    otel_endpoint = f"{langfuse_host.rstrip('/')}/api/public/otel"
    os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = otel_endpoint
    os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"Authorization=Basic {LANGFUSE_AUTH}"

    # 3. Setup Tracer Provider
    tracer_provider = TracerProvider()
    tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter()))
    trace_api.set_tracer_provider(tracer_provider=tracer_provider)

    # 4. Instrument Agno
    AgnoInstrumentor().instrument()
    logger.info(f"✅ Langfuse Tracing Enabled on host: {langfuse_host}")

# --- Langfuse Client Initialization ---
langfuse = Langfuse()


def get_prompt_content(prompt_name: str) -> str:
    """
    Strict function to fetch a prompt from Langfuse.
    NO FALLBACK: If fetching fails, this will raise an exception and stop the worker.
    This ensures we only ever use the managed prompts.
    """
    try:
        # Fetch the production version of the prompt
        prompt = langfuse.get_prompt(prompt_name)

        # Log success for verification
        logger.info(f"✨ Successfully loaded prompt '{prompt_name}' from Langfuse")

        # Compile returns the final string
        return prompt.compile()
    except Exception as e:
        # Critical error logging before crashing
        logger.critical(f"❌ CRITICAL ERROR: Failed to fetch prompt '{prompt_name}' from Langfuse.")
        logger.critical("Check your API Keys and Prompt Names in Langfuse Dashboard.")
        raise e  # Re-raise the exception to crash the task/worker


print("🚀 Starting Agent with Langfuse Tracking & Strict Prompt Management...")

# --- Database for Agent Sessions ---
agent_db = PostgresDb(
    db_url=DATABASE_URL,
    session_table="agent_sessions",
)

# --- Model Configuration ---
# Gemini 3 Flash: Very fast, cheap, and suitable for Scale work
#model_fast = Gemini(id="gemini-3-flash-preview")

# Gemini 3 Pro: The smart model, with huge context window and high inference capabilities
#model_reasoning = Gemini(id="gemini-3-pro-preview")

# --- Model Configuration ---
api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")


#past version delete this when the new works
#model_fast = Gemini(id="gemini-1.5-flash", api_key=api_key)
#model_reasoning = Gemini(id="gemini-1.5-pro", api_key=api_key)

model_fast = Gemini(id="gemini-3.5-flash-lite", api_key=api_key)
model_reasoning = Gemini(id="gemini-3.5-flash-lite", api_key=api_key)

# --- Agents Configuration ---

# 1. Resume Parser Agent
# This will crash immediately on startup if the prompt is missing
resume_instructions = get_prompt_content("resume-parser-instructions")

resume_parser = Agent(
    id="resume-parser",
    name="Resume Parser",
    role="Extract details from candidate resumes",
    model=model_fast,
    instructions=[resume_instructions],
)

# 2. Job Analyst Agent
# This will crash immediately on startup if the prompt is missing
job_instructions = get_prompt_content("job-analyst-instructions")

job_analyst = Agent(
    id="job-analyst",
    name="Job Analyst",
    role="Analyze job descriptions",
    model=model_fast,
    instructions=[job_instructions],
)


# --- Team Configuration ---

def get_hr_team(session_id: str):
    """
    Creates the HR Team using a dynamic prompt for the Team Lead.
    """

    # Fetch Team Lead instructions dynamically
    # This will crash the specific task if the prompt cannot be fetched
    team_lead_instructions = get_prompt_content("hr-team-lead-instructions")

    return Team(
        name="HR Recruitment Team",
        members=[resume_parser, job_analyst],
        model=model_reasoning,
        db=agent_db,
        session_id=session_id,
        instructions=[team_lead_instructions],
        output_schema=CandidateEvaluation,
    )