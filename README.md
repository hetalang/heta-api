# Heta API

This is part of the Heta project. See documentation at <https://hetalang.github.io>.

This is the API for compilation Heta based platforms.

Authentication is not required.

Server path: <https://heta-api.insysbio.com>

## Paths

### /build (POST)

Send files and options for building platform.
Receive compilation logs and a taskId for download the result.
The `lifetime` option defaults to `3600` seconds; if set to `0`, files are removed immediately after response.

### /download/{taskId} (GET)

Send taskId to download the result of compilation as a zip archive.

### /schema (GET)

get OpenAPI schema.

### /info (GET)

Receive a message with heta-compiler version.

## Run

```bash
npm install
npm start
npm run dev
```

`npm run dev` is recommended for local cross-platform development (Windows/Linux/macOS).
