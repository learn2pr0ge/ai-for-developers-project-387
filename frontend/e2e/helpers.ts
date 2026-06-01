import { expect, type Page } from '@playwright/test';

/**
 * Утилиты для e2e-сценариев бронирования.
 *
 * Время везде трактуется как UTC: браузер в тестах работает с timezoneId:'UTC'
 * (см. playwright.config.ts), а бэкенд и фронтенд строят сетку слотов в UTC.
 * Поэтому «локальный» день в браузере совпадает с UTC-днём.
 */

/**
 * Базовый URL API для прямых запросов из тестов (origin + /api).
 * VITE_API_URL уже включает префикс /api (см. playwright.config.ts), поэтому
 * пути ниже добавляются без повторного /api.
 */
const API_BASE = process.env.VITE_API_URL ?? 'http://localhost:3000/api';

/** Тип события, на котором строятся e2e-сценарии. */
export const INTRO_CALL = {
  id: 'intro-call',
  name: 'Вводный звонок',
  description: '30-минутное знакомство',
  duration: 30,
};

/**
 * Идемпотентно создаёт тип события через admin API.
 *
 * Хранилище бэкенда стартует пустым, поэтому перед сценариями нужно создать
 * тип события самим тестом. 409 (уже существует) игнорируется — это покрывает
 * переиспользование backend между локальными прогонами (reuseExistingServer).
 *
 * Запрос идёт абсолютным URL на backend (:3000): page.request использует
 * baseURL фронтенда (:5173), поэтому путь нельзя оставлять относительным.
 */
export async function ensureEventType(page: Page, et = INTRO_CALL): Promise<void> {
  const res = await page.request.post(`${API_BASE}/admin/event-types`, {
    data: et,
  });
  if (!res.ok() && res.status() !== 409) {
    throw new Error(
      `ensureEventType failed: ${res.status()} ${await res.text()}`,
    );
  }
}

/** Завтрашний день в UTC — гарантированно внутри окна 14 дней и без «прошедших» слотов. */
export function tomorrowUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );
}

/** Уникальный email на каждый прогон — чтобы тесты не зависели друг от друга. */
export function uniqueEmail(prefix = 'guest'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}@example.com`;
}

/** Открывает список типов событий через лендинг. */
export async function gotoEventTypes(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: 'Записаться' }).first().click();
  await expect(page).toHaveURL(/\/event-types$/);
}

/**
 * На странице выбора слота кликает по дню в календаре.
 * Выбираем по числу месяца (день должен быть видим и активен в текущем месяце).
 */
export async function selectCalendarDay(page: Page, day: Date): Promise<void> {
  const dayNumber = String(day.getUTCDate());
  // Кнопки-дни активны (enabled) только внутри окна бронирования.
  const dayButton = page
    .getByRole('button', { name: new RegExp(`^${dayNumber}(\\s|$)`) })
    .and(page.locator('button:not([disabled])'))
    .first();
  await dayButton.click();
}

/**
 * Выбирает первый свободный слот дня и нажимает «Продолжить».
 * Возвращает подпись выбранного слота (напр. "09:00 - 09:30").
 */
export async function pickFirstFreeSlot(page: Page): Promise<string> {
  const freeSlot = page.getByRole('button').filter({ hasText: 'Свободно' }).first();
  await expect(freeSlot).toBeVisible();
  const label = (await freeSlot.innerText()).split('\n')[0].trim();
  await freeSlot.click();
  await page.getByRole('button', { name: 'Продолжить' }).click();
  return label;
}

/** Заполняет гостевую форму и подтверждает бронирование. */
export async function fillGuestFormAndSubmit(
  page: Page,
  name: string,
  email: string,
): Promise<void> {
  await page.getByLabel('Имя гостя').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Подтвердить бронирование' }).click();
}
