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

export type Debounced<T extends (...args: never[]) => unknown> = ((
  ...args: Parameters<T>
) => void) & {
  flush: () => ReturnType<T> | undefined;
  cancel: () => void;
};

export function debounce<T extends (...args: never[]) => unknown>(
  fn: T,
  delay = 500
): Debounced<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let pending: Parameters<T> | undefined;
  const run = () => {
    if (!pending) return undefined;
    const args = pending;
    pending = undefined;
    timeout = undefined;
    return fn(...args) as ReturnType<T>;
  };
  const debounced = (...args: Parameters<T>) => {
    clearTimeout(timeout);
    pending = args;
    timeout = setTimeout(run, delay);
  };
  debounced.flush = () => {
    clearTimeout(timeout);
    return run();
  };
  debounced.cancel = () => {
    clearTimeout(timeout);
    timeout = undefined;
    pending = undefined;
  };
  return debounced;
}
