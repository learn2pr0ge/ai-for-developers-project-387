"""Фабрика приложения: CORS, blueprints, статика SPA, ошибки.

В продакшене один процесс отдаёт и REST API (под префиксом `/api`), и
собранную статику фронтенда (SPA). Каталог со сборкой задаётся переменной
окружения `FRONTEND_DIST` (по умолчанию `<repo>/frontend/dist`). Если сборки
нет (например, чистый dev-запуск backend отдельно) — раздача статики просто
отключается, API продолжает работать.
"""

from __future__ import annotations

import os
from pathlib import Path

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from .errors import register_error_handlers
from .routes import all_blueprints

# Все маршруты API живут под этим префиксом, чтобы не конфликтовать с
# клиентскими роутами SPA (например, /event-types и /admin/event-types
# существуют и как страницы фронтенда, и как эндпоинты API).
API_PREFIX = "/api"


def _frontend_dist() -> Path:
    """Путь к собранной статике фронтенда."""
    env = os.environ.get("FRONTEND_DIST")
    if env:
        return Path(env)
    # backend/app/__init__.py -> backend/app -> backend -> <repo>
    repo_root = Path(__file__).resolve().parent.parent.parent
    return repo_root / "frontend" / "dist"


def create_app() -> Flask:
    dist = _frontend_dist()
    serve_spa = (dist / "index.html").is_file()

    app = Flask(
        __name__,
        static_folder=str(dist) if serve_spa else None,
        static_url_path="/",
    )

    # CORS для отдельного фронтенд-клиента (dev — все origins).
    CORS(app)

    register_error_handlers(app)

    # API под префиксом /api.
    for bp in all_blueprints:
        app.register_blueprint(bp, url_prefix=API_PREFIX)

    if serve_spa:
        _register_spa(app, dist)

    return app


def _register_spa(app: Flask, dist: Path) -> None:
    """Раздача SPA: реальные файлы отдаём как есть, остальное — index.html.

    React Router работает на клиенте, поэтому при прямом заходе или
    перезагрузке на любом не-API пути нужно вернуть index.html.
    """

    @app.get("/")
    def _index():
        return send_from_directory(dist, "index.html")

    @app.get("/<path:path>")
    def _spa_fallback(path: str):
        # Пути API сюда не попадают (обрабатываются blueprints под /api).
        # Если запрошен реальный файл из сборки — отдаём его, иначе SPA.
        candidate = dist / path
        if candidate.is_file():
            return send_from_directory(dist, path)
        return send_from_directory(dist, "index.html")

    # Не-API 404 -> SPA (например, неизвестный путь в браузере).
    @app.errorhandler(404)
    def _spa_or_json_404(err):
        from flask import request

        if request.path.startswith(API_PREFIX):
            return (
                jsonify({"code": "not_found", "message": "Ресурс не найден"}),
                404,
            )
        return send_from_directory(dist, "index.html")
