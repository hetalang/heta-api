# Heta API

This is part of the Heta project. See documentation at <https://hetalang.github.io>.

This is the API for compilation Heta based platforms.

Authentication is not required.

Server path: <https://heta-api.insysbio.com>

## Paths

### /build (POST)

Send files and options for building platform.
Receive compilation logs and a taskId for download the result.

### /download/{taskId} (GET)

Send taskId and filenames to download.

### /download/{taskId} (DELETE)

Not implemented yet.

### /schema (GET)

get OpenAPI schema.

### / (GET)

Receive a message with heta-compiler version.

## Run

```bash
npm install
npm start
```
