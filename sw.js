// Service worker – zapisuje pliki aplikacji w pamięci telefonu,
// dzięki czemu Fiszki działają także bez internetu.

// Zmień numer wersji po każdej zmianie w plikach, żeby telefon pobrał nowe.
const CACHE = 'fiszki-v4';

const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Instalacja: pobierz i zapisz wszystkie pliki
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

// Aktywacja: usuń stare wersje
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Każde żądanie: najpierw spróbuj z internetu, a gdy go nie ma – z pamięci
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
