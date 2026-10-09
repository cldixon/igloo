import type { DataDir } from "@igloo/shared";

/** Client for the owner's admin API (/api/admin) and sign-in (/api/auth). */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: "same-origin" };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export type AuthStatus = { claimed: boolean; owner: string | null; signedIn: boolean };

export const auth = {
  status: () => request<AuthStatus>("GET", "/api/auth/status"),
  login: (handle: string, setupCode?: string) =>
    request<{ url: string }>("POST", "/api/auth/login", { handle, setupCode }),
  logout: () => request("POST", "/api/auth/logout"),
};

export type DataDirDetail = {
  dataDir: DataDir;
  readme: string | null;
  unregistered: { path: string; size: number }[];
};

export type InstanceProfile = {
  url: string;
  name: string | null;
  description: string | null;
  recordUri: string | null;
  createdAt: string | null;
};

export type ApiToken = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
};

export type NetworkStatus = {
  owner: string;
  pds: { ok: boolean; error?: string };
  appview: string;
  instanceRkey: string;
  dataDirs: { total: number; published: number };
  storageBytes: number;
};

const dir = (slug: string) => `/api/admin/datadirs/${encodeURIComponent(slug)}`;
type One = { dataDir: DataDir };

export const admin = {
  list: () => request<{ dataDirs: DataDir[] }>("GET", "/api/admin/datadirs"),
  folders: () => request<{ folders: string[] }>("GET", "/api/admin/folders"),
  create: (slug: string, fields: { title?: string; description?: string; license?: string } = {}) =>
    request<One>("POST", "/api/admin/datadirs", { slug, ...fields }),
  get: (slug: string) => request<DataDirDetail>("GET", dir(slug)),
  update: (
    slug: string,
    fields: {
      title?: string | null;
      description?: string | null;
      license?: string | null;
      tags?: string[];
    },
  ) => request<One>("PATCH", dir(slug), fields),
  setProfile: (
    slug: string,
    profile: {
      path: string;
      format: string;
      rows: number;
      schema: { name: string; type: string }[];
    },
  ) => request<One>("PUT", `${dir(slug)}/files/profile`, profile),
  remove: (slug: string) => request("DELETE", dir(slug)),
  register: (slug: string, paths: string[]) =>
    request<One>("POST", `${dir(slug)}/files/register`, { paths }),
  deleteFile: (slug: string, path: string) =>
    request<One>("DELETE", `${dir(slug)}/files?path=${encodeURIComponent(path)}`),
  saveReadme: async (slug: string, text: string) => {
    const res = await fetch(`${dir(slug)}/readme`, {
      method: "PUT",
      headers: { "content-type": "text/markdown" },
      body: text,
    });
    const data = await res.json();
    if (!res.ok) throw new ApiError(res.status, data.error);
    return data as One;
  },
  deleteReadme: (slug: string) => request<One>("DELETE", `${dir(slug)}/readme`),
  publish: (slug: string) => request<One>("POST", `${dir(slug)}/publish`),
  unpublish: (slug: string) => request<One>("POST", `${dir(slug)}/unpublish`),
  instance: () => request<{ instance: InstanceProfile }>("GET", "/api/admin/instance"),
  saveInstance: (name: string, description: string) =>
    request<{ instance: InstanceProfile }>("PUT", "/api/admin/instance", { name, description }),
  network: () => request<NetworkStatus>("GET", "/api/admin/network"),
  tokens: () => request<{ tokens: ApiToken[] }>("GET", "/api/admin/tokens"),
  createToken: (name: string, days: number) =>
    request<{ token: string; apiToken: ApiToken }>("POST", "/api/admin/tokens", { name, days }),
  revokeToken: (id: string) => request("DELETE", `/api/admin/tokens/${encodeURIComponent(id)}`),
};

/** Files at or below this go up in one request; larger ones in parts. Matches the API. */
const SINGLE_UPLOAD_LIMIT = 95 * 1024 * 1024;
const PART_SIZE = 50 * 1024 * 1024;

/** PUT with upload progress (fetch can't report it). */
function put(url: string, body: Blob, onProgress: (sent: number) => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (body.type) xhr.setRequestHeader("content-type", body.type);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      let data: { error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // Fall through to the status check.
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(xhr.status, data.error ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new ApiError(0, "Upload failed: network error"));
    xhr.send(body);
  });
}

/**
 * Upload a file to a data dir. The server hashes it from R2 once it is
 * complete, so the hash in the record is of what R2 actually stores.
 */
export async function uploadFile(
  slug: string,
  path: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<DataDir> {
  const q = `path=${encodeURIComponent(path)}`;
  if (file.size <= SINGLE_UPLOAD_LIMIT) {
    const res = (await put(`${dir(slug)}/files?${q}`, file, (sent) =>
      onProgress(sent / Math.max(file.size, 1)),
    )) as One;
    return res.dataDir;
  }

  const { uploadId } = await request<{ uploadId: string }>("POST", `${dir(slug)}/uploads`, {
    path,
    contentType: file.type,
  });
  const base = `${dir(slug)}/uploads/${encodeURIComponent(uploadId)}`;
  try {
    const parts: { partNumber: number; etag: string }[] = [];
    for (let offset = 0, n = 1; offset < file.size; offset += PART_SIZE, n++) {
      const chunk = file.slice(offset, offset + PART_SIZE);
      const part = (await put(`${base}?${q}&part=${n}`, chunk, (sent) =>
        onProgress((offset + sent) / file.size),
      )) as { partNumber: number; etag: string };
      parts.push({ partNumber: part.partNumber, etag: part.etag });
    }
    onProgress(1);
    const res = await request<One>("POST", `${base}/complete`, { path, parts });
    return res.dataDir;
  } catch (error) {
    await fetch(`${base}?${q}`, { method: "DELETE" }).catch(() => {});
    throw error;
  }
}

export const LICENSES = [
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "CC0-1.0",
  "CC-BY-NC-4.0",
  "ODbL-1.0",
  "PDDL-1.0",
  "MIT",
  "Apache-2.0",
];

/** The data dir's page on the AppView. */
export function feedUrl(appview: string, recordUri: string): string {
  const [, , did, , rkey] = recordUri.split("/");
  return `${appview.replace(/\/$/, "")}/d/${did}/${rkey}`;
}
