import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

type WorkerHandlers = Record<string, (event: Record<string, unknown>) => void>;

function loadWorker() {
  const handlers: WorkerHandlers = {};
  const addAll = vi.fn(async (_assets: string[]) => undefined);
  const cache = {
    addAll,
    delete: vi.fn(async () => true),
    keys: vi.fn(async () => []),
    match: vi.fn(async () => undefined),
    put: vi.fn(async () => undefined),
  };
  const caches = {
    delete: vi.fn(async () => true),
    keys: vi.fn(async () => []),
    match: vi.fn(async () => undefined),
    open: vi.fn(async () => cache),
  };
  const self = {
    addEventListener(type: string, handler: WorkerHandlers[string]) {
      handlers[type] = handler;
    },
    clients: { claim: vi.fn(async () => undefined) },
    location: { origin: "https://dashadspro.cloud" },
    registration: { showNotification: vi.fn(async () => undefined) },
    skipWaiting: vi.fn(),
  };

  const source = readFileSync(resolve("public/sw.js"), "utf8");
  vm.runInNewContext(source, {
    URL,
    Response,
    caches,
    clients: self.clients,
    fetch: vi.fn(async () => new Response("ok", { status: 200 })),
    self,
  });

  return { addAll, handlers };
}

function dispatchFetch(
  handler: WorkerHandlers[string],
  url: string,
  mode: RequestMode = "cors",
) {
  const respondWith = vi.fn();
  handler({
    request: { method: "GET", mode, url },
    respondWith,
  });
  return respondWith;
}

describe("service worker cache boundaries", () => {
  it.each([
    ["Meta API response", "https://dashadspro.cloud/api/meta/insights", "cors"],
    ["authenticated session", "https://dashadspro.cloud/api/auth/me", "cors"],
    ["dashboard navigation", "https://dashadspro.cloud/dashboard", "navigate"],
    ["Meta creative", "https://scontent.fbcdn.net/private-creative.jpg", "cors"],
  ])("does not intercept %s", (_label, url, mode) => {
    const { handlers } = loadWorker();
    const respondWith = dispatchFetch(handlers.fetch, url, mode as RequestMode);

    expect(respondWith).not.toHaveBeenCalled();
  });

  it("still caches immutable Next.js assets", () => {
    const { handlers } = loadWorker();
    const respondWith = dispatchFetch(
      handlers.fetch,
      "https://dashadspro.cloud/_next/static/chunks/app.js",
    );

    expect(respondWith).toHaveBeenCalledOnce();
  });

  it("does not pre-cache authenticated pages", async () => {
    const { addAll, handlers } = loadWorker();
    let installWork: Promise<unknown> | undefined;
    handlers.install({
      waitUntil(value: Promise<unknown>) {
        installWork = value;
      },
    });
    await installWork;

    const assets = addAll.mock.calls[0]?.[0] as unknown as string[];
    expect(assets).not.toContain("/");
    expect(assets).not.toContain("/dashboard");
  });
});
