# Uno Gallery prototype

An interactive sample gallery for Uno Platform controls and patterns, designed
with the `elayadesign/ai-design-skills` collection (vendored in `design-skills/`,
MIT, commit `a2735a3`).

- `landing-page-design` sets the visual system: Geist, the Tailwind type scale,
  the 2–96 px spacing table, nested radii, flat backgrounds, Phosphor icons,
  the `cubic-bezier(0.22,1,0.36,1)` base curve, full state sets.
- `design-to-motion` (website context) sets the card motion: cards rise in with
  blur once on scroll, then each preview acts out a short story, paused off screen.

The skills live beside the prototype, outside `.claude/skills/`, because
`landing-page-design` claims all web UI work and would otherwise steer the
Afterhours game client away from its own art direction (`DESIGN.txt`).

## Architecture Brief

- **Structure.** One self-contained page, `index.html`. It is published as a
  claude.ai Artifact, which wraps it in the document skeleton, so the file has no
  `<html>`/`<head>`/`<body>`. Icons are inlined Phosphor path data.
- **State model.** Each sample is a plain object: `defaults`, a `props` schema,
  `mount(host, api)` returning `update(state)`, an optional pure
  `story(t, state)`, and code generators (`xaml`, `csm`, or `model`).
  An instance owns its state; `api.set()` marks a user change.
- **Navigation.** Anchors for Controls, Patterns, Get started. The current
  section is tracked with `IntersectionObserver`. A sample opens in a modal
  `<dialog>` sheet. `#<sample-id>` on load opens that sample.
- **Services.** None. The FeedView sample simulates a feed with timers.
- **Data flow.** Property form → `api.set` → preview `update` → code
  regenerated → changed lines flash. Preview clicks follow the same path back
  into the form.
- **Platform constraints.** Artifact CSP: Google Fonts only, no external
  images, `navigator.clipboard` inside the click handler with a select-text
  fallback. Viewer sets `data-theme`, so every color is a token.
- **Validation.** Headless Chromium: console errors, phone and desktop widths,
  light and dark, sheet open/copy, search empty state, reduced motion.

## Design Brief

- **Visual direction.** The chrome is monochrome and recedes. Color only appears
  inside previews, where it is the real control theme: Fluent (`#005FB8` /
  `#60CDFF`) or Material 3 (`#6750A4` / `#D0BCFF`).
- **Layout.** Floating nav, left-aligned hero with a live "anatomy" card
  (preview beside the XAML it produces), filterable 3/2/1 column control grid,
  tagline reveal, two wide pattern cards, three setup steps, footer.
- **Typography.** Geist for UI, Geist Mono for type names and code. Weights
  400/500/600. Sizes from the Tailwind scale only.
- **Spacing and radius.** Spacing table values only. Card 16 px radius with an
  8 px inset preview at 8 px (nested formula).
- **Theme usage.** Dark surfaces from the skill list: `#181818`, `#1F1F1F`,
  `#272727`, `#313131`. Hero heading gets the one allowed text gradient.
- **Responsive.** 16 px minimum gutter, grid collapses to one column, sheet is
  full screen on phones, nav becomes a full height menu panel.

## Interaction Brief

- **Flows.** Browse → filter or search → play with the card preview →
  open the sample → tune properties → copy XAML or C# Markup.
- **Input.** Every preview control works with pointer and keyboard (switch,
  slider drag and arrows, NumberBox typing and spin, AutoSuggestBox arrows and
  Enter, roving radios, tree expand). `/` focuses search, `Esc` closes the sheet.
- **Empty states.** Search with no match shows a composed message and a clear
  button. A closed InfoBar shows a "Show InfoBar" action. FeedView None template.
- **Loading.** FeedView Progress template uses shaped skeleton rows.
- **Errors.** NumberBox range error inline, AutoSuggestBox no match row,
  ProgressBar ShowError with Retry, FeedView Error template with Retry,
  clipboard failure message.
- **Motion.** Cards rise 24 px with 6 px blur on first scroll in. Stories start
  from the design state and return to it, offset between cards, paused off
  screen, on hover and once a viewer takes over a card.
- **Feedback.** Copy button confirms with "Copied XAML". Changed code lines flash.
- **Accessibility.** Skip link, visible focus rings, `role=switch/slider/radio`,
  `aria-live` copy status, `prefers-reduced-motion` turns off intros and stories
  and keeps color fades only.
- **Runtime verification.** Load the page, scroll to the grid, watch stories,
  open ToggleSwitch, flip IsOn, check the XAML line, copy, switch to Material,
  search "zzz", resize to 390 px.

## Implementation Plan

- Vendor the skills and write this spec.
- Build the page: tokens, chrome, sample engine, twelve controls, two patterns.
- Verify in headless Chromium, fix, publish as an Artifact, commit.

## Unresolved Questions

- Should the next step port this to a real Uno app (XAML pages per sample) or
  stay a web design reference?
- Which namespace set matters most: WinUI, Uno Toolkit, MVUX, or Uno Extensions
  Navigation?
- The C# Markup output follows Uno Markup conventions but has not been compiled.
