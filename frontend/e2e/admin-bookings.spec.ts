import { test, expect } from '@playwright/test';
import {
  ensureEventType,
  fillGuestFormAndSubmit,
  gotoEventTypes,
  INTRO_CALL,
  pickFirstFreeSlot,
  selectCalendarDay,
  tomorrowUtc,
  uniqueEmail,
} from './helpers';

/**
 * Сценарий 2 — админ видит созданную бронь.
 * Сценарий 3 — админ отменяет бронь, строка исчезает.
 */

const EVENT_TYPE_NAME = INTRO_CALL.name;

// Хранилище бэкенда стартует пустым — создаём нужный тип события перед тестами.
test.beforeEach(async ({ page }) => {
  await ensureEventType(page);
});

/** Создаёт бронь через гостевой флоу и возвращает email гостя. */
async function createBooking(page: import('@playwright/test').Page): Promise<string> {
  const email = uniqueEmail('admin');
  await gotoEventTypes(page);
  await page.getByRole('button', { name: EVENT_TYPE_NAME }).click();
  await selectCalendarDay(page, tomorrowUtc());
  await pickFirstFreeSlot(page);
  await fillGuestFormAndSubmit(page, 'Гость Админский', email);
  await expect(page).toHaveURL(/\/booking-success$/);
  return email;
}

test('админ видит созданную бронь в таблице', async ({ page }) => {
  const email = await createBooking(page);

  await page.goto('/admin/bookings');
  await expect(
    page.getByRole('heading', { name: 'Бронирования', level: 1 }),
  ).toBeVisible();

  // Строка с email гостя присутствует, тип события — нужный.
  const row = page.getByRole('row').filter({ hasText: email });
  await expect(row).toBeVisible();
  await expect(row).toContainText(EVENT_TYPE_NAME);
  await expect(row).toContainText('Гость Админский');
});

test('админ отменяет бронь — строка исчезает', async ({ page }) => {
  const email = await createBooking(page);

  await page.goto('/admin/bookings');
  const row = page.getByRole('row').filter({ hasText: email });
  await expect(row).toBeVisible();

  // Отмена.
  await row.getByRole('button', { name: 'Отменить' }).click();

  // Тост подтверждения и исчезновение строки.
  await expect(page.getByText('Бронирование отменено')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: email })).toHaveCount(0);
});
