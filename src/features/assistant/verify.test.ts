import { describe, it, expect } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { verifySignature } from "./verify";

function freshKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  return { privateKey, publicKeyHex: raw.toString("hex") };
}

function signed(body: string, timestamp: string, privateKey: ReturnType<typeof freshKeypair>["privateKey"]) {
  return sign(null, Buffer.from(timestamp + body), privateKey).toString("hex");
}

describe("verifySignature", () => {
  it("accepts a body Discord signed", () => {
    const { privateKey, publicKeyHex } = freshKeypair();
    const rawBody = '{"type":1}';
    const timestamp = "1700000000";

    const ok = verifySignature({
      rawBody,
      timestamp,
      signature: signed(rawBody, timestamp, privateKey),
      publicKeyHex,
    });

    expect(ok).toBe(true);
  });

  it("rejects a body altered after signing", () => {
    const { privateKey, publicKeyHex } = freshKeypair();
    const timestamp = "1700000000";
    const signature = signed('{"type":1}', timestamp, privateKey);

    const ok = verifySignature({
      rawBody: '{"type":2}',
      timestamp,
      signature,
      publicKeyHex,
    });

    expect(ok).toBe(false);
  });

  it("rejects a signature replayed under a different timestamp", () => {
    const { privateKey, publicKeyHex } = freshKeypair();
    const rawBody = '{"type":1}';
    const signature = signed(rawBody, "1700000000", privateKey);

    const ok = verifySignature({ rawBody, timestamp: "1700009999", signature, publicKeyHex });

    expect(ok).toBe(false);
  });

  it("rejects a signature from a different key", () => {
    const { privateKey } = freshKeypair();
    const other = freshKeypair();
    const rawBody = '{"type":1}';
    const timestamp = "1700000000";

    const ok = verifySignature({
      rawBody,
      timestamp,
      signature: signed(rawBody, timestamp, privateKey),
      publicKeyHex: other.publicKeyHex,
    });

    expect(ok).toBe(false);
  });

  it.each([
    ["missing signature", { signature: null }],
    ["missing timestamp", { timestamp: null }],
    ["unconfigured public key", { publicKeyHex: undefined }],
  ])("returns false on %s rather than throwing", (_label, override) => {
    const { privateKey, publicKeyHex } = freshKeypair();
    const rawBody = '{"type":1}';
    const timestamp = "1700000000";

    const ok = verifySignature({
      rawBody,
      timestamp,
      signature: signed(rawBody, timestamp, privateKey),
      publicKeyHex,
      ...override,
    });

    expect(ok).toBe(false);
  });

  it("returns false on a malformed hex signature", () => {
    const { publicKeyHex } = freshKeypair();

    const ok = verifySignature({
      rawBody: '{"type":1}',
      timestamp: "1700000000",
      signature: "not-hex-at-all",
      publicKeyHex,
    });

    expect(ok).toBe(false);
  });

  it("returns false when the public key is the wrong length", () => {
    const ok = verifySignature({
      rawBody: '{"type":1}',
      timestamp: "1700000000",
      signature: "aa".repeat(64),
      publicKeyHex: "abcd",
    });

    expect(ok).toBe(false);
  });
});
