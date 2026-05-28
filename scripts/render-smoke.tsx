// Verifies the React tree mounts and the store boots to the right screen.
import assert from 'node:assert';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

// Minimal in-memory localStorage shim so the store can boot under Node.
const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  key: (i: number) => Object.keys(store)[i] ?? null,
  get length() { return Object.keys(store).length; },
} as Storage;

const { App } = await import('../src/App');
const { AppProvider } = await import('../src/store/AppContext');

// 1) Fresh boot -> Activation screen.
let html = renderToString(createElement(AppProvider, null, createElement(App)));
assert.ok(html.includes('Activation token'), 'fresh boot should show the Activation screen');
assert.ok(html.includes('s-Log Recorder'), 'brand should render');
console.log('  ✓ fresh boot renders the Activation screen');

// 2) With an activated vessel + remembered session + initialized DB -> app shell.
const { seedDB } = await import('../src/data/seed');
const { activateWithToken } = await import('../src/server/mockServer');
const { hashPassword } = await import('../src/store/persistence');
const cfg = activateWithToken('OCEANLY-DEMO-2026').config!;
store['slog.activation'] = JSON.stringify({ token: 'OCEANLY-DEMO-2026', config: cfg, pwHash: hashPassword('Abcdefghij1!'), activatedAt: new Date().toISOString() });
store['slog.session'] = JSON.stringify({ remembered: true, lastActive: new Date().toISOString() });
store['slog.db'] = JSON.stringify(seedDB(cfg));

html = renderToString(createElement(AppProvider, null, createElement(App)));
assert.ok(html.includes('MV Nordic Voyager'), 'app shell should show vessel name');
assert.ok(html.includes('Overview'), 'navigation should render');
assert.ok(html.includes('Communication'), 'outbox nav should render');
console.log('  ✓ activated + remembered + initialized boots into the app shell');

console.log('\nReact render smoke checks passed ✅');
