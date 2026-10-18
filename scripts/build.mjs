import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'dist');
const debug = process.env.JMCOMIC_DEBUG === '1';
const config = JSON.parse(await readFile(path.join(root, 'app-config.json'), 'utf8'));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
await mkdir(path.join(root, 'build'), { recursive: true });
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'public'), output, { recursive: true });
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/index.tsx'],
  outdir: 'dist/assets',
  entryNames: 'app-[hash]',
  chunkNames: 'chunk-[hash]',
  assetNames: '[name]-[hash]',
  bundle: true,
  splitting: true,
  format: 'esm',
  jsx: 'automatic',
  target: ['safari15'],
  minify: !debug,
  sourcemap: debug ? 'inline' : false,
  metafile: true,
  legalComments: 'external',
  plugins: [{ name: 'mui-esm-icons', setup(builder) {
    builder.onResolve({ filter: /^@mui\/icons-material\// }, args => ({
      path: path.join(root, 'node_modules/@mui/icons-material/esm', args.path.slice('@mui/icons-material/'.length) + '.js'),
    }));
  } }],
  loader: { '.svg': 'file', '.png': 'file', '.jpg': 'file', '.woff2': 'file', '.woff': 'file', '.ttf': 'file' },
  define: {
    'process.env.NODE_ENV': debug ? '"development"' : '"production"',
    'process.env.REACT_APP_ENV': '"production"',
    ...Object.fromEntries(Object.entries(config.environment).map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)])),
  },
});
const entry = Object.entries(result.metafile.outputs).find(([, value]) => value.entryPoint === 'src/index.tsx');
if (!entry) throw new Error('Application entry was not generated');
const css = entry[1].cssBundle;
const html = `<!doctype html>
<html lang="zh-TW"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob: https:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http:; connect-src 'self' blob: https:; frame-src 'none'; object-src 'none'; base-uri 'self'">
<meta name="theme-color" content="#000000"><link rel="icon" href="/logo.png">
<title>JMComic3</title><link rel="stylesheet" href="/static/css/main.fe5d614d.css">
${css ? `<link rel="stylesheet" href="/${css.replace(/^dist\//, '')}">` : ''}
<script type="module" src="/${entry[0].replace(/^dist\//, '')}"></script>
</head><body><noscript>需要启用 JavaScript。</noscript><div id="root"></div></body></html>`;
await writeFile(path.join(output, 'index.html'), html);
await writeFile(path.join(root, 'build/web-metafile.json'), JSON.stringify(result.metafile, null, 2));
const manifest = { application: 'JMComic-iOS', version: pkg.version, sourceVersion: config.sourceVersion,
  sourceApkSha256: config.sourceApkSha256, updatePolicy: 'bundled-only', advertisements: 'removed', files: {} };
async function inventory(dir) {
  const { readdir } = await import('node:fs/promises');
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) await inventory(file);
    else manifest.files[path.relative(output, file).replaceAll('\\', '/')] = createHash('sha256').update(await readFile(file)).digest('hex');
  }
}
await inventory(output);
await writeFile(path.join(output, 'web-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Built ${Object.keys(manifest.files).length} files; updates are bundled with the IPA.`);
