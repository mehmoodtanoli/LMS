import posthog from "posthog-js";

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

let enabled = false;
let identifiedUserId = null;
let userContext = {};

export function initializeAnalytics() {
  if (enabled || !posthogKey) return;

  posthog.init(posthogKey, {
    api_host: posthogHost,
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: false,
    mask_all_text: true,
    mask_all_element_attributes: true,
    person_profiles: "identified_only",
  });
  enabled = true;
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
  if (!enabled) return;
  const safeProperties = Object.fromEntries(
    Object.entries(properties).filter(([key]) => key === "test_count")
  );
  posthog.capture(eventName, { ...userContext, ...safeProperties });
}
