'use client';

/** Thin JSON fetch wrapper that surfaces the API's Thai error messages. */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `คำขอไม่สำเร็จ (${response.status})`;
    let code: string | undefined;
    try {
      const payload = (await response.json()) as { error?: string; code?: string };
      if (payload.error) message = payload.error;
      code = payload.code;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, response.status, code);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Uploads a file with progress reporting (fetch cannot report upload progress). */
export function uploadWithProgress<T>(options: {
  url: string;
  form: FormData;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', options.url);
    request.responseType = 'json';

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener('load', () => {
      const payload = request.response as { error?: string; code?: string } | null;
      if (request.status >= 200 && request.status < 300) {
        resolve(payload as T);
        return;
      }
      reject(
        new ApiError(
          payload?.error ?? `อัปโหลดไม่สำเร็จ (${request.status})`,
          request.status,
          payload?.code,
        ),
      );
    });

    request.addEventListener('error', () =>
      reject(new ApiError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ขณะอัปโหลด', 0)),
    );
    request.addEventListener('abort', () => reject(new ApiError('ยกเลิกการอัปโหลดแล้ว', 0)));

    options.signal?.addEventListener('abort', () => request.abort());
    request.send(options.form);
  });
}
