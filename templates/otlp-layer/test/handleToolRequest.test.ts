import { test } from 'node:test';
import assert from 'node:assert/strict';
import http, { request as httpRequest } from 'node:http';
import { handleToolRequest } from '../src/main.js';

const request = (port: number, path: string) =>
  new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = httpRequest({ hostname: 'localhost', port, path, method: 'GET' }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, body: JSON.parse(data) });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });

test('GET /tool returns hello message', async () => {
  const server = http.createServer((req, res) => {
    handleToolRequest(req, res);
  });

  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as any).port;

  const res = await request(port, '/tool');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { message: 'Hello from OTLP layer tool!' });

  await new Promise<void>(resolve => server.close(() => resolve()));
});
