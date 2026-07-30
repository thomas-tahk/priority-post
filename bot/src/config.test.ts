import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "./config.js";

const REQUIRED = {
  DISCORD_BOT_TOKEN: "token",
  DISCORD_CHANNEL_ID: "channel",
  OWNER_DISCORD_ID: "owner",
  WEB_BASE_URL: "https://example.test/",
  INTERNAL_API_SECRET: "secret",
  ANTHROPIC_API_KEY: "key",
};

const TUNABLE = ["DIGEST_HOUR", "DIGEST_MINUTE", "ACTIVE_START_HOUR", "ACTIVE_END_HOUR"];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of [...Object.keys(REQUIRED), ...TUNABLE]) saved[k] = process.env[k];
  Object.assign(process.env, REQUIRED);
  for (const k of TUNABLE) delete process.env[k];
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("loadConfig digest minute", () => {
  it("reads a valid minute", () => {
    process.env.DIGEST_MINUTE = "45";
    expect(loadConfig().digestMinute).toBe(45);
  });

  it("defaults to 0 when unset", () => {
    expect(loadConfig().digestMinute).toBe(0);
  });

  it("falls back to 0 when out of range", () => {
    process.env.DIGEST_MINUTE = "99";
    expect(loadConfig().digestMinute).toBe(0);
  });

  it("falls back to 0 when not a number", () => {
    process.env.DIGEST_MINUTE = "quarter-to";
    expect(loadConfig().digestMinute).toBe(0);
  });
});

describe("loadConfig active hours", () => {
  it("defaults to the 16:00-22:00 evening window", () => {
    const c = loadConfig();
    expect(c.activeStartHour).toBe(16);
    expect(c.activeEndHour).toBe(22);
  });

  it("reads valid overrides", () => {
    process.env.ACTIVE_START_HOUR = "17";
    process.env.ACTIVE_END_HOUR = "23";
    const c = loadConfig();
    expect(c.activeStartHour).toBe(17);
    expect(c.activeEndHour).toBe(23);
  });

  it("falls back to defaults when out of range", () => {
    process.env.ACTIVE_START_HOUR = "-3";
    process.env.ACTIVE_END_HOUR = "24";
    const c = loadConfig();
    expect(c.activeStartHour).toBe(16);
    expect(c.activeEndHour).toBe(22);
  });
});
