import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import type { DirectoryEntry, FileMetadata } from "@igloo/shared";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

export async function listObjects(prefix: string): Promise<DirectoryEntry[]> {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: prefix || undefined,
    Delimiter: "/",
  });
  const response = await s3.send(command);

  const directories: DirectoryEntry[] = (response.CommonPrefixes ?? []).map(
    (cp) => {
      const fullPath = cp.Prefix!;
      const name = fullPath.slice(prefix.length).replace(/\/$/, "");
      return { name, path: fullPath, type: "directory" as const };
    }
  );

  const files: DirectoryEntry[] = (response.Contents ?? [])
    .filter((obj) => obj.Key !== prefix)
    .map((obj) => {
      const name = obj.Key!.slice(prefix.length);
      const extension = name.includes(".") ? name.split(".").pop() : undefined;
      return {
        name,
        path: obj.Key!,
        type: "file" as const,
        size: obj.Size,
        lastModified: obj.LastModified?.toISOString(),
        extension,
      };
    });

  return [...directories, ...files];
}

export async function getReadme(prefix: string): Promise<string | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: `${prefix}README.md`,
    });
    const response = await s3.send(command);
    return (await response.Body?.transformToString()) ?? null;
  } catch (err: any) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

export async function getObject(key: string) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  return s3.send(command);
}

export async function getObjectMetadata(key: string): Promise<FileMetadata> {
  const command = new HeadObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  const response = await s3.send(command);
  const name = key.split("/").pop() ?? key;
  return {
    name,
    path: key,
    size: response.ContentLength ?? 0,
    lastModified: response.LastModified?.toISOString() ?? "",
    contentType: response.ContentType ?? "application/octet-stream",
    etag: response.ETag,
  };
}
