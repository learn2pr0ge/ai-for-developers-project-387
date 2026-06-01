"""Точка входа: поднимает Flask-приложение.

Порт берётся из переменной окружения PORT (с откатом на FLASK_PORT и 3000).
PORT используется при деплое и в автоматической проверке проекта.
Хранилище — в памяти, после перезапуска данные сбрасываются.

В продакшене приложение запускается через WSGI-сервер (gunicorn), который
импортирует объект `app` из этого модуля: `gunicorn run:app`.
Прямой запуск `python run.py` поднимает встроенный dev-сервер Flask.
"""

import os

from app import create_app

app = create_app()


def _resolve_port() -> int:
    """Порт из PORT, иначе FLASK_PORT, иначе 3000."""
    raw = os.environ.get("PORT") or os.environ.get("FLASK_PORT") or "3000"
    return int(raw)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=_resolve_port())
