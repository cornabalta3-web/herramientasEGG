// Service worker de Brote: solo recibe los avisos y los muestra.
// No guarda nada en caché, así la app siempre carga la última versión.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Brote', {
    body: data.body || 'Tus plantas te necesitan.',
    icon: 'icons/icon-192.png',
    tag: data.tag || 'brote',
    renotify: true,
    data: { url: data.url || './#hoy' },
  }));
});

// Al tocar el aviso, abre la app (o la trae al frente) en "Hoy".
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './#hoy', self.registration.scope).href;
  event.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) {
      if (v.url.startsWith(self.registration.scope)) {
        await v.focus();
        if ('navigate' in v) { try { await v.navigate(url); } catch { /* sigue abierta igual */ } }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
