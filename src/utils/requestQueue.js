'use strict';
const { AppError } = require('../middlewares/errorMiddleware');

/**
 * Cola con ventana deslizante: ejecuta como máximo `limit` tareas por `windowMs`.
 * Las tareas extra esperan su turno (FIFO); si esperan más de `maxWaitMs` se rechazan
 * con 429 para no bloquear al usuario indefinidamente.
 * Open Food Facts (por IP): 15 lecturas/min y 10 búsquedas/min.
 */
class RequestQueue {
  constructor({ limit, windowMs = 60_000, maxWaitMs = 15_000, name = 'cola' }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxWaitMs = maxWaitMs;
    this.name = name;
    this.stamps = [];
    this.pending = [];
    this.timer = null;
  }

  schedule(fn) {
    return new Promise((resolve, reject) => {
      this.pending.push({ fn, resolve, reject, at: Date.now() });
      this._drain();
    });
  }

  _drain() {
    clearTimeout(this.timer);
    const now = Date.now();
    this.stamps = this.stamps.filter((t) => now - t < this.windowMs);

    while (this.pending.length) {
      const job = this.pending[0];
      if (Date.now() - job.at > this.maxWaitMs) {
        this.pending.shift();
        job.reject(new AppError(429, 'El servicio externo está saturado. Inténtalo en un minuto.', 'QUEUE_TIMEOUT'));
        continue;
      }
      if (this.stamps.length >= this.limit) break;
      this.pending.shift();
      this.stamps.push(Date.now());
      Promise.resolve().then(job.fn).then(job.resolve, job.reject);
    }

    if (this.pending.length) {
      const untilSlot = this.stamps[0] + this.windowMs - Date.now();
      const untilExpire = this.pending[0].at + this.maxWaitMs - Date.now();
      this.timer = setTimeout(() => this._drain(), Math.max(50, Math.min(untilSlot, untilExpire)));
    }
  }

  get size() { return this.pending.length; }
}

module.exports = { RequestQueue };
