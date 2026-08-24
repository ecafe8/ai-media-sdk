import { describe, expect, test } from "bun:test";

import { PATCH as PATCH_BY_ID } from "./[id]/route";
import { PATCH } from "./route";

describe("voice design route", () => {
  test("rejects design updates without dispatch", async () => {
    const response = await PATCH();
    expect(response.status).toBe(405);
    expect((await response.json()).error.code).toBe("INVALID_REQUEST");
  });

  test("rejects updates on a design resource", async () => {
    const response = await PATCH_BY_ID();
    expect(response.status).toBe(405);
    expect((await response.json()).error.code).toBe("INVALID_REQUEST");
  });
});
