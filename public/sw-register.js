(function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    navigator.serviceWorker.getRegistrations().then(function unregisterLocal(registrations) {
      registrations.forEach(function unregister(registration) {
        registration.unregister();
      });
    });
    return;
  }

  window.addEventListener('load', function onLoad() {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function onError() {
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: '离线能力注册失败，不影响在线使用。', type: 'error' },
      }));
    });
  });
}());
