// Notifications de l'appli (chiffre d'affaires du jour à 18 h 30)
self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { corps: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(d.titre || 'France Bumper', {
      body: d.corps || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: 'chiffre-affaires',
      renotify: true,
      data: { url: d.url || './' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const cible = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href + '#chiffre';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if ('focus' in f) {
          f.postMessage({ type: 'ouvrir-onglet', onglet: 'chiffre' });
          return f.focus();
        }
      }
      return self.clients.openWindow(cible);
    })
  );
});
