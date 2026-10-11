import { DurableObject } from "cloudflare:workers";
import { COLLECTIONS, formatAtUri } from "@igloo/lexicon";
import { enqueue } from "./queue.js";

type JetstreamEvent = {
  did: string;
  time_us: number;
  kind: "commit" | "identity" | "account";
  commit?: { operation: "create" | "update" | "delete"; collection: string; rkey: string };
};

/** How often the alarm checks the connection. */
const WATCHDOG_MS = 30_000;
/** On reconnect, replay a little before the saved cursor so nothing in flight is lost. */
const REWIND_US = 5_000_000;
/** Without events, assume the stream is caught up to this long ago. */
const QUIET_LAG_US = 60_000_000;

const WANTED = new Set<string>(COLLECTIONS);

/** The igloo record URI a Jetstream event is about, if it's about one. */
export function uriFromEvent(event: JetstreamEvent): string | null {
  if (event.kind !== "commit" || !event.commit || !WANTED.has(event.commit.collection)) return null;
  return formatAtUri({
    did: event.did,
    collection: event.commit.collection,
    rkey: event.commit.rkey,
  });
}

export function subscribeUrl(base: string, cursor: number | undefined): URL {
  const url = new URL("/subscribe", base);
  for (const collection of COLLECTIONS) url.searchParams.append("wantedCollections", collection);
  if (cursor) url.searchParams.set("cursor", String(cursor - REWIND_US));
  return url;
}

/**
 * The single Durable Object holding the Jetstream WebSocket, filtered to igloo
 * collections. Each event becomes a queue message to re-fetch that record;
 * nothing is indexed straight from the stream.
 *
 * The cursor is saved after each batch, and an alarm every 30 s reconnects if
 * the socket has dropped (or the object was evicted). Gaps beyond Jetstream's
 * replay window are covered by the daily reconcile.
 */
export class JetstreamDO extends DurableObject<Env> {
  private ws: WebSocket | null = null;
  private pending: string[] = [];
  private flushing: Promise<void> | null = null;
  private cursor: number | undefined;
  private lastEventAt: string | null = null;

  /** Connect if needed and keep the watchdog alarm scheduled. */
  async ensure(): Promise<{
    connected: boolean;
    cursor: number | null;
    lastEventAt: string | null;
  }> {
    this.cursor ??= await this.ctx.storage.get<number>("cursor");
    if (!this.ws) {
      try {
        await this.openSocket();
      } catch (error) {
        console.error("Jetstream connect failed", error);
      }
    } else if (this.pending.length === 0) {
      // Quiet stream: advance the saved cursor so a reconnect doesn't replay hours.
      const caughtUp = Date.now() * 1000 - QUIET_LAG_US;
      if (!this.cursor || caughtUp > this.cursor) {
        this.cursor = caughtUp;
        await this.ctx.storage.put("cursor", caughtUp);
      }
    }
    if (!(await this.ctx.storage.getAlarm())) {
      await this.ctx.storage.setAlarm(Date.now() + WATCHDOG_MS);
    }
    return {
      connected: this.ws !== null,
      cursor: this.cursor ?? null,
      lastEventAt: this.lastEventAt,
    };
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.setAlarm(Date.now() + WATCHDOG_MS);
    await this.ensure();
  }

  private async openSocket(): Promise<void> {
    const url = subscribeUrl(this.env.JETSTREAM_URL, this.cursor);
    const res = await fetch(url, { headers: { Upgrade: "websocket" } });
    const ws = res.webSocket;
    if (!ws) throw new Error(`Jetstream refused the WebSocket: HTTP ${res.status}`);
    ws.accept();
    const drop = () => {
      if (this.ws === ws) this.ws = null;
    };
    ws.addEventListener("message", (event) => this.onMessage(event.data));
    ws.addEventListener("close", drop);
    ws.addEventListener("error", drop);
    this.ws = ws;
    console.log(`Jetstream connected${this.cursor ? ` from cursor ${this.cursor}` : ""}`);
  }

  private onMessage(data: string | ArrayBuffer): void {
    let event: JetstreamEvent;
    try {
      event = JSON.parse(typeof data === "string" ? data : new TextDecoder().decode(data));
    } catch {
      return;
    }
    const uri = uriFromEvent(event);
    if (!uri) return;
    this.pending.push(uri);
    this.cursor = event.time_us;
    this.lastEventAt = new Date(event.time_us / 1000).toISOString();
    this.flushing ??= this.flush();
  }

  /** Send what has arrived to the index queue, then save the cursor. */
  private async flush(): Promise<void> {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      while (this.pending.length > 0) {
        const uris = this.pending.splice(0);
        const cursor = this.cursor;
        await enqueue(this.env.INDEX_QUEUE, uris);
        if (cursor) await this.ctx.storage.put("cursor", cursor);
      }
    } catch (error) {
      console.error("Jetstream flush failed", error);
    } finally {
      this.flushing = null;
    }
  }
}
