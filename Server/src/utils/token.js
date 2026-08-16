import jwt from "jsonwebtoken";
import env from "../config/env.js";

function signToken(payload) {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch (error) {
    throw new Error("Invalid or expired token.");
  }
}

export { signToken, verifyToken };
