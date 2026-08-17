import { describe, expect, it, vi } from "vitest";
import { sendApiNotFoundJson } from "./vite";

describe("sendApiNotFoundJson", () => {
  it("returns a JSON 404 response for an unmatched API path", () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    sendApiNotFoundJson(
      { originalUrl: "/api/unavailable-route?batch=1" },
      { status, json } as never,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: "API route not found",
      path: "/api/unavailable-route?batch=1",
    });
  });
});
