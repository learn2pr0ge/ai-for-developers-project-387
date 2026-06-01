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
 * Сценарий 1 — основной путь бронирования (guest), от начала до конца.
 * Сценарий 4 — негатив: после брони слот становится «Занято» (double-book).
 *
 * Гоняются против реального Flask-бэкенда (:3000), который персистит брони
 * и пересчитывает слоты — поэтому путь действительно проходит end-to-end.
 */

const EVENT_TYPE_NAME = INTRO_CALL.name;

// Хранилище бэкенда стартует пустым — создаём нужный тип события перед тестами.
test.beforeEach(async ({ page }) => {
  await ensureEventType(page);
});

test('гость бронирует слот: лендинг → выбор слота → успех', async ({ page }) => {
  const guestName = 'Иван Тестовый';
  const guestEmail = uniqueEmail('happy');

  // Лендинг → список типов событий.
  await gotoEventTypes(page);

  // Выбор типа события.
  await page.getByRole('button', { name: EVENT_TYPE_NAME }).click();
  await expect(page).toHaveURL(/\/book\/intro-call$/);
  await expect(
    page.getByRole('heading', { name: EVENT_TYPE_NAME, level: 1 }),
  ).toBeVisible();

  // Выбор завтрашнего дня и первого свободного слота.
  await selectCalendarDay(page, tomorrowUtc());
  const slotLabel = await pickFirstFreeSlot(page);

  // Сводка слева отражает выбранное время.
  await expect(page.getByText(slotLabel)).toBeVisible();

  // Заполнение формы и подтверждение.
  await fillGuestFormAndSubmit(page, guestName, guestEmail);

  // Страница успеха.
  await expect(page).toHaveURL(/\/booking-success$/);
  await expect(
    page.getByRole('heading', { name: 'Бронирование подтверждено' }),
  ).toBeVisible();
  await expect(page.getByText(EVENT_TYPE_NAME)).toBeVisible();
  await expect(page.getByText(guestName)).toBeVisible();
  await expect(page.getByText(guestEmail)).toBeVisible();
});

test('забронированный слот становится «Занято» при повторном заходе', async ({
  page,
}) => {
  const guestEmail = uniqueEmail('double');

  // --- Бронируем слот ---
  await gotoEventTypes(page);
  await page.getByRole('button', { name: EVENT_TYPE_NAME }).click();
  await selectCalendarDay(page, tomorrowUtc());
  const bookedLabel = await pickFirstFreeSlot(page);
  await fillGuestFormAndSubmit(page, 'Гость Двойной', guestEmail);
  await expect(page).toHaveURL(/\/booking-success$/);

  // --- Возвращаемся к тому же типу и дню ---
  await gotoEventTypes(page);
  await page.getByRole('button', { name: EVENT_TYPE_NAME }).click();
  await selectCalendarDay(page, tomorrowUtc());

  // Тот же слот теперь занят: помечен «Занято» и некликабелен.
  const bookedRow = page
    .locator('div', { hasText: bookedLabel })
    .filter({ hasText: 'Занято' })
    .first();
  await expect(bookedRow).toBeVisible();

  // И этого слота больше нет среди кликабельных «Свободно».
  const stillFree = page
    .getByRole('button')
    .filter({ hasText: 'Свободно' })
    .filter({ hasText: bookedLabel });
  await expect(stillFree).toHaveCount(0);
});
