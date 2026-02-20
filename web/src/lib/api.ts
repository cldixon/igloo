import type { DirectoryListing, FileMetadata, IglooConfig } from "@igloo/shared";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function fetchListing(path: string = ""): Promise<DirectoryListing> {
  const res = await fetch(`${API_BASE}/api/list?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`Failed to fetch listing: ${res.status}`);
  return res.json();
}

export async function fetchMetadata(path: string): Promise<FileMetadata> {
  const res = await fetch(`${API_BASE}/api/metadata?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`Failed to fetch metadata: ${res.status}`);
  return res.json();
}

export function getDownloadUrl(path: string): string {
  return `${API_BASE}/api/download?path=${encodeURIComponent(path)}`;
}

export async function fetchConfig(): Promise<IglooConfig> {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    if (!res.ok) throw new Error(`Failed to fetch config: ${res.status}`);
    return res.json();
  } catch {
    return { title: "igloo", tagline: "personal data repository", theme: "repo" };
  }
}
