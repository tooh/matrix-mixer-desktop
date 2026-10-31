import { UserSession } from './types';

export function getStoredUser(): UserSession | null {
  try {
    const stored = localStorage.getItem('matrix_mixer_user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const user = getStoredUser();
  if (user && user.role) {
    headers['X-User-Id'] = user.id || 'anonymous';
    headers['X-User-Role'] = user.role;
  } else {
    headers['X-User-Role'] = 'GUEST';
  }
  return headers;
}

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...(options.headers as Record<string, string> || {})
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      let msg = text;
      try {
        const j = JSON.parse(text);
        if (j.error) msg = j.error;
      } catch (e) {}
      throw new Error(msg || `Serverfout (${res.status})`);
    }

    return await res.json() as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Verzoek time-out (30s): Server reageert niet op tijd.');
    }
    throw err;
  }
}
