const KEY = 'mailpilot.token';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function getToken() {
  return localStorage.getItem(KEY) || '';
}

export function setToken(token) {
  if (token) localStorage.setItem(KEY, token);
  else localStorage.removeItem(KEY);
}

async function request(path, { method = 'GET', body, delay = 0 } = {}) {
  const started = Date.now();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (delay) {
    const elapsed = Date.now() - started;
    if (elapsed < delay) await new Promise((r) => setTimeout(r, delay - elapsed));
  }

  if (!res.ok) {
    if (res.status === 401) setToken('');
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

export const api = {
  get: (path, delay) => request(path, { delay }),
  post: (path, body, delay) => request(path, { method: 'POST', body, delay }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path, body) => request(path, { method: 'DELETE', body }),
};
