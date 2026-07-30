/**
 * Mock estático de "next/headers" para testes Vitest.
 * Substitui o módulo real via alias em vitest.config.ts.
 * cookieStore é mutável pelos testes através de setMockCookie().
 */
import { vi } from "vitest";

let _cookieValue: string | undefined = undefined;

export function setMockCookie(value: string | undefined) {
  _cookieValue = value;
}

export const cookies = vi.fn(() =>
  Promise.resolve({
    get: vi.fn((_name: string) =>
      _cookieValue ? { name: _name, value: _cookieValue } : undefined
    ),
    set: vi.fn(),
    delete: vi.fn(),
  })
);

export const headers = vi.fn(() =>
  Promise.resolve(new Map<string, string>())
);
