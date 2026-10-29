'use strict';
const { AppError } = require('./errorMiddleware');

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError(403, 'No tienes permisos para esta acción.', 'FORBIDDEN'));
  }
  next();
};

module.exports = { requireRole, requireAdmin: requireRole('administrador') };
