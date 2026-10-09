import { NSID } from "@igloo/lexicon";

/**
 * A fake AT Protocol network for tests: a PLC directory, PDSes holding
 * records, a relay, and the Bluesky profile service, all behind one fetch.
 */
export class FakeNetwork {
  /** did -> PDS origin */
  pds = new Map<string, string>();
  /** at-uri -> { cid, value } */
  records = new Map<string, { cid: string; value: unknown }>();
  profiles = new Map<string, { handle: string; displayName?: string; avatar?: string }>();
  /** Hosts that answer 503. */
  down = new Set<string>();
  calls: string[] = [];

  addRepo(did: string, pds = "https://pds.example.com", handle = `${did.slice(-6)}.test`) {
    this.pds.set(did, pds);
    this.profiles.set(did, { handle });
  }

  put(uri: string, value: unknown, cid = `bafy${this.records.size + 1}`) {
    this.records.set(uri, { cid, value });
  }

  fetch = async (input: Request | string | URL, _init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    this.calls.push(url.toString());
    if (this.down.has(url.host)) return new Response("unavailable", { status: 503 });
    const json = (body: unknown, status = 200) => Response.json(body, { status });
    const q = url.searchParams;

    if (url.host === "plc.directory") {
      const did = decodeURIComponent(url.pathname.slice(1));
      const pds = this.pds.get(did);
      if (!pds) return json({ message: "DID not registered" }, 404);
      return json({
        id: did,
        alsoKnownAs: [`at://${this.profiles.get(did)?.handle ?? "unknown.test"}`],
        service: [{ id: "#atproto_pds", type: "AtprotoPersonalDataServer", serviceEndpoint: pds }],
      });
    }
    if (url.pathname === "/xrpc/app.bsky.actor.getProfile") {
      const did = q.get("actor")!;
      const profile = this.profiles.get(did);
      return profile ? json({ did, ...profile }) : json({ error: "InvalidRequest" }, 400);
    }
    if (url.pathname === "/xrpc/com.atproto.repo.getRecord") {
      const uri = `at://${q.get("repo")}/${q.get("collection")}/${q.get("rkey")}`;
      const record = this.records.get(uri);
      return record
        ? json({ uri, ...record })
        : json({ error: "RecordNotFound", message: "Could not locate record" }, 400);
    }
    if (url.pathname === "/xrpc/com.atproto.repo.listRecords") {
      const prefix = `at://${q.get("repo")}/${q.get("collection")}/`;
      const records = [...this.records].filter(([uri]) => uri.startsWith(prefix));
      return json({ records: records.map(([uri, r]) => ({ uri, ...r })) });
    }
    if (url.pathname === "/xrpc/com.atproto.sync.listReposByCollection") {
      const collection = q.get("collection");
      const dids = new Set(
        [...this.records.keys()]
          .filter((uri) => uri.split("/")[3] === collection)
          .map((uri) => uri.split("/")[2]!),
      );
      return json({ repos: [...dids].map((did) => ({ did })) });
    }
    return json({ error: "NotFound", message: url.toString() }, 404);
  };
}

export const ALICE = "did:plc:aliceaaaaaaaaaaaaaaaaaaa";
export const BOB = "did:plc:bobbbbbbbbbbbbbbbbbbbbbb";

export const HASH = "a".repeat(64);

export function dataDirRecord(name: string, overrides: Record<string, unknown> = {}) {
  return {
    $type: NSID.dataDir,
    name,
    instance: "https://data.alice.test",
    title: `Title of ${name}`,
    files: [{ path: "data.csv", size: 2048, sha256: HASH }],
    createdAt: "2026-10-02T18:12:00.000Z",
    ...overrides,
  };
}

export function instanceRecord(url = "https://data.alice.test", name = "Alice's igloo") {
  return { $type: NSID.instance, url, name, createdAt: "2026-10-01T00:00:00.000Z" };
}

export const dataDirUri = (did: string, name: string) => `at://${did}/${NSID.dataDir}/${name}`;
export const instanceUri = (did: string, host: string) => `at://${did}/${NSID.instance}/${host}`;
