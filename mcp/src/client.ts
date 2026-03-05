import type {
  DirectoryListing,
  FileMetadata,
  IglooConfig,
  HealthResponse,
} from "./types.js";

export class IglooClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL.replace(/\/+$/, "");
  }

  private async fetchJSON<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(endpoint, this.baseURL);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString());

    if (response.status === 404) {
      throw new Error(`Not found: ${params?.path ?? endpoint}`);
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`API error (status ${response.status}): ${body}`);
    }

    return response.json() as Promise<T>;
  }

  async health(): Promise<HealthResponse> {
    return this.fetchJSON<HealthResponse>("/health");
  }

  async list(path?: string): Promise<DirectoryListing> {
    const params = path ? { path } : undefined;
    return this.fetchJSON<DirectoryListing>("/api/list", params);
  }

  async metadata(path: string): Promise<FileMetadata> {
    return this.fetchJSON<FileMetadata>("/api/metadata", { path });
  }

  async config(): Promise<IglooConfig> {
    return this.fetchJSON<IglooConfig>("/api/config");
  }

  async downloadText(path: string): Promise<string> {
    const url = new URL("/api/download", this.baseURL);
    url.searchParams.set("path", path);
    const response = await fetch(url.toString());

    if (response.status === 404) {
      throw new Error(`Not found: ${path}`);
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`API error (status ${response.status}): ${body}`);
    }

    return response.text();
  }

  downloadURL(path: string): string {
    const url = new URL("/api/download", this.baseURL);
    url.searchParams.set("path", path);
    return url.toString();
  }
}
