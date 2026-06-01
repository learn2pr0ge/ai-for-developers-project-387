import { defineConfig, devices } from '@playwright/test';

/**
 * Конфигурация e2e-тестов (Playwright).
 *
 * Тесты гоняют реальный стек: Flask-бэкенд (:3000, in-memory) + Vite-фронтенд
 * (:5173), браузер — Chromium. Оба сервера поднимаются автоматически через
 * `webServer` перед прогоном.
 *
 * Бэкенд stateful и не сбрасывается между тестами, поэтому:
 *   - `workers: 1` — тесты идут последовательно, без гонок за слоты;
 *   - каждый тест создаёт бронь с уникальным email и не зависит от порядка.
 */

const FRONTEND_PORT = 5173;
const BACKEND_PORT = 3000;
const BASE_URL = `http://localhost:${FRONTEND_PORT}`;
const API_URL = `http://localhost:${BACKEND_PORT}`;

export default defineConfig({
  testDir: './e2e',
  // Стабильность важнее скорости: общий стейт бэкенда -> один воркер.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],

  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Браузер отображает время в UTC, чтобы совпадать с UTC-сеткой слотов
    // бэкенда и фронтенда (см. app/domain/slots.py и src/lib/slots.ts).
    timezoneId: 'UTC',
    locale: 'ru-RU',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      // Бэкенд: авто-установка зависимостей + запуск Flask.
      command: 'bash ./e2e/scripts/start-backend.sh',
      env: { FLASK_PORT: String(BACKEND_PORT) },
      url: `${API_URL}/api/event-types`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // Фронтенд: Vite dev-сервер, направленный на реальный бэкенд.
      // VITE_API_URL — полный базовый URL API (origin + /api), как в проде.
      command: 'npm run dev',
      env: { VITE_API_URL: `${API_URL}/api` },
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
