// Minimal service worker, present only to satisfy Chrome's PWA installability criteria
// (a manifest plus a fetch-handling service worker). Deliberately does no caching: this is a
// live multiplayer game backed by a real-time server (Socket.IO), so serving anything from a
// cache instead of the network would risk showing stale room/game state. It only ever lets
// requests pass straight through to the network.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // No-op: every request is handled by the browser's normal network fetch.
});
