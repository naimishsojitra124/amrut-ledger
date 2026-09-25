import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { demoIsInUse, forgetVisitorActivity, recordVisitorRequest } from "./demo-reset.service";

const QUIET_PERIOD_MS = 10 * 60 * 1000;

describe("deferring the demo reseed while someone is using it", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    forgetVisitorActivity();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats a fresh instance as idle, so the first reseed is not held up", () => {
    expect(demoIsInUse()).toBe(false);
  });

  it("ignores uptime pings, which would otherwise defer the reseed for ever", () => {
    recordVisitorRequest("/health");
    recordVisitorRequest("/health/db");

    expect(demoIsInUse()).toBe(false);
  });

  it("counts a request a visitor actually makes", () => {
    recordVisitorRequest("/auth/refresh");

    expect(demoIsInUse()).toBe(true);
  });

  it("releases the hold once the demo has been quiet long enough", () => {
    recordVisitorRequest("/customers");
    expect(demoIsInUse()).toBe(true);

    vi.advanceTimersByTime(QUIET_PERIOD_MS - 1_000);
    expect(demoIsInUse()).toBe(true);

    vi.advanceTimersByTime(2_000);
    expect(demoIsInUse()).toBe(false);
  });

  it("does not let a later uptime ping extend the hold", () => {
    recordVisitorRequest("/customers");

    vi.advanceTimersByTime(QUIET_PERIOD_MS + 1_000);
    recordVisitorRequest("/health");

    expect(demoIsInUse()).toBe(false);
  });
});
