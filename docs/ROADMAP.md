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
