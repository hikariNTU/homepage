## ADDED Requirements

### Requirement: Deterministic per-skill variant selection
The system SHALL derive each skill stamp's pattern variant, label variant, and version-tag variant from a stable hash of that skill's name, such that the same skill always renders with the same pattern, label, and version-tag variant across re-renders, remounts, and layout re-computations (e.g. masonry resize).

#### Scenario: Same skill renders identically across remounts
- **WHEN** the skill wall re-mounts (e.g. navigating away and back, or a language switch re-render)
- **THEN** every skill card renders the same pattern variant, label variant, and version-tag variant it rendered before, with no visible change caused purely by re-rendering

#### Scenario: Pattern, label, and version-tag selection are independently derived
- **WHEN** two different skills hash to the same pattern variant
- **THEN** their label variants and version-tag variants are not guaranteed to match, because pattern, label, and version-tag are derived from independent hash inputs

### Requirement: Background pattern layer clipped to stamp silhouette
Each skill stamp card SHALL render a background pattern layer selected from a fixed pool, clipped exactly to the card's existing wavy silhouette path, positioned behind the icon and version tag in paint order.

#### Scenario: Pattern pool includes a plain/no-pattern option
- **WHEN** a skill's hash selects the "plain" pattern variant
- **THEN** the card renders with no additional pattern layer, showing only the existing flat wavy-card fill

#### Scenario: Pattern does not spill past the wavy edge
- **WHEN** any non-plain pattern variant is rendered on a card of any randomized height
- **THEN** the pattern is visually contained within the card's wavy silhouette outline, with no pattern content visible outside that boundary

#### Scenario: Pattern stays behind foreground content
- **WHEN** a pattern variant is rendered on a card
- **THEN** the icon, version-number tag, and name label remain fully legible and are not obscured by the pattern layer

### Requirement: Pattern, label, and version-tag colors constrained to existing site palette
All pattern, label, and version-tag rendering SHALL use only colors already defined in the site's theme palette (`main-100`, `main-200`, `main-800`, `main-900`), with no new hues introduced, and SHALL support both light and dark mode.

#### Scenario: Pattern renders correctly in dark mode
- **WHEN** the site is in dark mode
- **THEN** pattern strokes/fills use the dark-mode-appropriate palette color (not a brightness/grayscale filter) and remain visible against the card background

#### Scenario: Inverted-fill version tag renders correctly in dark mode
- **WHEN** the site is in dark mode and a skill's version-tag variant uses an inverted (solid-fill) treatment
- **THEN** the fill and text colors swap to the dark-mode-appropriate pair from the existing palette, keeping the number legible

#### Scenario: No per-skill brand-color tinting
- **WHEN** any skill card is rendered, regardless of that skill's associated brand or icon
- **THEN** the pattern, label, and version-tag colors are drawn only from the site's existing palette variables, not from any per-icon brand color

### Requirement: Label typography variant pool
Each skill stamp's bottom name label SHALL render using one of a fixed set of typography treatments, selected per the deterministic hash rule above.

#### Scenario: Label pool includes at least three distinct treatments
- **WHEN** label variants are assigned across the skill list
- **THEN** at least three visually distinct treatments are available in the pool (e.g. plain bold caps, rule-flanked small caps, slight-rotate ink-stamp tilt)

#### Scenario: Label remains legible in all variants
- **WHEN** any label variant is applied
- **THEN** the skill name text remains readable at the card's existing small text size, without being clipped by the card bounds

### Requirement: Version-tag variant pool
Each skill stamp's corner version-number tag SHALL render using one of a fixed set of treatments, selected per the deterministic hash rule above: a single-corner outline box (today's style), a single-corner inverted-fill box, and a dual-corner inverted-fill treatment mirrored into both the top-left and top-right corners.

#### Scenario: Version-tag pool includes a dual-corner treatment
- **WHEN** a skill's hash selects the dual-corner version-tag variant
- **THEN** the version number renders as a solid-fill box in both the top-left and top-right corners of the card, matching the real-postage-stamp convention referenced in the proposal

#### Scenario: Version-tag pool includes single-corner treatments
- **WHEN** a skill's hash selects a single-corner version-tag variant (outline or inverted-fill)
- **THEN** the version number renders once, in a single corner, styled per the selected variant

#### Scenario: Version tag remains legible and uncramped across card sizes
- **WHEN** any version-tag variant is rendered on a card at any point in its randomized height range
- **THEN** the version number remains fully legible and does not visually collide with the icon or the background pattern layer
