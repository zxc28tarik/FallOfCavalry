export function isDevMode() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('dev') === '1') return true;
  } catch { /* URL parse hatası — tarayıcı dışı ortam */ }
  try {
    return localStorage.getItem('foc:dev') === '1';
  } catch { /* localStorage erişim hatası */ }
  return false;
}

export function loadTuningFromStorage() {
  try {
    const raw = localStorage.getItem('foc:tuning');
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    return obj;
  } catch {
    return null;
  }
}
