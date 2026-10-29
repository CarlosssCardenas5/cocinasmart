'use strict';

class AppError extends Error {
  constructor(status, message, code = 'ERROR', extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

// Express 4 no captura promesas rechazadas: este envoltorio las manda a next(err).
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, res) {
  res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Ruta no encontrada' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.name === 'ZodError') {
    return res.status(400).json({
      ok: false, code: 'VALIDATION',
      message: 'Datos inválidos',
      details: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    });
  }
  if (err.code === 11000) {
    return res.status(409).json({ ok: false, code: 'DUPLICATE', message: 'Ese registro ya existe' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ ok: false, code: 'BAD_ID', message: 'Identificador inválido' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, code: 'BAD_JSON', message: 'JSON mal formado' });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ ok: false, code: err.code, message: err.message, ...err.extra });
  }
  console.error('[ERROR]', err);
  res.status(500).json({ ok: false, code: 'INTERNAL', message: 'Error interno. Inténtalo de nuevo en unos minutos.' });
}

module.exports = { AppError, asyncHandler, notFound, errorHandler };
