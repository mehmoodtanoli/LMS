import posthog from "posthog-js";

const posthogKey = (import.meta.env.VITE_POSTHOG_KEY || "").trim();
const posthogHost = (
  import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com"
).trim();

let enabled = false;
let identifiedUserId = null;
let userContext = {};
let missingConfigurationReported = false;

function reportDevelopment(message, error) {
  if (!import.meta.env.DEV) return;
  if (error) {
    console.warn(`[analytics] ${message}`, error);
  } else {
    console.warn(`[analytics] ${message}`);
  }
}

export function initializeAnalytics() {
  if (enabled) return;
  if (!posthogKey) {
    if (!missingConfigurationReported) {
      reportDevelopment(
        "PostHog is disabled because VITE_POSTHOG_KEY is missing from the frontend build."
      );
      missingConfigurationReported = true;
    }
    return;
  }

  try {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      capture_pageview: "history_change",
      capture_pageleave: true,
      autocapture: false,
      mask_all_text: true,
      mask_all_element_attributes: true,
      person_profiles: "identified_only",
      loaded: () => {
        if (import.meta.env.DEV) {
          console.info(`[analytics] PostHog initialized with host ${posthogHost}.`);
        }
      },
    });
    enabled = true;
  } catch (error) {
    reportDevelopment("PostHog initialization failed.", error);
  }
}

export function identifyAnalyticsUser(user) {
  if (!enabled) return;

  if (!user) {
    if (identifiedUserId) posthog.reset();
    identifiedUserId = null;
    userContext = {};
    return;
  }

  const context = {
    role: user.role,
    laboratory_id: user.laboratoryId || undefined,
  };
  userContext = context;

  if (identifiedUserId === user.id) return;
  posthog.identify(user.id, context);
  identifiedUserId = user.id;
}

export function trackAnalyticsEvent(eventName, properties = {}) {
  if (!enabled) {
    reportDevelopment(`Skipped event "${eventName}" because PostHog is disabled.`);
    return;
  }
  const safeProperties = Object.fromEntries(
    Object.entries(properties).filter(([key]) => key === "test_count")
  );
  posthog.capture(eventName, { ...userContext, ...safeProperties });
}
