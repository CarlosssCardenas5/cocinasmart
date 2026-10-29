'use strict';
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../middlewares/authMiddleware');
const { AppError, asyncHandler } = require('../middlewares/errorMiddleware');
const schemas = require('../validators/authSchemas');

// Hash "señuelo" para que login con correo inexistente tarde igual que uno existente.
const DUMMY_HASH = bcrypt.hashSync('no-existe', 12);

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = schemas.register.parse(req.body);
  if (await User.exists({ email })) throw new AppError(409, 'Ese correo ya está registrado.', 'DUPLICATE');
  const passwordHash = await bcrypt.hash(password, 12);
  // El rol NUNCA viene del cliente: siempre "usuario".
  const user = await User.create({ name, email, passwordHash, role: 'usuario' });
  res.status(201).json({ ok: true, token: signToken(user), user });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = schemas.login.parse(req.body);
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !valid) throw new AppError(401, 'Correo o contraseña incorrectos.', 'AUTH');
  if (!user.active) throw new AppError(403, 'Tu cuenta está desactivada.', 'FORBIDDEN');
  res.json({ ok: true, token: signToken(user), user });
});

const getProfile = asyncHandler(async (req, res) => res.json({ ok: true, user: req.user }));

const updateProfile = asyncHandler(async (req, res) => {
  const data = schemas.profileUpdate.parse(req.body);
  if (data.name) req.user.name = data.name;
  if (data.preferences) {
    for (const [k, v] of Object.entries(data.preferences)) req.user.preferences[k] = v;
  }
  await req.user.save();
  res.json({ ok: true, user: req.user });
});

module.exports = { register, login, getProfile, updateProfile };
