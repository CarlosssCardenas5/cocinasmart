'use strict';
const env = require('../config/env');

// fetch con timeout. Lanza Error con .status (HTTP) o .name 'AbortError' (timeout) o error de red.
async function fetchJson(url, { method = 'GET', headers = {}, body, timeoutMs = env.HTTP_TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, headers, body, signal: ctrl.signal });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} en ${new URL(url).hostname}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchJson };
