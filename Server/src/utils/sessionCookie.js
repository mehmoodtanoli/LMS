import jwt from "jsonwebtoken";

// The session JWT lives in an httpOnly cookie so page scripts (and any XSS) cannot read it.
// The client calls the API through its own domain (Client/vercel.json rewrite), so the
// cookie is first-party and SameSite=Lax blocks it on cross-site requests.
export const SESSION_COOKIE = "lms_session";
const COOKIE_PATH = "/api";

export function setSessionCookie(res, token) {
  const { exp } = jwt.decode(token) || {};
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    ...(exp ? { expires: new Date(exp * 1000) } : {}),
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
  });
}

export function readSessionCookie(req) {
  const match = (req.headers.cookie || "").match(
    new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}
