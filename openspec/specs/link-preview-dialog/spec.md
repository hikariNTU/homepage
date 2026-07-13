# link-preview-dialog

## Purpose

Classify project links by reach and, on medium-and-up viewports, preview framable ones
(in-SPA routes and `hikarintu.github.io` sites) in an almost-fullscreen dialog with an
embedded iframe and an expandable tech drawer. External links and small-viewport clicks fall
back to plain navigation.

## Requirements

### Requirement: Link classification by reach

The system SHALL classify every project link into exactly one of three kinds based on its
target: **in-SPA** (a hash/relative route on this site), **same-domain** (an absolute URL
whose origin is `hikarintu.github.io`), or **external** (any other origin). Only in-SPA and
same-domain links SHALL be treated as framable (previewable); external links SHALL NOT be
framable.

#### Scenario: Relative SPA route is in-SPA
- **WHEN** a link targets a relative route such as `./dvd-logo` or `./screen/`
- **THEN** it is classified as in-SPA and marked framable

#### Scenario: Absolute same-domain URL is same-domain
- **WHEN** a link targets an absolute URL under `https://hikarintu.github.io/*`
- **THEN** it is classified as same-domain and marked framable

#### Scenario: Other origins are external
- **WHEN** a link targets an origin other than `hikarintu.github.io` (e.g. `https://co-iro.netlify.app/` or a chrome web store URL)
- **THEN** it is classified as external and marked not framable

### Requirement: Viewport gate for preview

The system SHALL decide whether preview is available using a JavaScript media query for a
medium-and-up viewport, evaluated at click time (not by CSS visibility alone). When the
viewport is below the medium breakpoint, no link SHALL open the preview dialog.

#### Scenario: Medium-and-up viewport enables preview
- **WHEN** the JS media query for medium-and-up matches and a framable link is activated
- **THEN** the preview dialog opens instead of navigating

#### Scenario: Small viewport falls back to navigation
- **WHEN** the viewport is below the medium breakpoint and a framable link is activated
- **THEN** the dialog does not open and the browser performs normal navigation to the link

### Requirement: External and non-eligible links navigate normally

The system SHALL leave external links, and any link on a small viewport, with their existing
navigation behavior — no dialog, no iframe. In-SPA links SHALL continue to route within the
app and same-domain/external absolute links SHALL open as they do today when preview does not
apply. External links SHALL additionally carry a visual indicator (an external-link icon) so
users can tell they navigate away rather than preview in place.

#### Scenario: External link is never framed
- **WHEN** an external link is activated on any viewport
- **THEN** no preview dialog opens and the link navigates/opens as before

#### Scenario: External link is visually marked
- **WHEN** a project card links to an external (non-framable) origin
- **THEN** an external-link icon is shown on the card alongside its title

#### Scenario: Keyboard and modifier activation preserved
- **WHEN** the user activates a framable link with a modifier key (e.g. cmd/ctrl-click) or middle-click
- **THEN** the default browser behavior (open in new tab) is preserved and the dialog does not intercept it

### Requirement: Almost-fullscreen preview dialog

When preview applies, the system SHALL open a Radix Dialog occupying almost the full
viewport. The dialog SHALL contain a title bar showing the page's title, an **open-external
control**, and a close control, and a body hosting an `<iframe>` whose `src` is the classified
link target. The dialog SHALL be dismissable via the close control, the escape key, and an
outside/overlay interaction, and SHALL restore focus and scrolling on close.

#### Scenario: Dialog frames the target
- **WHEN** the preview dialog opens for a framable link
- **THEN** an iframe inside the dialog body loads that link's URL and the page title is shown in the title bar

#### Scenario: Open the previewed page outside the dialog
- **WHEN** the user activates the open-external control in the dialog title bar
- **THEN** the previewed link opens in a new browser tab/context at its real navigable URL so the page can be used full-size outside the current page

#### Scenario: Dismiss the dialog
- **WHEN** the user clicks the close control, presses escape, or interacts with the overlay outside the dialog
- **THEN** the dialog closes, the iframe is torn down, and the underlying homepage is restored without navigation

### Requirement: Expandable tech drawer

The dialog SHALL include a tech drawer pinned to one edge of the iframe. Collapsed, it SHALL
display compact chips for the technologies the previewed page uses. Expanded, it SHALL widen
to reveal each technology's full name and a short description. The drawer SHALL be toggleable
between collapsed and expanded states.

#### Scenario: Collapsed drawer shows chips
- **WHEN** the dialog opens with the drawer collapsed
- **THEN** each technology is shown as a compact chip (e.g. an abbreviation or icon) alongside the iframe

#### Scenario: Expanding reveals descriptions
- **WHEN** the user expands the drawer
- **THEN** it widens and shows each technology's full name and its description of how the page uses it

#### Scenario: Site without tech data
- **WHEN** a previewed site has no technology list configured
- **THEN** the dialog still opens with a working iframe and the drawer is empty or hidden rather than erroring
