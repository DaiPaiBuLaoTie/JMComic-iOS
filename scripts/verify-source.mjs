import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default || traverseModule;
const root = path.resolve(import.meta.dirname, '..');
let count = 0;
async function inspect(dir) {
 for (const item of await readdir(dir, {withFileTypes:true})) {
  const file = path.join(dir,item.name);
  if (item.isDirectory()) await inspect(file);
  else if (/\.[jt]sx?$/.test(file)) {
   const source = await readFile(file,'utf8');
   const ast = parse(source,{sourceType:'module',plugins:['typescript','jsx']});
   traverse(ast,{JSXElement(p) { if(p.node.openingElement.name.name === 'AdComponent') throw new Error('Advertisement component: '+path.relative(root,file)); }});
   if(/setServerBasePath|persistServerBasePath|build\.enc|ReactGA\.initialize/.test(source)) throw new Error('Remote update or analytics loader: '+path.relative(root,file));
   count++;
  }
 }
}
await inspect(path.join(root,'src'));
console.log('Verified '+count+' source files: no advertising JSX or remote update loaders.');
