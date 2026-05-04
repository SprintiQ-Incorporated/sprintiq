import { Client, Receiver } from "@upstash/qstash";

/**
 * QStash client for publishing messages to worker queues.
 * Requires QSTASH_TOKEN env var.
 */
export const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN!,
});

/**
 * QStash receiver for verifying incoming webhook signatures.
 * Requires QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY env vars.
 */
export const qstashReceiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});
