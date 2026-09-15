# SaaG Project Roadmap & Milestone Plan

**Status:** Proposed  
**Date:** 2026-09-08  

This roadmap outlines the phased execution plan to build **Software as a Graph (SaaG)** from concept to working prototype.

---

## Phase 1: Core Foundation & Swift AST Extractor
**Objective:** Parse a real Swift/SwiftUI codebase and generate the valid `.saag/graph.json` Intermediate Representation (IR).

* [x] **M1.1: Graph Schema Definition & Validator**
  * Finalize `.saag/graph.json` JSON schema (`schemas/saag-schema-v1.json`).
  * Implement Swift type models for `SaagGraph`, `SaagNode`, `SaagEdge`, `SaagPort`.
* [x] **M1.2: Reference Sample Project**
  * Created clean reference iOS sample (`examples/ios-auth-sample`) with SwiftUI `LoginView`, `@Observable AuthViewModel`, `AuthServiceProtocol`, and `KeychainStorage`.
  * Verified unit tests using Apple Swift Testing (`swift test`).
* [x] **M1.3: Swift AST Parser (`saag-swift`)**
  * Built native Swift CLI tool (`packages/extractor-swift`).
  * Extracts views, view models, protocols, services, and repositories.
  * Inferred connecting call and event edges.
  * Successfully exports compliant `.saag/graph.json`.

---

## Phase 2: Interactive Visual Canvas UI
**Objective:** Provide a fast, beautiful local web canvas to inspect, navigate, and edit the graph.

* [x] **M2.1: Canvas Web Application**
  * Created modern React 18 + React Flow 12 web application (`packages/canvas-ui`).
  * Custom dark-mode node renderers for **Views** (purple), **ViewModels** (blue), **Services** (green), and **Repositories** (amber).
  * Collapsible/expandable nodes with state property badges and interactive input/output socket handles.
* [x] **M2.2: Local Bridge Daemon**
  * Built lightweight Node.js daemon (`packages/canvas-ui/server.js`) with REST API and WebSocket live push.
  * Real-time `fs.watch` file monitoring: broadcasts graph updates when external AST or agent edits occur.
  * Atomic persistence back to `.saag/graph.json`.
* [x] **M2.3: Human Graph Editing**
  * Created `InspectorSidebar` to inspect/edit node properties, add/delete sockets, and delete edges.
  * Created `AddNodeModal` to visually scaffold new architectural components.
  * Added one-click architectural **Auto-Layout** arranging nodes in layered columns.

---

## Phase 3: Interactive Dataflow Testing & Simulation
**Objective:** Enable input payload injection and real-time visual tracing across nodes.

* [x] **M3.1: Socket Payload Injection UI**
  * Created `SimulationModal` with scenario presets (Happy Path, Validation Guard Failure, Auth Error) and custom JSON payload editor.
* [x] **M3.2: Symbolic Flow Tracing Engine**
  * Built `src/simulation/engine.js` evaluating data propagation along connected edges.
  * Visual diagnostics on canvas: Active path (glowing green), bypassed branches (dimmed dashed), state mutations (amber aura + property tags), and error stops (red glow).
  * Tracks intermediate socket payloads and node state transitions at each step.
* [x] **M3.3: Time-Travel Playback Scrubber**
  * Built floating bottom `SimulationTimeline` with Play/Pause, Step Forward/Back, Reset, and step pills.
  * Integrated Trace Inspector drawer displaying step explanations, socket payloads, and mutated states.

---

## Phase 4: Bi-Directional Agent Sync & Test Generation
**Objective:** Enable the coding agent to act on graph diffs and lock in verified traces as executable Swift tests.

* [x] **M4.1: Agent CLI / MCP Tool Integration**
  * Built `saag-swift diff` to compute structured architectural diffs (added/removed nodes, modified properties, edge changes) between graphs.
  * Built `saag-swift generate-test` CLI to materialize simulation traces directly into standalone Swift test files.
* [x] **M4.2: Automated Swift Test Generator**
  * Created `TestGenerator.swift` supporting Apple's modern `Testing` library (`@Suite`, `@Test`, `#expect`).
  * Integrated **Export Swift Test** modal in the canvas UI with syntax preview, clipboard copy, and one-click saving to test suite.
  * Executed tests locally (`swift test`) confirming 100% agreement between the symbolic visual graph trace and native Swift runtime assertions.

---

## Phase 5: SwiftUI Visual Screen Previews on Graph Nodes
**Objective:** Enhance the visual graph canvas so that SwiftUI View/Screen nodes render high-fidelity UI previews directly on the canvas.

* [x] **M5.1: Graph Schema Enhancement for Screen Previews**
  * Extended `SaagNode` in `schemas/saag-schema-v1.json` and `GraphModels.swift` with `previewMeta`:
    * `previewKind`: `"device_frame"`.
    * `deviceFrame`: `"iphone-16-pro"`.
    * `variants`: Multi-state previews (`Default State`, `Loading State`, `Error State`).
* [x] **M5.2: SwiftUI Preview Asset Pipeline & Server Bridge**
  * Added `#Preview` blocks to `LoginView.swift` for multiple visual states.
  * Updated `SwiftFileScanner.swift` to automatically detect `#Preview` declarations and attach `previewMeta` to view nodes.
* [x] **M5.3: Canvas View Node UI with Device Frames & Expanded Preview**
  * Built `ScreenPreview.jsx` rendering pixel-accurate iPhone 16 Pro bezel, Dynamic Island, and SwiftUI form layout.
  * Embedded mini phone frame inside `LoginView` node with toggle pill (`UI`).
  * Built `DeviceZoomModal.jsx` supporting click-to-zoom and multi-state switching (`Default` $\leftrightarrow$ `Loading` $\leftrightarrow$ `Error`).
  * Wired dynamic simulation synchronization so the embedded screen updates in real-time as dataflow steps forward.

---

## Phase 6: SwiftUI View Element Reconciliation & Screen-Driven Dataflow
**Objective:** Parse and reconcile individual UI controls inside the SwiftUI View with the node model, make screen controls editable, and allow triggering dataflow simulations directly by clicking screen elements.

* [x] **M6.1: AST View Element Tree Extraction & Reconciliation**
  * Parse concrete UI controls from SwiftUI `body` (`TextField`, `SecureField`, `Button`, `Text`, `ProgressView`).
  * Store child UI elements on the node (`viewElements: [ViewElement]`), mapping them to source line spans.
  * Edit UI element labels, placeholders, or button actions directly in the node inspector and synchronize changes back to the Swift view file (`POST /api/update-view-element`).
* [x] **M6.2: Interactive Screen Canvas (Element-Triggered Dataflow)**
  * Enabled direct typing and button tapping inside the embedded iPhone 16 Pro device frame.
  * Clicking "Sign In" / "Log In" on the phone frame dynamically triggers dataflow simulation across connected nodes.
  * Supports interactive testing inside both canvas mini-node mode and full `DeviceZoomModal`.

---

## Phase 7: Squeezed / Transient Nodes & External Service Inspectors
**Objective:** Declutter the canvas by folding unimportant/transient nodes into compact edge pills and provide rich preview/dashboard inspectors for external services like Firebase.

* [x] **M7.1: Transient / Squeezed Node Folding**
  * Mark nodes as `isTransient` or `isSqueezed` (e.g., intermediate approval screens, loading shims, or pass-through guards).
  * Render squeezed nodes as compact capsules directly along the edge between major architectural nodes with minimal visual footprint.
  * Provide one-click expand/debug (`Debug` / `Squeeze` toggles) in both canvas and Inspector to inspect transient nodes on demand.
* [x] **M7.2: External Service Inspector & Preview Window (Firebase / Backend)**
  * Dedicated service preview modal for external client nodes (`ServicePreviewModal.jsx`) triggered via `Cloud` node pill or Inspector drawer.
  * Display mock database collections (`users`, `user_sessions`, `audit_logs`), active session JWT claims, registered identities, and endpoint routes.
  * Interactive health ping test (`identitytoolkit.googleapis.com` / `firestore.googleapis.com`) with latency and status monitoring.

---

## Phase 8: Scoped Agent Workspaces ("Agent Focus Lock" & Guardrails)
**Objective:** Allow developers to lock an agent's working context to a specific node or cluster, ensuring the agent only modifies authorized files and adheres strictly to interface contracts.

* [x] **M8.1: Multi-Node Selection & Visual Focus Bounding Box**
  * Multi-select a set of nodes on the canvas or click "Agent Scope" to lock the target cluster (e.g., `AuthViewModel` + `LiveAuthService`).
  * Render dynamic glowing purple bounding box around locked components, dim non-scoped nodes, and display `🔒` padlock badges on frozen boundary sockets.
* [x] **M8.2: Agent Scoping Contract Generator**
  * Automatically generate enforceable AI agent system prompt locking file permissions strictly to source anchors (`allowedFilePaths`).
  * Freeze boundary socket ports and contracts (upstream and downstream interfaces become immutable).
  * Export machine-readable `.saag/agent-scope.json` and sync live with `graph.json.activeWorkspace`.
* [x] **M8.3: Architectural Scope Violation Checker**
  * Live Git working tree inspection endpoint (`/api/validate-agent-scope`) detecting uncommitted modifications to out-of-scope files.
  * Interactive UI violation tester with hypothetical path evaluation and warning cards.
  * Swift AST scope validation logic in `ScopeValidator.swift` with comprehensive unit test coverage.

---

## Phase 9: Dataflow Performance & Resource Profiling (Memory & CPU Bottlenecks)
**Objective:** Overlay runtime telemetry and performance profiling directly onto the graph edges and nodes to identify execution latency, CPU spikes, and memory retain cycles.

* [x] **M9.1: Edge Latency & Concurrency Profiling**
  * Record execution latency for async tasks, network fetches, and heavy state computations.
  * Graph Heatmap: Color-code edges and nodes by latency (green: <50ms, amber: 50–250ms, red: >250ms bottleneck).
  * Display timing tags directly on edges (`⚡ 12ms`, `⏳ 380ms`).
* [x] **M9.2: Memory Allocation & Retain Cycle Detection**
  * Profile memory allocation deltas per node execution (`+14.2 MB`).
  * Swift AST static analysis detector (`RetainCycleDetector.swift`) for escaping closure & detached Task strong `self` captures without `[weak self]`.
  * Flag nodes with warning badges indicating memory spikes or leaks (`⚠️ Retain Risk`).
* [x] **M9.3: Bottleneck Diagnostic Panel & Agent Optimization Action**
  * Dedicated performance dashboard (`PerformanceProfilingModal.jsx`) displaying execution waterfall breakdown, critical path bottleneck identification, and retain cycle diagnostics.
  * One-click "Optimize with Agent" action: generates a targeted prompt with exact performance metrics and AST symbols to instruct the agent to eliminate the bottleneck.




