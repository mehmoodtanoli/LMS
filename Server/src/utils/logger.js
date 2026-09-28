const SENSITIVE_KEYS = [
  "password",
  "confirmpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "jwt",
  "jwtsecret",
  "secret",
  "authorization",
  "apikey",
];

function sanitize(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item));
  }

  if (typeof value === "object") {
    const sanitized = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitize(val);
      }
    }
    return sanitized;
  }

  return value;
}

function timestamp() {
  return new Date().toISOString();
}

function formatArgs(args) {
  return args.map((arg) => (typeof arg === "object" ? sanitize(arg) : arg));
}

const logger = {
  info(...args) {
    console.log(`[INFO] [${timestamp()}]`, ...formatArgs(args));
  },

  warn(...args) {
    console.warn(`[WARN] [${timestamp()}]`, ...formatArgs(args));
  },

  error(...args) {
    console.error(`[ERROR] [${timestamp()}]`, ...formatArgs(args));
  },
};

export default logger;
