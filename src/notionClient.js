const API_BASE = import.meta.env.VITE_LOCAL_API_URL || 'http://127.0.0.1:8787';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Notion request failed.');
    error.code = data.code || null;
    error.missing = data.missing || null;
    throw error;
  }
  return data;
}

export function getNotionStatus() {
  return request('/api/notion/status');
}

export function testNotionConnection() {
  return request('/api/notion/test', { method: 'POST' });
}

export function importNotionTrades() {
  return request('/api/notion/import', { method: 'POST' });
}
