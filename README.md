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

### /mcp (POST)

Stateless MCP endpoint using Streamable HTTP, for ChatGPT plugins and other MCP clients.
It exposes `buildPlatform` (the same arguments as `POST /build`) and `getInfo`.
Build requests pass through the existing REST validation and compiler. Results include
raw logs, generated files, and absolute temporary download links. REST errors, including
422 compilation diagnostics, are returned as MCP tool errors with the original response.
In production, Apache serves `filesLink` from the temporary build directory; the local
Node server does not serve `/files`. Use `downloadLink` for a ZIP archive in either setup.
GET and DELETE return 405 because no persistent streams or sessions are used.

`PUBLIC_URL` defaults to `https://heta-api.insysbio.com`. Set it to the public HTTPS
origin when deploying under another hostname, or to `http://localhost:3000` for local
download links. MCP validates Host and Origin headers; a reverse proxy should preserve
the public Host header (or forward a localhost Host). No user authentication is required,
consistent with the existing API.

After deploying, connect the existing Heta Modeling Assistant plugin to
`https://heta-api.insysbio.com/mcp` using Streamable HTTP. An OpenAPI schema alone
is not an MCP connection. Verify tool discovery and compile a small model before use.

## Run

```bash
npm install
npm start
npm run dev
```

`npm run dev` is recommended for local cross-platform development (Windows/Linux/macOS).

## Production static files

The Node app serves `public/` when accessed directly. In the production Apache setup,
Apache handles `/`, `/privacy.html`, and `/logo-old.png` itself: its `DocumentRoot` is
`/var/heta-api`, while the app runs from `/home/azureuser/heta-api`. Uploading new
files to the app's `public/` directory or restarting `heta-api` does not update the
pages served by Apache.

After updating `public/`, copy its static files to the Apache document root:

```bash
sudo install -m 644 /home/azureuser/heta-api/public/index.html /var/heta-api/index.html
sudo install -m 644 /home/azureuser/heta-api/public/privacy.html /var/heta-api/privacy.html
sudo install -m 644 /home/azureuser/heta-api/public/logo-old.png /var/heta-api/logo-old.png
```

The logo URL is used in the MCP server metadata. Apache serves `/files` from the
same document root, so do not use a copy command that deletes other files there
(such as `rsync --delete`). Copying these files does not require a service restart.
