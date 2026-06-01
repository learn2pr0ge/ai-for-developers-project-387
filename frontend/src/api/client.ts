import axios, { AxiosError } from 'axios';
import type { ErrorResponse } from '../types';

// Бэкенд раздаёт REST API под префиксом /api (см. backend app/__init__.py).
// VITE_API_URL задаёт полный базовый URL API, уже включая /api
// (dev: http://localhost:3000/api, docker: /api). Пути в src/api/* — без /api.
const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Нормализованная ошибка API: сохраняет HTTP-статус и человекочитаемое
 * сообщение, извлечённое из ErrorResponse (response.data.message).
 */
export class ApiError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function isErrorResponse(data: unknown): data is ErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof (data as Record<string, unknown>).message === 'string'
  );
}

// Централизованный перехват ошибок: вытаскиваем message из ErrorResponse.
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const data = error.response?.data;

    let message = error.message || 'Произошла ошибка сети';
    let code: string | undefined;

    if (isErrorResponse(data)) {
      message = data.message;
      code = data.code;
    }

    return Promise.reject(new ApiError(message, status, code));
  },
);
