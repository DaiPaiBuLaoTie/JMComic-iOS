import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const source = await readFile(new URL('../src/platform/policy.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const { isBlockedRequest, clearLegacyCodeCache, updatePolicy } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('advertising requests are blocked independent of their host and query string', () => {
  for (const endpoint of ['ad_content_all', 'advertise_all', 'advertise', 'ad_content']) {
    assert.equal(isBlockedRequest(`https://api.example.invalid/v2/${endpoint}?lang=TW`), true);
  }
});
test('remote application code and tracking endpoints cannot be fetched', () => {
  for (const url of ['https://api.example.invalid/static/jmapp3apk/build.enc?v=99',
    'https://other.example.invalid/build.zip', 'https://www.clarity.ms/tag/test',
    'https://www.google-analytics.com/g/collect']) assert.equal(isBlockedRequest(url), true);
  assert.equal(updatePolicy.remoteCode, false);
});
test('content, authentication, images, and account permissions still use real endpoints', () => {
  for (const url of ['https://api.example.invalid/login', 'https://api.example.invalid/search?q=advertise',
    'https://api.example.invalid/comic_read?id=123', 'https://img.example.invalid/123.jpg',
    'blob:http://localhost/example', '/assets/app.js']) assert.equal(isBlockedRequest(url), false);
});
test('legacy advertising caches are removed without deleting accounts or reading history', () => {
  const data = new Map([['adsList', '{}'], ['adsContent', '{}'], ['localVersion', '999.0.0'],
    ['memberInfo', '{"ad_free":false}'], ['jwttoken', 'existing-account-token'], ['history', '123']]);
  clearLegacyCodeCache({ removeItem: key => data.delete(key) });
  assert.equal(data.has('adsList'), false);
  assert.equal(data.has('adsContent'), false);
  assert.equal(data.has('localVersion'), false);
  assert.equal(data.get('memberInfo'), '{"ad_free":false}');
  assert.equal(data.get('jwttoken'), 'existing-account-token');
  assert.equal(data.get('history'), '123');
});
