export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set('content-type', 'application/json');
  const response = await fetch(url, { ...init, headers });
  const type = response.headers.get('content-type') ?? '';
  const payload = type.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    throw new ApiError(
      payload?.message ?? payload?.error ?? `Request mislukt (${response.status}).`,
      response.status
    );
  }
  return payload as T;
}

export function debounce<T extends (...args: never[]) => unknown>(fn: T, delay = 500) {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}
