import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { listSlots } from '../api/slots';
import { slotKeys } from './useSlots';
import { buildBookingWindow, countAvailableForDay, toApiDate } from '../lib/slots';

/**
 * Загружает слоты для всех 14 дней окна бронирования и возвращает
 * агрегированные счётчики свободных слотов по дням.
 */
export function useSlotCounts(eventTypeId: string | undefined) {
  const windowDays = useMemo(() => buildBookingWindow(), []);

  const results = useQueries({
    queries: windowDays.map((day) => ({
      queryKey: slotKeys.list(eventTypeId ?? '', toApiDate(day)),
      queryFn: () => listSlots(eventTypeId as string, toApiDate(day)),
      enabled: Boolean(eventTypeId),
    })),
  });

  const freeCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    windowDays.forEach((day, i) => {
      const slots = results[i]?.data;
      if (slots) {
        counts[toApiDate(day)] = countAvailableForDay(slots, day);
      }
    });
    return counts;
  }, [results, windowDays]);

  const isLoading = results.some((r) => r.isLoading);

  return { freeCounts, isLoading };
}
