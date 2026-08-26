import { error, json, type RequestEvent } from '@sveltejs/kit';
import type { ZodType } from 'zod';

export function requireUser(event: RequestEvent) {
  if (!event.locals.user) error(401, 'Log in om verder te gaan.');
  return event.locals.user;
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    error(400, 'Ongeldige JSON.');
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    return error(422, result.error.issues[0]?.message ?? 'Ongeldige invoer.');
  }
  return result.data;
}

export function ok<T>(data: T, init: ResponseInit = {}) {
  return json(data, { status: 200, ...init });
}

export function created<T>(data: T) {
  return json(data, { status: 201 });
}
