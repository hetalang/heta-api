const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function requestInfo(port) {
  return new Promise((resolve, reject) => {
    const request = http.get(`http://127.0.0.1:${port}/info`, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ statusCode: response.statusCode, body }));
    });
    request.once('error', reject);
    request.setTimeout(1000, () => request.destroy(new Error('Request timed out')));
  });
}

async function waitForServer(port, server) {
  const deadline = Date.now() + 10000;
  let lastError;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Server exited before it became ready (code ${server.exitCode}).`);
    }

    try {
      return await requestInfo(port);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new Error(`Server did not become ready: ${lastError?.message}`);
}

test('GET /info returns API metadata', { timeout: 15000 }, async (t) => {
  const port = await getAvailablePort();
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'heta-api-test-'));
  const filesDirectory = path.join(tempDirectory, 'files');
  const server = spawn(process.execPath, ['src'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), FILES: filesDirectory },
    stdio: 'ignore',
    windowsHide: true,
  });

  t.after(() => {
    if (server.exitCode === null) {
      server.kill('SIGKILL');
    }
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  const response = await waitForServer(port, server);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    description: 'API connector for Heta compiler',
    version: require('heta-compiler/package').version,
    node: process.version,
    schema: '/schema',
  });
});
