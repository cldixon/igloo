import { getDb } from "./db.js";
import { indexRecord } from "./indexer.js";

export type IndexMessage = { uri: string };

export function indexOptions(env: Env) {
  return { plcDirectory: env.PLC_DIRECTORY, bskyAppview: env.BSKY_APPVIEW };
}

/** Queue consumer: index each URI; transient failures go back for retry. */
export async function consumeIndexBatch(
  batch: MessageBatch<IndexMessage>,
  env: Env,
): Promise<void> {
  const db = await getDb(env.DB);
  // The same URI often arrives twice in a batch (notify, then Jetstream).
  const seen = new Set<string>();
  for (const message of batch.messages) {
    const { uri } = message.body;
    if (seen.has(uri)) {
      message.ack();
      continue;
    }
    seen.add(uri);
    try {
      const outcome = await indexRecord(db, uri, indexOptions(env));
      console.log(`index ${uri}: ${outcome}`);
      message.ack();
    } catch (error) {
      console.warn(`index ${uri} failed, will retry`, error);
      message.retry();
    }
  }
}

/** Queue sends are capped at 100 messages per batch. */
export async function enqueue(queue: Queue, uris: string[]): Promise<void> {
  for (let i = 0; i < uris.length; i += 100) {
    await queue.sendBatch(uris.slice(i, i + 100).map((uri) => ({ body: { uri } })));
  }
}
