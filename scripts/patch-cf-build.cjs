/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const staticDir = path.join(process.cwd(), '.vercel/output/static');
const apiDir = path.join(staticDir, '_worker.js/__next-on-pages-dist__/functions/api');

// 1. Create async_hooks directory polyfill
const subDir = path.join(apiDir, 'async_hooks');
if (!fs.existsSync(subDir)) {
  fs.mkdirSync(subDir, { recursive: true });
}
const indexContent = `export * from 'node:async_hooks';
import { AsyncLocalStorage } from 'node:async_hooks';
export default AsyncLocalStorage;
`;
fs.writeFileSync(path.join(subDir, 'index.js'), indexContent, 'utf8');

const pkgContent = `{
  "name": "async_hooks",
  "main": "index.js",
  "module": "index.js",
  "type": "module"
}
`;
fs.writeFileSync(path.join(subDir, 'package.json'), pkgContent, 'utf8');
console.log('Polyfill package directory created!');

// 2. Recursively replace raw "async_hooks" with "node:async_hooks"
function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(file => {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      walk(filepath, callback);
    } else if (file.endsWith('.js')) {
      callback(filepath);
    }
  });
}

walk(path.join(staticDir, '_worker.js'), filepath => {
  let content = fs.readFileSync(filepath, 'utf8');
  const regex = /(?<=['"])async_hooks(?=['"])/g;
  if (regex.test(content)) {
    content = content.replace(regex, 'node:async_hooks');
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`Patched raw imports in: ${filepath}`);
  }
});
console.log('CF build successfully patched and optimized!');
