---
name: Transit Route
description: A focused Delhi NCR trip planner with a charcoal transit-tool interface and cyan route actions.
colors:
  background: "#242321"
  surface: "#2B2C2D"
  elevated: "#333638"
  text: "#94A3B8"
  heading: "#D9EEF5"
  muted: "#7FA6B6"
  brand: "#38BDF8"
  secondary: "#F59E0B"
  outline: "#5A554B"
typography:
  display:
    fontFamily: "Trebuchet MS, Arial, Helvetica, sans-serif"
    fontSize: "clamp(2rem, 5vw, 4rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "8px"
  md: "12px"
  lg: "14px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.background}"
    rounded: "{rounded.sm}"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
---

# Design System: Transit Route

## Overview

Transit Route is an operate-first journey planner for Delhi NCR. The interface should feel like a practical tool used during trip planning: dark, calm, high-contrast, and specific to route decisions.

The visual anchor is the real planner preview: origin and destination fields, transport mode chips, and routing priorities. Cyan is reserved for actions and selected route states. Charcoal surfaces, quiet borders, and restrained shadows provide structure without glass effects or decorative glow.

## Colors

- **Charcoal background** (#242321): Application ground and navigation field.
- **Surface charcoal** (#2B2C2D): Search panels, cards, and controls.
- **Elevated charcoal** (#333638): Hover and expanded control surfaces.
- **Cyan brand** (#38BDF8): Primary actions, active states, and route emphasis.
- **Amber secondary** (#F59E0B): Important warnings and secondary transit signals.
- **Cool text** (#94A3B8): Supporting text and metadata.
- **Heading ice** (#D9EEF5): High-priority headings and control values.
- **Blue-gray muted** (#7FA6B6): Labels and secondary descriptions.
- **Warm outline** (#5A554B): Borders and separators.

## Typography

Body copy uses Arial for reliable scanability. Headings use Trebuchet MS to add a recognizable humanist shape without importing a fashionable display font. Headline tracking stays between -0.02em and -0.025em; never use tighter tracking than -0.04em.

## Layout

The first screen is an asymmetric planner layout: the interactive phone-scale planner leads on the left, while trip guidance, a real product screenshot, recent journeys, and the supporting headline sit on the right. On mobile, the planner becomes a full-width flow with fixed bottom navigation.

## Components

### Buttons

- Primary buttons use a solid #38BDF8 fill with dark text.
- Hover states shift brightness and add neutral depth, never a gradient or colored glow.
- Secondary controls use transparent or surface charcoal fills with a 1px warm outline.

### Cards

- Cards use solid charcoal backgrounds, 1px outlines, 12px–14px radii, and soft neutral shadows.
- No card uses `backdrop-filter`, frosted glass, decorative grid backgrounds, or a colored side tab thicker than 1px.

### Planner Controls

- Origin and destination fields remain the most prominent controls.
- Modes are compact, rounded chips with meaningful vehicle illustrations.
- Routing priority uses a solid cyan selected state.
- “Popular City Routes” is a text label, not a decorative sparkle treatment.

### Product Media

- The first two screens include `/transit-route-product-shot.png`, a real screenshot of the planner surface.
- The phone mockup remains a functional interactive planner, not a decorative illustration.

## Rules

- Preserve all product copy, places, modes, prices, links, and factual caveats.
- Use at most one gradient, never on a button or text.
- Keep icons only when they help identify an action, mode, or state.
- Do not use sparkle or magic-wand icons.
- Do not use exact Tailwind slate, gray, or zinc colors for the neutral system.
- Keep reduced-motion and visible keyboard focus states.
