/**
 * Mock estático de "next/server" para testes Vitest.
 * NextResponse.json devolve um objecto simples com body e status.
 */
import { vi } from "vitest";

export const NextResponse = {
  json: vi.fn((body: unknown, init?: { status?: number }) => ({
    _body:  body,
    status: init?.status ?? 200,
  })),
  redirect: vi.fn((url: string) => ({ _redirect: url, status: 302 })),
  next:     vi.fn(() => ({ _next: true })),
};

export class NextRequest {
  url:     string;
  method:  string;
  headers: Headers;

  constructor(url: string, init?: RequestInit) {
    this.url     = url;
    this.method  = init?.method ?? "GET";
    this.headers = new Headers(init?.headers as HeadersInit);
  }

  async json() { return {}; }
}
