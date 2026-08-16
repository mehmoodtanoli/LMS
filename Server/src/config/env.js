import dotenv from "dotenv";

dotenv.config();

const REQUIRED_ENV_VARS = [
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
];

function validateRequiredVars() {
  const missing = REQUIRED_ENV_VARS.filter((key) => {
    const value = process.env[key];
    return value === undefined || value === null || value.trim() === "";
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Please check your .env file against .env.example.",
    );
  }
}

function validatePort() {
  const rawPort = process.env.PORT;
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      "Invalid environment variable: PORT must be an integer between 1 and 65535.",
    );
  }

  return port;
}

validateRequiredVars();
const validatedPort = validatePort();

const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV,
  port: validatedPort,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV === "development",
  isTest: process.env.NODE_ENV === "test",
});

export default env;
