import { describe, expect, test } from "bun:test";

import { PATCH } from "./route";

describe("voice design route", () => {
  test("rejects design updates without dispatch", async () => {
    const response = await PATCH();
    expect(response.status).toBe(405);
    expect((await response.json()).error.code).toBe("INVALID_REQUEST");
  });
});
