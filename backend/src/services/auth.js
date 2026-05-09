import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      displayName: user.display_name,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}
