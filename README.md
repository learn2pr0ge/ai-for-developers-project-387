# Calendar Booking

Учебный fullstack-проект: бронирование встреч по слотам (в стиле Calendly).
Гость выбирает тип события и свободный слот, владелец управляет типами событий
и просматривает бронирования в админке.

Контракт REST API описан на TypeSpec в файле `api.tsp` (модели + эндпоинты)
и служит документацией API.

## Структура проекта

- **`api.tsp`** — контракт REST API на TypeSpec (модели + эндпоинты, документация).
- **`backend/`** — бэкенд на Flask (Python 3.11+), хранилище в памяти.
- **`frontend/`** — SPA на React 18 + TypeScript + Vite + TailwindCSS.

Фронтенд работает против бэкенда (`:3000`). Адрес API задаётся в `frontend/.env`
(`VITE_API_URL`).

> Данные бэкенда хранятся **в памяти** и сбрасываются при перезапуске.

## Требования

- [Docker](https://www.docker.com/) — для запуска в контейнере (продакшен-режим).
- Для локальной разработки: Node.js 20+, Python 3.11+, `make` (опционально).

## Быстрый старт (Docker)

Самый простой способ — собрать образ и запустить контейнер. Фронтенд и API
работают как одно приложение на одном порту.

```bash
make docker-build              # собрать образ
make docker-run                # запустить (по умолчанию порт 8080)
# либо задать порт вручную:
make docker-run PORT=3000
```

После запуска приложение доступно на `http://localhost:8080` (или на указанном
`PORT`). API доступно по префиксу `/api` того же адреса (например,
`http://localhost:8080/api/event-types`).

Без `make`:

```bash
docker build -t calendar-booking .
docker run --rm -e PORT=8080 -p 8080:8080 calendar-booking
```

Контейнер слушает порт из переменной окружения **`PORT`** и стартует
автоматически — это же используется при деплое и в автоматической проверке.

## Локальная разработка

Поднимите backend, затем фронтенд.

### 1. API (Flask, данные в памяти)

```bash
make install     # один раз: зависимости backend и frontend
make backend     # Flask на :3000
```

### 2. Фронтенд

```bash
make frontend    # Vite dev-сервер на :5173
```

Укажите адрес API в `frontend/.env` (см. `frontend/.env.example`):

```bash
VITE_API_URL=http://localhost:3000/api
```

### Ручные команды (без make)

```bash
# backend
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
PORT=3000 .venv/bin/python run.py

# frontend
cd frontend
npm install
npm run dev          # dev-сервер :5173
npm run build        # production-сборка в dist/
```

## Деплой

Приложение упаковано в один Docker-образ (`Dockerfile`), который:

- собирает фронтенд и кладёт статику внутрь образа;
- запускает Flask через gunicorn, отдавая и SPA, и API из одного процесса;
- слушает порт из переменной окружения `PORT`;
- стартует автоматически при запуске контейнера.

Этого достаточно для платформ вида Render / Railway / Fly.io: они задают
`PORT`, собирают образ по `Dockerfile` и выдают публичную ссылку.

## Команды make

```bash
make help          # список доступных команд
make install       # установить зависимости backend и frontend
make backend       # запустить Flask (:3000)
make frontend      # запустить Vite dev-сервер (:5173)
make build         # production-сборка фронтенда
make docker-build  # собрать Docker-образ
make docker-run    # запустить контейнер (PORT=8080 по умолчанию)
```
