# AGENTS.md

Инструкции для AI-агентов, работающих в этом репозитории.

## О проекте

Calendar Booking — учебный fullstack-проект (бронирование встреч по слотам,
в стиле Calendly). Контракт REST API описан на TypeSpec в `api.tsp` и служит
документацией. Состоит из частей:

- `api.tsp` — контракт REST API на TypeSpec (модели + эндпоинты, документация).
- `backend/` — бэкенд на Flask (Python 3.11+), хранилище в памяти (`:3000`).
- `frontend/` — React 18 + TypeScript + Vite + TailwindCSS SPA (dev на `:5173`).

Фронтенд работает против `backend/` (`:3000`) — адрес задаётся в `frontend/.env`
(`VITE_API_URL`).

## Команды

Backend (Flask, данные в памяти, сбрасываются при перезапуске):

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
FLASK_PORT=3000 .venv/bin/python run.py   # API на :3000, CORS включён
```

Frontend:

```bash
cd frontend && npm install
npm run dev      # Vite dev-сервер на :5173
npm run build    # tsc -b && vite build
npm run preview
```

Порядок запуска: поднять backend (`:3000`), затем frontend. Адрес API берётся
из `frontend/.env` → `VITE_API_URL`.

## Архитектура и поток данных

Frontend: `src/api/` (axios-запросы) → `src/hooks/` (react-query) →
`src/pages/` / `src/components/`. Два флоу:

- Гостевой: `/`, `/event-types`, `/book/:eventTypeId`, `/booking-success`.
- Админский: `/admin/*` (bookings, event-types).

Backend (Flask): `app/__init__.py` (`create_app`, CORS, blueprints, error
handlers) → `app/routes/` (по группам контракта) → `app/domain/` (модели,
`slots.py` — генерация слотов/конфликты) → `app/store.py` (in-memory dict,
стартует пустым). Ошибки — через `ApiError` (`app/errors.py`) в формате `ErrorResponse`
(`{code, message}`). Даты — UTC-aware, в JSON отдаются ISO 8601 с суффиксом `Z`.
Рабочие часы слотов и окно бронирования — в UTC (см. `app/domain/slots.py`).

## Конвенции стека

- Данные с сервера — только через `@tanstack/react-query` hooks в `src/hooks/`;
  сами запросы — в `src/api/`.
- HTTP — через `apiClient` (axios) из `src/api/client.ts`; ошибки нормализуются
  в `ApiError` (поля `status`, `code`).
- Формы — `react-hook-form` + `zod`. Даты — `date-fns`. UI — Tailwind.
  Тосты — `sonner`. Иконки — `lucide-react`.
- Не добавлять новые зависимости без необходимости.

## Правила для агентов

- **Синхронизация типов:** при изменении `api.tsp` обновлять
  `frontend/src/types/index.ts` и backend (`app/domain/`, сериализацию,
  валидацию). `types/` вручную зеркалит модели контракта — всё должно совпадать.
- **Не коммитить генерируемое:** любые `node_modules`, `*.tsbuildinfo`, `.env`,
  артефакты сборки. Всё это в `.gitignore`/`.dockerignore` — оставить так.
- **Соблюдать стек и стиль** (см. раздел выше).
- После правок фронтенда проверять сборкой: `cd frontend && npm run build`
  (включает `tsc -b`). Это единственная проверка — тестов и линтера в проекте нет.

## Заметки

- Аутентификации нет; админка отделена только префиксом `/admin`.
- Окно бронирования — 14 дней. Рабочие часы сетки слотов настраиваются на
  каждый тип события (`workStartTime`/`workEndTime`, формат `HH:MM`, дефолт
  09:00–18:00). Флаг `available24h` включает круглосуточный режим (00:00–24:00) —
  тогда часы игнорируются, а в форме скрывается их выбор. Backend считает время в
  **UTC** (`app/domain/slots.py`), фронтенд строит сетку по локальному времени
  браузера (`frontend/src/lib/slots.ts`) — при таймзоне браузера ≠ UTC отметки
  доступности могут визуально расходиться.
- **Только один процесс-воркер.** Хранилище in-memory (`app/store.py`) живёт в
  памяти процесса, у каждого воркера своя копия. Поэтому в `Dockerfile` gunicorn
  запускается с `--workers 1` (конкурентность — через `--threads`). Не повышать
  число воркеров: при >1 запросы round-robin'ятся между процессами, и созданные
  сущности видны не на каждом обновлении (нужно несколько refresh).
