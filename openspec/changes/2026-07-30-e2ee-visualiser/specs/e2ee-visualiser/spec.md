## ADDED Requirements

### Requirement: Steps map one-to-one onto real cryptographic calls

The system SHALL perform every cryptographic operation it depicts using the browser's Web
Crypto API, and SHALL present exactly one advanceable Step per such call. The system SHALL NOT
depict an operation it did not perform, and SHALL NOT precompute the outcome of a Step before
the reader advances to it at the Frontier.

#### Scenario: Advancing at the Frontier performs the call
- **WHEN** the reader advances while positioned at the Frontier
- **THEN** the corresponding Web Crypto operation is invoked, and the Step records the inputs it
  consumed and the output it produced

#### Scenario: A Step that moves bytes without transforming them is marked as such
- **WHEN** a Step transmits or receives a Packet without performing cryptography
- **THEN** the Step is still advanceable and is presented as performing no cryptographic
  operation

### Requirement: History is rewindable without re-execution

The system SHALL retain a Snapshot for every executed Step, and SHALL make any past Snapshot
viewable without repeating its cryptographic work. Viewing a past Snapshot SHALL NOT alter
History.

#### Scenario: Scrubbing backwards re-reads History
- **WHEN** the reader moves the cursor to an earlier Step
- **THEN** the stage shows that Snapshot's state and no cryptographic operation is performed

#### Scenario: Advancing behind the Frontier replays rather than executes
- **WHEN** the reader advances while positioned behind the Frontier
- **THEN** the cursor moves to the already-recorded next Snapshot and no cryptographic operation
  is performed

#### Scenario: Advancing at the Frontier extends History
- **WHEN** the reader advances at the Frontier and the Script has a remaining Step
- **THEN** a new Snapshot is appended and becomes the Frontier

#### Scenario: End of Script
- **WHEN** the reader is at the Frontier and the Script has no remaining Step
- **THEN** advancing is unavailable until a new Action is created (for example by composing a
  message or by Eve acting)

### Requirement: Private key material never leaves its Device

The system SHALL confine each Device's private key material to that Device. Private key
material SHALL NOT appear in any Packet, SHALL NOT be readable from the other Device's state,
and SHALL NOT be reachable by Eve. Where the interface displays private key bytes for teaching
purposes, it SHALL label them as never leaving that Device.

#### Scenario: Packets carry only public material
- **WHEN** any Packet is placed on the Wire
- **THEN** its payload contains only public keys, ciphertext, or protocol headers — never
  private key material

#### Scenario: Eve cannot read plaintext from captured Packets
- **WHEN** Eve inspects any captured Packet carrying a sealed message
- **THEN** the plaintext is not available to her, and the interface shows only the ciphertext
  bytes

### Requirement: Adversary actions produce genuine cryptographic outcomes

The system SHALL let the reader act as Eve on any Packet in flight, at minimum dropping it,
re-sending it, and altering its bytes. Each such action SHALL be executed as real Actions whose
Steps invoke Web Crypto, and its consequence SHALL be whatever the cryptography actually
produces. The system SHALL NOT simulate, stub, or pre-write a success or failure outcome.

#### Scenario: Tampered ciphertext fails authentication for real
- **WHEN** Eve alters a byte of a sealed message and the recipient attempts to open it
- **THEN** the decryption call throws, the Step is recorded as failed, and the interface
  presents the actual error raised by Web Crypto

#### Scenario: Dropped Packet never arrives
- **WHEN** Eve drops a Packet
- **THEN** the recipient has no such Packet available to receive, and the Packet is shown as
  dropped on the Wire

#### Scenario: Replay outcome depends on the Level
- **WHEN** Eve re-sends a previously delivered Packet
- **THEN** the recipient attempts to open it for real, and whether it is accepted is determined
  by the currently selected Level's protocol rather than by any scripted result

### Requirement: Selectable depth Levels, each naming its own weakness

The system SHALL offer the messaging Scenario at multiple Levels of protocol depth, all
selectable at any time without prerequisite. Each Level SHALL state the weaknesses it still
carries and SHALL offer to demonstrate one against the currently selected Level. Selecting a
different Level SHALL begin a fresh History with fresh key material.

#### Scenario: Any Level is directly selectable
- **WHEN** the reader selects a Level
- **THEN** that Level's Script is loaded from Step 0 with new key material, regardless of which
  Levels were viewed before

#### Scenario: Weakness is stated, not implied
- **WHEN** a Level is selected
- **THEN** the interface names that Level's remaining weaknesses and offers the Attack that
  demonstrates one of them

#### Scenario: The demonstrated weakness motivates the next Level
- **WHEN** an Attack succeeds against the selected Level
- **THEN** the interface identifies the Level that answers it

### Requirement: The reader's own plaintext runs through the real protocol

The system SHALL let the reader supply plaintext from a Device and send it, appending real
Actions and Steps to History. Composing SHALL be available only at the Frontier.

#### Scenario: Reader-supplied message is sealed for real
- **WHEN** the reader submits plaintext from a Device at the Frontier
- **THEN** the protocol's send Actions are appended and their Steps invoke Web Crypto on that
  plaintext

#### Scenario: Composing behind the Frontier is refused
- **WHEN** the reader is positioned behind the Frontier
- **THEN** composing is unavailable and the interface offers to return to the Frontier

### Requirement: Simplified stand-ins are labelled

Where the depicted protocol uses a primitive or construction the platform does not provide, the
system SHALL implement a simplified stand-in and SHALL label it in the interface, naming what
the real protocol does instead. The system SHALL NOT present a stand-in as the real
construction.

#### Scenario: Stand-in carries a visible marker
- **WHEN** a Step relies on a simplified stand-in
- **THEN** that Step is visibly marked as a stand-in and states what the real protocol uses

### Requirement: Byte-level inspection of the selected Step

The system SHALL present, for the currently selected Step, the operation performed, the inputs
it consumed and the output it produced, as hexadecimal bytes, truncated by default and
expandable in full.

#### Scenario: Selected Step shows its bytes
- **WHEN** a Step is selected
- **THEN** its operation, inputs and output are shown as truncated hex with the option to expand

#### Scenario: Failed Step shows its error
- **WHEN** the selected Step's cryptographic call threw
- **THEN** the inspector shows the error raised instead of an output

### Requirement: Motion is optional

The system SHALL respect a reduced-motion preference by applying state changes without
transition or animation, and SHALL NOT auto-advance on load.

#### Scenario: Reduced motion applies state instantly
- **WHEN** the reader's system requests reduced motion
- **THEN** Packet movement and reveals apply without animation

#### Scenario: No autoplay on load
- **WHEN** the page loads
- **THEN** it rests at Step 0 until the reader advances or starts playback
