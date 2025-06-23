from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import os
from . import models, database, users, messages

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # во фронте можно ограничить
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Раздача статических файлов (если понадобятся)
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend'))
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

# Отдача chat.html как корневой страницы
@app.get("/")
def root():
    return FileResponse(os.path.join(frontend_dir, "chat.html"))

app.include_router(users.router)
app.include_router(messages.router)
