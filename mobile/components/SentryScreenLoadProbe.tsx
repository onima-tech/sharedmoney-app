import * as Sentry from "@sentry/react-native";
import React, { useEffect, useState } from "react";
import {
  getPublishedSentryRoute,
  subscribeSentryRoute,
} from "../utils/sentryTracingPolicy";

/**
 * Remounts TimeToInitialDisplay whenever the custom router changes screens.
 * Lives outside AppContent so we do not have to wrap every early return.
 */
export function SentryScreenLoadProbe() {
  const [route, setRoute] = useState(getPublishedSentryRoute);

  useEffect(() => subscribeSentryRoute(setRoute), []);

  return <Sentry.TimeToInitialDisplay key={route} record={true} />;
}
