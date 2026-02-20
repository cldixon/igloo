# Igloo API Reference

The igloo CLI wraps these REST endpoints. This reference is useful when debugging, scripting with curl, or understanding response shapes.

## Endpoints

### `GET /health`

Returns `{ "status": "ok" }` when the instance is reachable.

### `GET /api/list?path=<path>`

Lists directory contents at one level (not recursive).

| Param  | Required | Default | Description |
|--------|----------|---------|-------------|
| `path` | No       | `""`    | Directory path to list |

Response:

```json
{
  "path": "datasets/",
  "entries": [
    { "name": "census", "path": "datasets/census/", "type": "directory" },
    { "name": "iris.csv", "path": "datasets/iris.csv", "type": "file", "size": 4500, "lastModified": "2024-12-20T15:30:00.000Z", "extension": "csv" }
  ],
  "readme": "# Datasets\n..."
}
```

- Directories: `type: "directory"`, no `size` or `lastModified`
- Files: `type: "file"` with `size` (bytes), `lastModified` (ISO 8601), `extension`
- `readme`: raw markdown from `README.md` in that directory, or `null`
- Entries sorted: directories first, then files

### `GET /api/download?path=<path>`

Streams a file download. Requires `path`. Returns `Content-Disposition: attachment`.

Errors: `400` if path missing, `404` if file not found.

### `GET /api/metadata?path=<path>`

Returns file metadata without the file body. Requires `path`.

```json
{
  "name": "iris.csv",
  "path": "datasets/iris.csv",
  "size": 4500,
  "lastModified": "2024-12-20T15:30:00.000Z",
  "contentType": "text/csv",
  "etag": "\"abc123def456\""
}
```

Errors: `400` if path missing, `404` if file not found.

## Data Model

### DirectoryEntry

| Field          | Type    | Description                     |
|---------------|---------|---------------------------------|
| `name`        | string  | File or directory name          |
| `path`        | string  | Full path from root             |
| `type`        | string  | `"file"` or `"directory"`       |
| `size`        | number? | Size in bytes (files only)      |
| `lastModified`| string? | ISO 8601 timestamp (files only) |
| `extension`   | string? | File extension (files only)     |

### DirectoryListing

| Field     | Type             | Description                |
|-----------|------------------|----------------------------|
| `path`    | string           | Current directory path     |
| `entries` | DirectoryEntry[] | Contents of the directory  |
| `readme`  | string?          | README.md content, or null |

### FileMetadata

| Field          | Type    | Description            |
|---------------|---------|------------------------|
| `name`        | string  | File name              |
| `path`        | string  | Full path from root    |
| `size`        | number  | Size in bytes          |
| `lastModified`| string  | ISO 8601 timestamp     |
| `contentType` | string  | MIME type              |
| `etag`        | string? | Entity tag for caching |
