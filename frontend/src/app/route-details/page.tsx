"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, ExternalLink, IndianRupee, MapPinned, Route as RouteIcon } from "lucide-react";
import { VehicleIllustration } from "@/components/VehicleIllustration";
import { RouteOption, TransitMode } from "@/types/transit";

const MODE_COLOR: Record<TransitMode, string> = {
  metro: "#A7B58A",
  train: "#38BDF8",
  bus: "#C47A44",
  auto: "#D2A85A",
  walk: "#829A86",
};

const formatMode = (mode: TransitMode) => mode.charAt(0).toUpperCase() + mode.slice(1);

export default function RouteDetailsPage() {
  const [route, setRoute] = useState<RouteOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeLeg, setActiveLeg] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const routeId = params.get("routeId");
    const leg = Number(params.get("leg"));
    if (Number.isFinite(leg) && leg >= 0) setActiveLeg(leg);
    if (!routeId) {
      setError("This route details link is missing a route.");
      return;
    }

    try {
      const stored = window.localStorage.getItem(`transit-route:${routeId}`);
      if (!stored) {
        setError("This route has expired. Return to results and open the route again.");
        return;
      }
      setRoute(JSON.parse(stored) as RouteOption);
    } catch (storageError) {
      console.error("Unable to load route details:", storageError);
      setError("We could not load this route. Return to results and try again.");
    }
  }, []);

  const totalStops = useMemo(
    () => route?.legs.reduce((count, leg) => count + 1 + (leg.intermediateStops?.length || 0), 0) || 0,
    [route],
  );

  if (error) {
    return (
      <main className="route-details-page">
        <div className="route-details-empty">
          <RouteIcon size={28} />
          <h1>Route details unavailable</h1>
          <p>{error}</p>
          <Link className="route-details-back-button" href="/">
            <ArrowLeft size={16} /> Return to planner
          </Link>
        </div>
      </main>
    );
  }

  if (!route) {
    return (
      <main className="route-details-page">
        <div className="route-details-loading">Loading full route…</div>
      </main>
    );
  }

  return (
    <main className="route-details-page">
      <div className="route-details-shell">
        <header className="route-details-header">
          <Link className="route-details-back-link" href="/">
            <ArrowLeft size={16} /> Back to results
          </Link>
          <p className="eyebrow">Full route details</p>
          <h1>{route.title}</h1>
          <p className="route-details-subtitle">{route.summary}</p>
          <div className="route-details-metrics">
            <span><Clock3 size={15} /> {route.totalDurationMinutes} min</span>
            <span><IndianRupee size={15} /> {route.totalFare ?? "—"}</span>
            <span><MapPinned size={15} /> {totalStops} stops</span>
            <span>{route.transfersCount} transfers</span>
          </div>
        </header>

        <div className="route-details-layout">
          <nav className="route-details-leg-nav" aria-label="Route sections">
            <p className="route-details-nav-label">Journey sections</p>
            {route.legs.map((leg, index) => (
              <button
                type="button"
                key={`${leg.legIndex}-${leg.from}`}
                className={activeLeg === index ? "active" : ""}
                onClick={() => setActiveLeg(index)}
              >
                <span className="route-details-nav-icon" style={{ color: MODE_COLOR[leg.mode] }}>
                  <VehicleIllustration mode={leg.mode} size="xs" />
                </span>
                <span>
                  <strong>{leg.lineName || formatMode(leg.mode)}</strong>
                  <small>{leg.from} → {leg.to}</small>
                </span>
              </button>
            ))}
          </nav>

          <section className="route-details-content">
            {route.legs.map((leg, index) => {
              const previousLeg = route.legs[index - 1];
              const interchange =
                index > 0 &&
                previousLeg?.mode === "metro" &&
                leg.mode === "metro" &&
                previousLeg.lineName !== leg.lineName;
              const stops = [leg.from, ...(leg.intermediateStops || []), leg.to];

              return (
                <article className={`route-details-leg ${activeLeg === index ? "is-active" : ""}`} key={`${leg.legIndex}-${leg.to}`}>
                  {interchange && (
                    <div className="route-details-interchange">
                      <strong>↔ Interchange at {previousLeg.to}</strong>
                      <span>Change from {previousLeg.lineName || "the previous line"} to {leg.lineName || "the next line"}.</span>
                      <span>
                        Arrive: {previousLeg.platform || "Platform information unavailable"} · Continue: {leg.platform || "check station signage"}
                      </span>
                    </div>
                  )}
                  <div className="route-details-leg-title">
                    <div>
                      <p className="route-details-kicker">{formatMode(leg.mode)} leg {index + 1}</p>
                      <h2>{leg.from} <span>to</span> {leg.to}</h2>
                    </div>
                    <span className="route-details-duration" style={{ color: MODE_COLOR[leg.mode] }}>
                      {leg.durationMinutes} min
                    </span>
                  </div>

                  <div className="route-details-stop-list">
                    {stops.map((stop, stopIndex) => {
                      const estimatedMinutes = Math.round((leg.durationMinutes * stopIndex) / Math.max(stops.length - 1, 1));
                      return (
                        <div className="route-details-stop" key={`${leg.legIndex}-${stopIndex}-${stop}`}>
                          <span className="route-details-stop-marker" style={{ background: MODE_COLOR[leg.mode] }} />
                          <span className="route-details-stop-name">{stop}</span>
                          <span className="route-details-stop-time">{estimatedMinutes} min</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="route-details-facts">
                    <span>{leg.distanceKm} km {leg.distanceSource === "road" ? "by road" : "estimated"}</span>
                    <span>{leg.fare ? `₹${leg.fare}` : "No separate fare"}</span>
                    {leg.platform && <span>Platform {leg.platform}</span>}
                  </div>

                  {leg.scheduledTiming && (
                    <div className="route-details-timing">
                      <strong>{leg.mode === "bus" ? "Scheduled timing" : "Live schedule"}</strong>
                      <span>Departs {leg.scheduledTiming.departureTime} · Arrives {leg.scheduledTiming.arrivalTime}</span>
                      {leg.scheduledTiming.note && <small>{leg.scheduledTiming.note}</small>}
                    </div>
                  )}

                  {leg.instruction && <p className="route-details-instruction">{leg.instruction}</p>}
                  <a className="route-details-map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(leg.to)}`} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} /> Open destination in Maps
                  </a>
                </article>
              );
            })}
          </section>
        </div>
      </div>
    </main>
  );
}
