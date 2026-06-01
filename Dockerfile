# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — сборка фронтенда (React + Vite -> статика)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend

WORKDIR /app/frontend

# Сначала зависимости — лучше кешируется.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Исходники и сборка. API живёт под /api того же origin,
# поэтому базовый URL клиента — относительный путь /api.
COPY frontend/ ./
ENV VITE_API_URL=/api
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — рантайм (Flask + gunicorn, отдаёт API и статику SPA)
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=3000 \
    FRONTEND_DIST=/app/frontend/dist

WORKDIR /app/backend

# Python-зависимости.
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Код backend.
COPY backend/ ./

# Собранная статика фронтенда из stage 1.
COPY --from=frontend /app/frontend/dist /app/frontend/dist

# Документируем порт (фактический берётся из $PORT в рантайме).
EXPOSE 3000

# Приложение стартует автоматически на 0.0.0.0:$PORT.
# `sh -c` нужен, чтобы подставить значение переменной окружения PORT.
# ВАЖНО: ровно ОДИН worker. Хранилище — in-memory (app/store.py), у каждого
# процесса-воркера своя копия данных. При нескольких воркерах запросы
# round-robin'ятся между процессами, и созданные сущности «мигают» (видны не
# на каждом обновлении). Конкурентность обеспечиваем потоками (--threads).
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT} --workers 1 --threads 4 run:app"]
