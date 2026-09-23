import { createPublicKey, verify, type KeyObject } from "node:crypto";

// Discord signs every interaction with Ed25519 and expects the endpoint to
// reject anything that fails — it probes with deliberately bad signatures
// during setup and refuses to save a URL that answers 2xx to them.
//
// Node's verify() wants a KeyObject, but Discord publishes the key as 32 raw
// hex bytes. This is the SPKI DER header for Ed25519; prefixing it turns the
// raw key into something createPublicKey accepts. It is a fixed constant, not
// a computation: OID 1.3.101.112 wrapped in the standard SubjectPublicKeyInfo.
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function publicKeyFromHex(hex: string): KeyObject {
  const raw = Buffer.from(hex, "hex");
  if (raw.length !== 32) throw new Error("Ed25519 public key must be 32 bytes");
  return createPublicKey({
    key: Buffer.concat([SPKI_ED25519_PREFIX, raw]),
    format: "der",
    type: "spki",
  });
}

/** True only for a body Discord actually signed.
 *
 * The signed message is timestamp + raw body, so the body must be the exact
 * bytes received — re-serializing parsed JSON changes the whitespace and every
 * signature stops matching. Never throws: a malformed header is a failed
 * verification, not a 500. */
export function verifySignature(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  publicKeyHex: string | undefined;
}): boolean {
  const { rawBody, signature, timestamp, publicKeyHex } = input;
  if (!signature || !timestamp || !publicKeyHex) return false;

  try {
    return verify(
      null,
      Buffer.from(timestamp + rawBody),
      publicKeyFromHex(publicKeyHex),
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}
