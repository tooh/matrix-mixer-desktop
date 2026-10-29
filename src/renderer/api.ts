export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  const storedUser = localStorage.getItem('matrix_mixer_user');
  if (storedUser) {
    try {
      const u = JSON.parse(storedUser);
      headers['X-User-Id'] = u.id;
      headers['X-User-Role'] = u.role;
    } catch (e) {
      // ignore
    }
  }

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
