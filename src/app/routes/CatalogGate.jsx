import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { EventLanding } from "../../features/events/EventLanding.jsx";
import { findEventBySlug } from "../../features/events/events-catalog.js";

export function CatalogGate({ auth, children }) {
  if (auth.needsOnboarding) return <Navigate to="/onboarding" replace />;
  return children;
}

export function EventLandingRoute() {
  const { slug } = useParams();
  const event = findEventBySlug(slug);
  if (!event) return <Navigate to="/eventos" replace />;
  return <EventLanding event={event} />;
}
