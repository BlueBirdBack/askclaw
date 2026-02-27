from contextlib import asynccontextmanager

from fastapi import FastAPI

from .db import init_db
from .routers import categories, chats, files, password, search, tags


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="AskClaw", lifespan=lifespan)

app.include_router(chats.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(tags.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(password.router, prefix="/api")
app.include_router(files.router, prefix="/api")
