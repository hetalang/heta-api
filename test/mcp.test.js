const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

test('MCP discovery, compilation, validation and REST compatibility', { timeout: 20000 }, async (t) => {
  const port = 3002;
  const baseUrl = `http://127.0.0.1:${port}`;
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'heta-mcp-test-'));
  const server = spawn(process.execPath, ['src'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), FILES: path.join(tempDirectory, 'files'), PUBLIC_URL: baseUrl },
    stdio: 'ignore',
  });
  const client = new Client({ name: 'heta-api-test', version: '1.0.0' });
  t.after(async () => {
    await client.close();
    if (server.exitCode === null) server.kill('SIGKILL');
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    assert.equal(server.exitCode, null, 'server must remain running');
    try {
      const response = await fetch(`${baseUrl}/info`);
      assert.equal(response.status, 200);
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.ok(ready, 'server must become ready');
  await client.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`)));
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name), ['buildPlatform', 'getInfo']);
  assert.ok(!JSON.stringify(tools).includes('"$ref"'), 'schemas must be self-contained');

  const info = await client.callTool({ name: 'getInfo', arguments: {} });
  assert.equal(info.structuredContent.version, require('heta-compiler/package').version);

  const args = {
    lifetime: 30,
    inputFiles: [{ filepath: 'index.heta', format: 'utf8', filebody: 'x1 @Record := 1.2;\nc1 @Compartment .= 5;' }],
    declaration: { export: [{ format: 'JSON' }] },
  };
  const compiled = await client.callTool({ name: 'buildPlatform', arguments: args });
  assert.notEqual(compiled.isError, true);
  assert.ok(compiled.structuredContent.logs.includes('Compilation OK!'));
  assert.ok(compiled.structuredContent.outputFiles.some((file) => file.filepath.endsWith('.json')));
  assert.equal(compiled.structuredContent.downloadLink, `${baseUrl}/download/${compiled.structuredContent.taskId}`);
  const zip = await fetch(compiled.structuredContent.downloadLink);
  assert.equal(zip.status, 200);
  assert.equal(Buffer.from(await zip.arrayBuffer()).subarray(0, 2).toString(), 'PK');

  const rest = await fetch(`${baseUrl}/build`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args),
  });
  assert.equal(rest.status, 200);
  assert.ok((await rest.json()).logs.includes('Compilation OK!'));

  const invalid = await client.callTool({ name: 'buildPlatform', arguments: { inputFiles: [] } });
  assert.equal(invalid.isError, true);
  assert.equal(invalid.structuredContent.name, 'Bad Request');
  const missingEntry = await client.callTool({
    name: 'buildPlatform', arguments: { lifetime: 30, inputFiles: [{ filepath: 'other.heta', filebody: '' }] },
  });
  assert.equal(missingEntry.isError, true);
  assert.ok(missingEntry.structuredContent.logs.includes('Compilation finished but with errors! See logs.'));
  assert.ok(missingEntry.structuredContent.taskId);

  assert.equal((await fetch(`${baseUrl}/mcp`)).status, 405);
  assert.equal((await fetch(`${baseUrl}/mcp`, { method: 'DELETE' })).status, 405);
  assert.equal((await fetch(`${baseUrl}/mcp`, {
    method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: '{}',
  })).status, 403);
  const invalidHostStatus = await new Promise((resolve, reject) => {
    const request = http.get(`${baseUrl}/mcp`, { headers: { Host: 'untrusted.example' } }, (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    request.on('error', reject);
  });
  assert.equal(invalidHostStatus, 403);
});
