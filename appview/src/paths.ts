/** Where things live on the AppView, and on their instances. */

const hostOf = (url: string) => new URL(url).host;

export const dataDirPath = (d: { did: string; rkey: string }) => `/d/${d.did}/${d.rkey}`;
export const instancePath = (did: string, url: string) => `/i/${did}/${hostOf(url)}`;
export const maintainerPath = (did: string) => `/m/${did}`;
export const searchPath = (q: string) => `/search?q=${encodeURIComponent(q)}`;

/** A data file's download URL on its instance. */
export function downloadUrl(instance: string, name: string, path: string): string {
  return `${instance}/api/download?path=${encodeURIComponent(`${name}/${path}`)}`;
}
