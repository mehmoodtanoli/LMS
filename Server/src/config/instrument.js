import "dotenv/config";
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,

  enabled: Boolean(dsn),

  environment:
    process.env.SENTRY_ENVIRONMENT ||
    process.env.NODE_ENV ||
    "development",

  sendDefaultPii: false,

  tracesSampleRate: 0.1,

  integrations: [
    Sentry.expressIntegration(),
  ],

  beforeSend(event) {
    // Never send user identity.
    delete event.user;

    // Remove potentially sensitive request information.
    if (event.request) {
      delete event.request.headers;
      delete event.request.cookies;
      delete event.request.data;
      delete event.request.query_string;
      delete event.request.env;
      delete event.request.url;
    }

    return event;
  },
});

export default Sentry;