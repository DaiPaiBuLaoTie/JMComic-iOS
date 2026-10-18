import { chromium, webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import CryptoJS from 'crypto-js';

const root = path.resolve(import.meta.dirname, '..');
await mkdir(path.join(root, 'build/logs'), { recursive: true });
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const relative = pathname.replace(/^\//, '') || 'index.html';
  if (relative.includes('..')) { response.writeHead(400).end(); return; }
  let file = path.join(root, 'dist', relative);
  let data;
  try { data = await readFile(file); } catch { file = 'index.html'; data = await readFile(path.join(root, 'dist/index.html')); }
  const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' :
    file.endsWith('.html') ? 'text/html' : file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : 'application/octet-stream';
  response.setHeader('Content-Type', type);
  response.end(data);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const encrypt = (value, key) => CryptoJS.AES.encrypt(JSON.stringify(value),
  CryptoJS.enc.Utf8.parse(CryptoJS.MD5(key).toString()), { mode: CryptoJS.mode.ECB }).toString();
const hostDocument = encrypt({ Server: ['api.fixture.invalid'],
  jm3_Server: [['api.fixture.invalid', '線路1']] }, 'diosfjckwpqpdfjkvnqQjsik');
const image = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420"><rect width="300" height="420" fill="#ddd"/><text x="30" y="100" fill="#555">Interface test</text></svg>';
const fixtures = {
  setting: { ipcountry: 'TW', ad_cache_version: 99, img_host: 'https://img.fixture.invalid',
    main_web_host: 'https://site.fixture.invalid', app_img_shunt: [], version: '2.1.11' },
  promote: [{ id: '26', title: '界面验证', name: '界面验证', content: [{ id: '123', name: '界面验证示例', author: ['示例'], category: { title: '示例' } }] }],
  latest: { list: [], total: 1 },
  payment: { plans: [], pay_methods: [] },
  search: { total: 0, content: [] },
  comic_read: { id: '456', name: '阅读验证示例', scramble_id: '999999', images: [1, 2, 3].map(page =>
    ({ page, image: `https://img.fixture.invalid/page-${page}.svg` })) },
};

try {
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
      const errors = [], requests = [];
      page.on('console', message => { if (message.type() === 'error') console.error(`${name}: ${message.text()}`); });
      page.on('pageerror', error => { errors.push(error.message); console.error(`${name} page error: ${error.message}`); });
      await page.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin === origin) return route.continue();
        requests.push(url.href);
        const headers = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'tokenparam,token,authorization,cookie,content-type' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (url.pathname.endsWith('newsvr-2025.txt')) return route.fulfill({ body: hostDocument, headers });
        if (url.hostname.startsWith('img.')) return route.fulfill({ contentType: 'image/svg+xml', body: image, headers });
        const endpoint = url.pathname.split('/').pop();
        const timestamp = (request.headers().tokenparam || `${Math.floor(Date.now() / 1000)},2.1.11`).split(',')[0];
        return route.fulfill({ contentType: 'application/json', headers,
          body: JSON.stringify({ code: 200, data: encrypt(fixtures[endpoint] ?? {}, timestamp + '185Hcomic3PAPP7R') }) });
      });
      await page.addInitScript(() => {
        localStorage.setItem('adsList', JSON.stringify({ app_home_top: { advs: [{ adv_text: '<script>alert("AD")</script>' }] } }));
        localStorage.setItem('adsContent', JSON.stringify({ link: { exchange_link_top: { first_links: [{ name: 'UNWANTED_AD', link: 'https://ads.fixture.invalid' }] } } }));
        localStorage.setItem('memberInfo', JSON.stringify({ ad_free: false }));
        localStorage.setItem('localVersion', '999.0.0');
        localStorage.setItem('paginationMode', 'click');
        localStorage.setItem('dontShowExpiry', String(Date.now() + 86400000));
      });
      await page.goto(origin);
      console.log(`${name}: loaded application`);
      await page.getByRole('button', { name: /線路1/ }).waitFor({ timeout: 15000 }).catch(async () => {
        console.log(`${name}: startup body: ${await page.locator('body').innerText()}`);
        console.log(`${name}: requests: ${JSON.stringify(requests)}`);
        await page.screenshot({ path: path.join(root, `build/logs/startup-${name}.png`) });
        await page.getByRole('button', { name: /線路1/ }).waitFor({ timeout: 15000 });
      });
      await page.getByRole('button', { name: /線路1/ }).click();
      await page.getByRole('button', { name: /18|成年|年齡|进入|進入/ }).click({ timeout: 10000 });
      await page.getByRole('link', { name: '首頁', exact: true }).waitFor({ timeout: 15000 });
      await page.getByText('界面验证示例', { exact: false }).first().waitFor({ timeout: 15000 });
      assert.equal(await page.locator('iframe').count(), 0);
      assert.equal(await page.getByText('UNWANTED_AD').count(), 0);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('memberInfo')).ad_free), false);
      assert.equal(await page.evaluate(() => localStorage.getItem('adsList')), null);
      const blocked = requests.filter(url => /ad_content|advertise|jmapp3apk|clarity|google-analytics|googletagmanager/.test(url));
      assert.deepEqual(blocked, []);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: path.join(root, `build/logs/home-${name}.png`), fullPage: true });
      console.log(`${name}: original home, startup selection, age confirmation, stale ad caches, and no remote-code requests passed`);
      await page.goto(`${origin}/comic/detail/read?id=123&readId=456&episode=0&subEpisode=1`);
      await page.getByText('阅读验证示例', { exact: true }).waitFor();
      const slider = page.getByRole('slider');
      await slider.waitFor();
      assert.equal(await slider.getAttribute('aria-valuemax'), '3');
      await slider.focus();
      await slider.press('End');
      assert.equal(await slider.getAttribute('aria-valuenow'), '3');
      await slider.press('Home');
      assert.equal(await slider.getAttribute('aria-valuenow'), '1');
      const translation = JSON.parse(await readFile(path.join(root, 'src/assets/locales/zh-TW/translation.json'), 'utf8'));
      await page.getByText(translation.detail.read_horizontally, { exact: true }).click();
      await page.locator('.swiper-slide').first().waitFor();
      assert.equal(await page.locator('.swiper-slide').count(), 3);
      await slider.focus();
      await slider.press('End');
      assert.equal(await slider.getAttribute('aria-valuenow'), '3');
      assert.equal(await page.locator('iframe').count(), 0);
      assert.deepEqual(errors, []);
      assert.deepEqual(requests.filter(url => /ad_content|advertise|jmapp3apk|clarity|google-analytics|googletagmanager/.test(url)), []);
      await page.screenshot({ path: path.join(root, `build/logs/reader-${name}.png`) });
      console.log(`${name}: three-image reader, slider bounds, image jumps, and horizontal slides passed`);
    } finally { await browser.close(); }
  }
} finally { server.close(); }
