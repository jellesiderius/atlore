import type { SessionUser } from '$lib/types';

declare global {
  const __ATLORE_BUILD__: string;

  namespace App {
    interface Locals {
      user: SessionUser | null;
      sessionId: string | null;
    }
    interface PageData {
      user?: SessionUser | null;
    }
  }
}

export {};
