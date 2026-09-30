const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

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

function waitForServerPort(server) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => {
      reject(new Error(`Server did not become ready. Output:\n${output}`));
    }, 10000);

    const fail = (error) => {
      clearTimeout(timeout);
      reject(error);
    };

    server.stdout.setEncoding('utf8');
    server.stderr.setEncoding('utf8');
    server.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/API running on http:\/\/localhost:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(Number(match[1]));
      }
    });
    server.stderr.on('data', (chunk) => { output += chunk; });
    server.once('error', fail);
    server.once('exit', (code) => fail(new Error(`Server exited before it became ready (code ${code}). Output:\n${output}`)));
  });
}

test('GET /info returns API metadata', { timeout: 15000 }, async (t) => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'heta-api-test-'));
  const filesDirectory = path.join(tempDirectory, 'files');
  const server = spawn(process.execPath, ['src'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: '0', FILES: filesDirectory },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  t.after(() => {
    if (server.exitCode === null) {
      server.kill('SIGKILL');
    }
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  const port = await waitForServerPort(server);
  const response = await requestInfo(port);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    description: 'API connector for Heta compiler',
    version: require('heta-compiler/package').version,
    node: process.version,
    schema: '/schema',
  });
});
