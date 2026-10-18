import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const cli = path.join(root, 'node_modules/@capacitor/cli/bin/capacitor');
function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Capacitor ${args.join(' ')} failed`);
}
const project = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj');
if (!await access(project).then(() => true).catch(() => false)) run(['add', 'ios', '--packagemanager', 'SPM']);
run(['sync', 'ios']);
let pbx = await readFile(project, 'utf8');
if (!pbx.includes('CapApp-SPM') && !pbx.includes('JMComicFeature')) throw new Error('Unexpected Capacitor iOS template');
pbx = pbx.replace(/relativePath = "?(?:CapApp-SPM|JMComicFeature)"?;/g, 'relativePath = "../../AppPackage";')
  .replaceAll('CapApp-SPM', 'JMComicFeature');
await writeFile(project, pbx);
await copyFile(path.join(root, 'native/AppDelegate.swift'), path.join(root, 'ios/App/App/AppDelegate.swift'));
await writeFile(path.join(root, 'ios/App/App/.swiftlint.yml'), 'parent_config: ../../../.swiftlint.yml\n');
const icons = path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
await mkdir(icons, { recursive: true });
await copyFile(path.join(root, 'public/logo1024.png'), path.join(icons, 'AppIcon.png'));
await writeFile(path.join(icons, 'Contents.json'), JSON.stringify({ images: [
  { filename: 'AppIcon.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }
], info: { author: 'xcode', version: 1 } }, null, 2));
const plist = path.join(root, 'ios/App/App/Info.plist');
let info = await readFile(plist, 'utf8');
info = info.replace(/<key>NSAppTransportSecurity<\/key>\s*<dict>[\s\S]*?<\/dict>\s*/g, '').replace(/<key>LSSupportsOpeningDocumentsInPlace<\/key>\s*<true\/>\s*/g, '');
info = info.replace('</dict>\n</plist>', `<key>NSAppTransportSecurity</key>
<dict><key>NSAllowsArbitraryLoadsInWebContent</key><true/></dict>
<key>LSSupportsOpeningDocumentsInPlace</key><true/>
</dict>\n</plist>`);
await writeFile(plist, info);
console.log('Prepared iOS app with local-package dependencies and bundled web assets.');
