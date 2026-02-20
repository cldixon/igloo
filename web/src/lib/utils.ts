export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateFull(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface Breadcrumb {
  name: string;
  path: string;
}

export function buildBreadcrumbs(path: string, rootName: string = "igloo"): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [{ name: rootName, path: "" }];
  if (!path) return crumbs;

  const segments = path.replace(/\/$/, "").split("/");
  let accumulated = "";
  for (const segment of segments) {
    accumulated += segment + "/";
    crumbs.push({ name: segment, path: accumulated });
  }
  return crumbs;
}
