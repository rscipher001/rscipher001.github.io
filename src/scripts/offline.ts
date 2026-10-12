// Saves the site for offline reading (production builds only) and says when the reader is offline.
export function setUpOffline() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('Offline reading is unavailable:', error));
    });
  }

  const note = document.querySelector<HTMLElement>('.offline-note');
  if (!note) return;
  const update = () => (note.hidden = navigator.onLine);
  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
}
