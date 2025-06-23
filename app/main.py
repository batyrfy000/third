from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import os

from . import models, database, users, messages

# Создание таблиц в БД
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Лучше указать адрес фронтенда, если будет деплой
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Путь к директории с фронтендом
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))


# Подключение статических файлов, если директория существует
if os.path.isdir(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

    # Отдача chat.html при переходе на /
    @app.get("/")
    async def serve_chat():
        return FileResponse(os.path.join(frontend_dir, "chat.html"))
else:
    print(f"[WARNING] ❌ Директория фронтенда не найдена: {frontend_dir}")

# Подключение роутеров
app.include_router(users.router)
app.include_router(messages.router)
