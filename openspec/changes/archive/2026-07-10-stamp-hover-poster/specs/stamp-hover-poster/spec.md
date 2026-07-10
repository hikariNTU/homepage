## ADDED Requirements

### Requirement: Stamp reveal triggers on hover and keyboard focus
Each skill stamp SHALL open its poster-card reveal when the stamp is either pointer-hovered or keyboard-focused (e.g. via Tab), and SHALL close when neither condition holds.

#### Scenario: Pointer hover opens the poster
- **WHEN** a pointer hovers over a skill stamp
- **THEN** the poster card behind that stamp becomes visible

#### Scenario: Keyboard focus opens the poster
- **WHEN** a skill stamp receives keyboard focus (e.g. via Tab navigation)
- **THEN** the poster card behind that stamp becomes visible, without requiring a pointer hover

#### Scenario: Losing hover and focus closes the poster
- **WHEN** a skill stamp is neither hovered nor focused
- **THEN** its poster card is not visible

### Requirement: Poster card is corner-pinned to the stamp, independent of automatic placement
The poster card SHALL be positioned so its top-right corner aligns with the triggering stamp's top-right corner, expanding down and to the left, computed explicitly from the stamp's own position rather than via automatic non-overlapping placement logic.

#### Scenario: Poster aligns to the stamp's top-right corner
- **WHEN** a stamp's poster card is open
- **THEN** the poster's top edge aligns with the stamp's top edge, and the poster's right edge aligns with the stamp's right edge

#### Scenario: Poster expands down and left from the pin point
- **WHEN** a stamp's poster card is open
- **THEN** the poster's visible area extends below and to the left of the pin point, not above or to the right

#### Scenario: Poster position is not altered by collision-avoidance flipping
- **WHEN** a stamp is positioned near a viewport edge
- **THEN** the poster card still renders pinned to the stamp's top-right corner rather than flipping to a different side to avoid overflowing the viewport

### Requirement: Stamp remains visually on top of its open poster card
While a stamp's poster card is open, the stamp itself SHALL render above the poster card in stacking order.

#### Scenario: Stamp stacks above the poster while open
- **WHEN** a stamp's poster card is open
- **THEN** the stamp's visual content (icon, version tag, label, wavy border) is not obscured by the poster card behind it

#### Scenario: Stamp returns to its normal stacking order when closed
- **WHEN** a stamp's poster card is closed
- **THEN** the stamp no longer holds an elevated stacking position relative to sibling stamps

### Requirement: Poster reveal does not alter existing stamp visuals
Enabling the poster-card reveal SHALL NOT change the stamp's own randomized pattern, layout, silhouette, label, or version-tag rendering.

#### Scenario: Stamp scene rendering is unchanged
- **WHEN** the poster-card reveal is added to a stamp
- **THEN** the stamp's `StampScene` background pattern, `WavyCardBackground` wavy edge, label, and version badge render identically to before this change
