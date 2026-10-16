const express = require('express');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { hostHeaderValidation } = require('@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const schema = require('../heta-api-schema.json');
const { version } = require('../package.json');

// Reuse the REST schema, resolving its local references for MCP clients.
function resolveSchema(value) {
  if (Array.isArray(value)) return value.map(resolveSchema);
  if (!value || typeof value !== 'object') return value;
  if (value.$ref) {
    const referenced = value.$ref.slice(2).split('/').reduce((node, key) => node[key], schema);
    return resolveSchema(referenced);
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveSchema(item)]));
}

function createMcpRouter() {
  const router = express.Router();
  const publicUrl = new URL(process.env.PUBLIC_URL || schema.servers[0].url);
  const localUrl = `http://127.0.0.1:${process.env.PORT}`;
  const allowedOrigins = [publicUrl.origin, localUrl, `http://localhost:${process.env.PORT}`];

  router.use(hostHeaderValidation([publicUrl.hostname, 'localhost', '127.0.0.1', '[::1]']));
  router.use((req, res, next) => {
    if (req.headers.origin && !allowedOrigins.includes(req.headers.origin)) {
      res.status(403).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Invalid Origin' } });
      return;
    }
    next();
  });

  router.post('/', async (req, res) => {
    // One server/transport per request: no sessions to store or expire.
    const server = new Server({
      name: 'heta-api',
      title: 'Heta API',
      description: 'Remote API for validating and compiling Heta modeling platforms with Heta compiler. Its MCP tools return compilation logs, generated files, and temporary download links.',
      websiteUrl: new URL('/', publicUrl).href,
      version,
      icons: [{ src: new URL('/logo-old.png', publicUrl).href, mimeType: 'image/png', sizes: ['328x340'] }],
    }, {
      capabilities: { tools: {} },
      instructions: 'Use buildPlatform with the platform source files to validate a Heta model or generate requested export formats. Read the returned logs to diagnose compilation errors. Generated files and download links are temporary. Use getInfo to check the compiler version running on this server. For Heta project documentation, see https://hetalang.github.io/.',
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void server.close(); });

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'buildPlatform',
          title: schema.paths['/build'].post.summary,
          description: schema.paths['/build'].post.description,
          inputSchema: resolveSchema(schema.paths['/build'].post.requestBody.content['application/json'].schema),
          outputSchema: {
            type: 'object',
            anyOf: ['200', '400', '500'].map((status) =>
              resolveSchema(schema.paths['/build'].post.responses[status].content['application/json'].schema)),
          },
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        },
        {
          name: 'getInfo',
          title: schema.paths['/info'].get.summary,
          description: schema.paths['/info'].get.description,
          inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          outputSchema: resolveSchema(schema.paths['/info'].get.responses['200'].content['application/json'].schema),
          annotations: { readOnlyHint: true, openWorldHint: false },
        },
      ],
    }));

    server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
      if (!['buildPlatform', 'getInfo'].includes(params.name)) {
        return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${params.name}` }] };
      }
      try {
        const isBuild = params.name === 'buildPlatform';
        // Loop back through REST so input validation and compilation stay identical.
        const response = await fetch(`${localUrl}/${isBuild ? 'build' : 'info'}`, {
          method: isBuild ? 'POST' : 'GET',
          ...(isBuild ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params.arguments || {}) } : {}),
          signal: AbortSignal.timeout(60000),
        });
        const result = await response.json();
        for (const key of ['downloadLink', 'filesLink']) {
          if (typeof result[key] === 'string') result[key] = new URL(result[key], publicUrl).href;
        }
        return {
          ...(!response.ok || result.logs?.includes('Compilation finished but with errors! See logs.') ? { isError: true } : {}),
          content: [{ type: 'text', text: JSON.stringify(result) }],
          structuredContent: result,
        };
      } catch (error) {
        return { isError: true, content: [{ type: 'text', text: `Heta API request failed: ${error.message}` }] };
      }
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error(`MCP error: ${error.message}`);
      await server.close();
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal server error' } });
      }
    }
  });

  // Stateless transport has no persistent event stream or sessions to delete.
  router.all('/', (req, res) => res.status(405).set('Allow', 'POST').json({
    jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Method not allowed' },
  }));
  return router;
}

module.exports = { createMcpRouter };
