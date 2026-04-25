const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE ||
  'https://api.radar-mr.com/api/v1';

const ACCESS_KEY = 'admin_access_token';
const REFRESH_KEY = 'admin_refresh_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function setToken(access: string, refresh?: string) {
  try {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  } catch {
    // ignore
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    // ignore
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: any; token?: string | null } = {},
): Promise<T> {
  const method = opts.method || (opts.body ? 'POST' : 'GET');
  const token = opts.token ?? getToken();
  const headers: Record<string, string> = {};
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: opts.body
      ? opts.body instanceof FormData
        ? opts.body
        : JSON.stringify(opts.body)
      : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data as T;
}

// `api` is intentionally typed as `any` to keep the admin UI flexible across
// backend versions and avoid large compile-time coupling.
export const api: any = {
  request,
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: { email, password } }),

  // Feature flags (new)
  adminAppFeatures: () => request('/billing/admin/app-features'),
  setAdminAppFeature: (key: string, is_active: boolean) =>
    request(`/billing/admin/app-features/${encodeURIComponent(key)}`, { method: 'PUT', body: { is_active } }),
  disableAllAppFeatures: () =>
    request('/billing/admin/app-features/disable-all', { method: 'POST' }),

  adminPremiumFeatures: () => request('/billing/admin/features'),
  setAdminPremiumFeature: (key: string, is_active: boolean) =>
    request(`/billing/admin/features/${encodeURIComponent(key)}`, { method: 'PUT', body: { is_active } }),
  disableAllPremiumFeatures: () =>
    request('/billing/admin/features/disable-all', { method: 'POST' }),
};

