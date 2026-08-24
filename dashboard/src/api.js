const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const ADMIN_KEY_STORAGE = 'atlaswatch_admin_key';

/**
 * The operator endpoints require an admin key. It is held in sessionStorage so
 * it is gone when the browser tab closes, and never written into the bundle.
 */
export function getAdminKey() {
  try {
    return sessionStorage.getItem(ADMIN_KEY_STORAGE) || import.meta.env.VITE_ADMIN_KEY || '';
  } catch {
    return import.meta.env.VITE_ADMIN_KEY || '';
  }
}

export function setAdminKey(key) {
  try {
    sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
  } catch {
    // Private browsing modes can refuse storage; the key still works for this render.
  }
}

export function clearAdminKey() {
  try {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
  } catch {
    // ignore
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super('The admin key was rejected');
    this.name = 'UnauthorizedError';
  }
}

async function request(path, { method = 'GET' } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': getAdminKey(),
    },
    cache: 'no-store',
  });

  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) throw new Error(`${method} ${path} failed with ${response.status}`);
  return response.json();
}

export const api = {
  profiles: () => request('/admin/profiles'),
  sosAlerts: () => request('/sos/alerts'),
  anomalyLog: () => request('/anomaly-log'),
  resolveAlert: id => request(`/sos/${id}/resolve`, { method: 'POST' }),
};

export { API_BASE };
