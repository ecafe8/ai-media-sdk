/**
 * Minimal `window`/`localStorage` mock for bun (node) tests.
 *
 * The key store guards every browser API behind `typeof window ===
 * "undefined"`, so installing a fake `globalThis.window` lets tests exercise
 * the persistence, sanitization, and endpoint-validation paths without a
 * real DOM.
 */

export interface MockWindow {
  readonly store: Record<string, string>;
}

export function installMockWindow(): MockWindow {
  const store: Record<string, string> = {};

  const localStorage = {
    getItem(key: string): string | null {
      return store[key] ?? null;
    },
    setItem(key: string, value: string): void {
      store[key] = String(value);
    },
    removeItem(key: string): void {
      delete store[key];
    },
    clear(): void {
      for (const key of Object.keys(store)) delete store[key];
    },
  };

  (globalThis as unknown as { window: unknown }).window = {
    localStorage,
    addEventListener(): void {},
    removeEventListener(): void {},
  };

  return { store };
}

export function uninstallMockWindow(): void {
  delete (globalThis as unknown as { window?: unknown }).window;
}
