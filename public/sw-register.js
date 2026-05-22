(function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function onLoad() {
    navigator.serviceWorker.register('/sw.js').catch(function onError() {
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: '离线能力注册失败，不影响在线使用。', type: 'error' },
      }));
    });
  });
}());
