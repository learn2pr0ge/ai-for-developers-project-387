import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';
import { useEventType } from '../../hooks/useEventTypes';
import { useSlots } from '../../hooks/useSlots';
import { useSlotCounts } from '../../hooks/useSlotCounts';
import { useCreateBooking } from '../../hooks/useBookings';
import { DateStrip } from '../../components/DateStrip';
import { SlotGrid } from '../../components/SlotGrid';
import {
  GuestBookingForm,
  type GuestBookingFormValues,
} from '../../components/GuestBookingForm';
import {
  buildDayGrid,
  toApiDate,
  type GridSlot,
} from '../../lib/slots';
import { formatDuration, getErrorMessage } from '../../lib/format';
import { ApiError } from '../../api/client';

export function SlotPickerPage() {
  const { eventTypeId } = useParams<{ eventTypeId: string }>();
  const navigate = useNavigate();

  const { data: eventType, isLoading: isEventLoading, isError } = useEventType(
    eventTypeId,
  );

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<GridSlot | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const apiDate = selectedDate ? toApiDate(selectedDate) : undefined;
  const { data: slots, isLoading: isSlotsLoading } = useSlots(eventTypeId, apiDate);
  const { freeCounts } = useSlotCounts(eventTypeId);
  const createBooking = useCreateBooking();

  // Полная сетка 09:00–18:00 с шагом duration для выбранного дня.
  const dayGrid = useMemo<GridSlot[]>(() => {
    if (!selectedDate || !eventType || !slots) return [];
    return buildDayGrid(
      selectedDate,
      eventType.duration,
      slots,
      eventType.workStartTime,
      eventType.workEndTime,
      eventType.available24h,
    );
  }, [selectedDate, eventType, slots]);

  // Сброс выбора слота/формы при смене даты.
  useEffect(() => {
    setSelectedSlot(null);
    setShowForm(false);
    setServerError(null);
  }, [selectedDate]);

  const handleSelectDate = (day: Date) => {
    setSelectedDate(startOfDay(day));
  };

  const handleSelectSlot = (slot: GridSlot) => {
    setSelectedSlot(slot);
    setShowForm(false);
    setServerError(null);
  };

  const handleContinue = () => {
    if (!selectedSlot) return;
    setShowForm(true);
  };

  const handleBack = () => {
    if (showForm) {
      setShowForm(false);
      return;
    }
    setSelectedSlot(null);
    setSelectedDate(null);
  };

  const handleSubmit = (values: GuestBookingFormValues) => {
    if (!eventType || !selectedSlot) return;
    setServerError(null);

    createBooking.mutate(
      {
        eventTypeId: eventType.id,
        guestName: values.guestName,
        guestEmail: values.guestEmail,
        startTime: selectedSlot.startTimeIso,
      },
      {
        onSuccess: (booking) => {
          navigate('/booking-success', { state: { booking } });
        },
        onError: (error) => {
          const status = error instanceof ApiError ? error.status : undefined;
          if (status === 409) {
            toast.error('Этот слот только что был занят, выберите другой');
            // Слот занят — убираем выбор, обновлённые слоты подтянутся инвалидацией.
            setSelectedSlot(null);
            setShowForm(false);
          } else if (status === 422) {
            setServerError(getErrorMessage(error, 'Ошибка валидации'));
          } else {
            toast.error(getErrorMessage(error, 'Не удалось забронировать'));
          }
        },
      },
    );
  };

  if (isError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Тип события не найден.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
        {isEventLoading ? 'Загрузка…' : eventType?.name}
      </h1>

      <div className="mt-6 grid gap-5 lg:grid-cols-[18rem_1fr_20rem]">
        {/* Левая колонка — сводка */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {eventType && (
            <>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold text-ink-900">{eventType.name}</h2>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-ink-500">
                  {formatDuration(eventType.duration)}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-500">{eventType.description}</p>

              <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-ink-400">Выбранная дата</p>
                <p className="mt-0.5 text-sm font-medium text-ink-900">
                  {selectedDate
                    ? format(selectedDate, 'EEEE, d MMMM', { locale: ru })
                    : 'Дата не выбрана'}
                </p>
              </div>

              <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-ink-400">Выбранное время</p>
                <p className="mt-0.5 text-sm font-medium text-ink-900">
                  {selectedSlot ? selectedSlot.label : 'Время не выбрано'}
                </p>
              </div>
            </>
          )}
        </aside>

        {/* Центр — календарь */}
        <DateStrip
          selectedDate={selectedDate}
          onSelect={handleSelectDate}
          freeCounts={freeCounts}
        />

        {/* Правая колонка — статус слотов + форма */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-ink-900">
            Статус слотов{' '}
            <span className="text-xs font-medium text-ink-400">(UTC)</span>
          </h2>

          <div className="mt-4">
            {!selectedDate ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-ink-500">
                Выберите дату в календаре.
              </div>
            ) : showForm ? (
              <GuestBookingForm
                onSubmit={handleSubmit}
                isSubmitting={createBooking.isPending}
                serverError={serverError}
              />
            ) : (
              <>
                <div className="max-h-[22rem] overflow-y-auto pr-1">
                  <SlotGrid
                    slots={dayGrid}
                    selectedIso={selectedSlot?.startTimeIso ?? null}
                    onSelect={handleSelectSlot}
                    isLoading={isSlotsLoading}
                  />
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-ink-900 transition-colors hover:bg-slate-50"
                  >
                    Назад
                  </button>
                  <button
                    type="button"
                    onClick={handleContinue}
                    disabled={!selectedSlot}
                    className="flex-1 rounded-xl bg-brand-400 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Продолжить
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
