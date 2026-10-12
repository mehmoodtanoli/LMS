import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import posthog from "posthog-js";
import { PostHogProvider } from "@posthog/react";

import { AuthProvider } from "./auth/AuthContext";
import App from "./App";
import "./styles.css";

posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_POSTHOG_HOST,
  defaults: "2026-05-30",
  person_profiles: "identified_only",
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  disable_session_recording: true,
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {" "}
    <PostHogProvider client={posthog}>
      {" "}
      <BrowserRouter>
        {" "}
        <AuthProvider>
          {" "}
          <App />{" "}
        </AuthProvider>{" "}
      </BrowserRouter>{" "}
    </PostHogProvider>
  </React.StrictMode>,
);
