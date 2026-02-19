import os
import warnings
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
import uvicorn

from src.agent import graph, workflow
from copilotkit import LangGraphAGUIAgent
from ag_ui_langgraph import add_langgraph_fastapi_endpoint

_ = load_dotenv()

agent = LangGraphAGUIAgent(
    name="sample_agent",
    description="An example agent to use as a starting point for your own agent.",
    graph=graph,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Swap in AsyncPostgresSaver once the event loop is running."""
    postgres_url = os.getenv("DATABASE_URL")
    if postgres_url:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

        async with AsyncPostgresSaver.from_conn_string(postgres_url) as checkpointer:
            await checkpointer.setup()
            agent.graph = workflow.compile(checkpointer=checkpointer)
            yield
    else:
        yield


app = FastAPI(lifespan=lifespan)

add_langgraph_fastapi_endpoint(
    app=app,
    agent=agent,
    path="/",
)


def main():
    """Run the uvicorn server."""
    port = int(os.getenv("PORT", "8123"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
    )


warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")
if __name__ == "__main__":
    main()
