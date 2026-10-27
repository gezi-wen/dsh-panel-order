// Static checks for the bundle. Run with `npm test`.
// The behavior itself is verified against a live Web UI (drag, reload, restore order);
// these checks only keep the manifest, the entry points and the display resources honest.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

const check = (name, fn) => {
  try {
    fn();
    console.log('ok   ' + name);
  } catch (error) {
    failures += 1;
    console.log('FAIL ' + name + ': ' + error.message);
  }
};

const checkAsync = async (name, fn) => {
  try {
    await fn();
    console.log('ok   ' + name);
  } catch (error) {
    failures += 1;
    console.log('FAIL ' + name + ': ' + error.message);
  }
};

const read = (relative) => readFileSync(join(root, relative), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const manifest = JSON.parse(read('package.json'));

check('package name and version', () => {
  assert(manifest.name === 'dsh-panel-order', 'unexpected name: ' + manifest.name);
  assert(/^\d+\.\d+\.\d+$/.test(manifest.version), 'version is not semver: ' + manifest.version);
  assert(manifest.license === 'Apache-2.0', 'license must be Apache-2.0');
});

check('bundle patch declaration', () => {
  const patch = manifest.dsh && manifest.dsh.bundle && manifest.dsh.bundle.patch;
  assert(patch === './cordis.patch.yml', 'dsh.bundle.patch missing');
  assert(existsSync(join(root, patch)), 'patch file missing');
  assert(read(patch).includes(manifest.name), 'patch does not reference the package name');
});

check('client declaration', () => {
  const client = manifest.dsh && manifest.dsh.client;
  assert(client && client.platform === 'web', 'dsh.client.platform must be web');
  assert(manifest.exports && manifest.exports['./client'], 'exports["./client"] missing');
  assert(manifest.exports['./icon'], 'exports["./icon"] missing');
  assert(manifest.exports['./locale/*.json'], 'exports for locale JSON missing');
});

check('client module syntax', () => {
  const source = read('client.js');
  new vm.Script(source, { filename: 'client.js' });
});

check('client module identity', () => {
  const source = read('client.js');
  assert(source.includes("id: '" + manifest.name + "'"), 'ModuleLoader id differs from the package name');
  assert(source.includes("'sidebar.panellist'"), 'client no longer targets the sidebar.panellist slot');
  assert(source.includes('entriesOfSlot'), 'client no longer reads the panel registry');
});

check('locale resources', () => {
  for (const locale of ['en', 'zh']) {
    const path = join(root, 'locale', locale + '.json');
    assert(existsSync(path), 'missing locale/' + locale + '.json');
    const parsed = JSON.parse(read(join('locale', locale + '.json')));
    assert(parsed.meta && parsed.meta.title, locale + ': meta.title missing');
    assert(parsed.meta && parsed.meta.description, locale + ': meta.description missing');
  }
});

check('icon resource', () => {
  const path = join(root, 'icon.svg');
  assert(existsSync(path), 'icon.svg missing');
  const size = statSync(path).size;
  assert(size > 0 && size <= 256 * 1024, 'icon size out of range: ' + size);
  assert(read('icon.svg').trimStart().startsWith('<svg'), 'icon.svg does not start with <svg');
});

check('files list covers runtime and display assets', () => {
  const required = ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg', 'locale/*.json'];
  for (const entry of required) {
    assert(manifest.files.includes(entry), 'files misses ' + entry);
  }
});

await checkAsync('host entry point exports apply', async () => {
  const module = await import(pathToFileURL(join(root, 'index.js')).href);
  assert(typeof module.apply === 'function', 'index.js does not export apply()');
});

if (failures > 0) {
  console.log('\n' + failures + ' check(s) failed');
  process.exit(1);
}
console.log('\nall checks passed');
