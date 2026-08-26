import { error, json, type RequestEvent } from '@sveltejs/kit';
import type { ZodType } from 'zod';
import { serverT } from '$lib/i18n/server';

export function requireUser(event: RequestEvent) {
  if (!event.locals.user) error(401, serverT('server.loginRequired'));
  return event.locals.user;
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    error(400, serverT('server.invalidJson'));
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = String(issue?.path[0] ?? '');
    if (issue?.code === 'invalid_format' && issue.format === 'email') {
      return error(422, serverT('server.validEmail'));
    }
    if (issue?.code === 'too_small' && field === 'name') {
      return error(422, serverT('server.nameMin'));
    }
    if (issue?.code === 'too_small' && field === 'password') {
      return error(422, serverT('server.passwordMin'));
    }
    return error(422, serverT('server.invalidInput'));
  }
  return result.data;
}

export function ok<T>(data: T, init: ResponseInit = {}) {
  return json(data, { status: 200, ...init });
}

export function created<T>(data: T) {
  return json(data, { status: 201 });
}
