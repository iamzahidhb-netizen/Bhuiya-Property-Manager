import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../../public/sw.js', import.meta.url), 'utf8');
const handlers = new Map();
const storedCaches = new Map();
const unrelatedCacheName = 'another-app-cache';
const oldAppCacheName = 'bhuiya-property-manager-v5-hyperos';
let networkFetchCount = 0;
const shellResponse = { source: 'cached-shell' };

function createCache(entries = new Map()) {
  return {
    async addAll(paths) {
      for (const path of paths) entries.set(path, { source: `precache:${path}` });
    },
    async match(request) {
      return entries.get(typeof request === 'string' ? request : request.url) || null;
    },
    async put(request, response) {
      entries.set(typeof request === 'string' ? request : request.url, response);
    },
  };
}

storedCaches.set(oldAppCacheName, createCache());
storedCaches.set(unrelatedCacheName, createCache());
const cacheStorage = {
  async open(name) {
    if (!storedCaches.has(name)) storedCaches.set(name, createCache());
    return storedCaches.get(name);
  },
  async keys() {
    return [...storedCaches.keys()];
  },
  async delete(name) {
    return storedCaches.delete(name);
  },
};

const context = {
  URL,
  Promise,
  console,
  caches: cacheStorage,
  fetch: async () => {
    networkFetchCount += 1;
    return { status: 200, clone() { return { source: 'network-shell' }; } };
  },
  self: {
    location: { origin: 'https://staging.example.test' },
    clients: { claim() { throw new Error('updates must not claim old tabs'); } },
    skipWaiting() { throw new Error('updates must wait for existing tabs'); },
    addEventListener(name, handler) {
      handlers.set(name, handler);
    },
  },
};

vm.runInNewContext(source, context);
assert.doesNotMatch(source, /self\.skipWaiting\(/);
assert.doesNotMatch(source, /self\.clients\.claim\(/);
assert.doesNotMatch(source, /indexedDB|deleteDatabase/);
assert.match(source, /name\.startsWith\(CACHE_PREFIX\)/);

let installation;
handlers.get('install')({ waitUntil(promise) { installation = promise; } });
await installation;

let activation;
handlers.get('activate')({ waitUntil(promise) { activation = promise; } });
await activation;
assert.equal(storedCaches.has(oldAppCacheName), false);
assert.equal(storedCaches.has(unrelatedCacheName), true);

const currentCacheName = (await cacheStorage.keys()).find((name) =>
  name.startsWith('bhuiya-property-manager-')
);
assert.ok(currentCacheName);
const currentCache = await cacheStorage.open(currentCacheName);
await currentCache.put('/index.html', shellResponse);

let navigationResponse;
handlers.get('fetch')({
  request: {
    url: 'https://staging.example.test/rent',
    mode: 'navigate',
    method: 'GET',
  },
  respondWith(promise) {
    navigationResponse = promise;
  },
});
assert.equal((await navigationResponse).status, 200);
assert.equal((await currentCache.match('/index.html')).source, 'network-shell');

context.fetch = async () => {
  throw new Error('offline');
};
let offlineResponse;
handlers.get('fetch')({
  request: {
    url: 'https://staging.example.test/rent',
    mode: 'navigate',
    method: 'GET',
  },
  respondWith(promise) {
    offlineResponse = promise;
  },
});
assert.equal((await offlineResponse).source, 'network-shell');

const hashedAsset = {
  url: 'https://staging.example.test/assets/index-a1b2c3d4.js',
};
const cachedAsset = { source: 'cached-hashed-asset' };
await currentCache.put(hashedAsset, cachedAsset);
let assetResponse;
handlers.get('fetch')({
  request: { ...hashedAsset, mode: 'no-cors', method: 'GET' },
  respondWith(promise) {
    assetResponse = promise;
  },
});
assert.equal((await assetResponse).source, 'cached-hashed-asset');
assert.equal(networkFetchCount, 1);

console.log('PWA cache lifecycle checks: 12 passed, 0 failed.');
