export interface DirectoryEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  lastModified?: string;
  extension?: string;
}

export interface DirectoryListing {
  path: string;
  entries: DirectoryEntry[];
  readme?: string | null;
}

export interface FileMetadata {
  name: string;
  path: string;
  size: number;
  lastModified: string;
  contentType: string;
  etag?: string;
}

export type VisualTheme = "repo" | "index";
export type ColorMode = "light" | "dark";

export interface IglooConfig {
  title: string;
  tagline: string;
  theme: VisualTheme;
}
