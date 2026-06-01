.DEFAULT_GOAL := help

# Имя Docker-образа и порт по умолчанию для локального запуска контейнера.
IMAGE ?= calendar-booking
PORT ?= 8080

.PHONY: help install install-backend install-frontend backend frontend build docker-build docker-run

help: ## Показать список команд
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: install-backend install-frontend ## Установить зависимости backend и frontend

install-backend: ## Установить зависимости backend (venv + pip)
	cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

install-frontend: ## Установить зависимости frontend (npm ci)
	cd frontend && npm ci

backend: ## Запустить Flask backend (:3000)
	cd backend && PORT=3000 .venv/bin/python run.py

frontend: ## Запустить Vite dev-сервер (:5173)
	cd frontend && npm run dev

build: ## Production-сборка фронтенда
	cd frontend && npm run build

docker-build: ## Собрать Docker-образ
	docker build -t $(IMAGE) .

docker-run: ## Запустить контейнер (PORT=8080 по умолчанию)
	docker run --rm -e PORT=$(PORT) -p $(PORT):$(PORT) $(IMAGE)
