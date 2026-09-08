# RFC-001: Vision, Scope, and Architecture

**Status:** Draft / In Review  
**Date:** 2026-09-08  
**Target Reference Ecosystem (MVP):** iOS / Swift (SwiftUI + async/await)  
**Document Owner:** Alban & Antigravity  

---

## 1. Executive Summary

**Software as a Graph (SaaG)** is an architecture-first collaboration substrate between software engineers and coding agents. 

Modern coding agents excel at local code generation but suffer from architectural blindness: they struggle to reason about system-wide topologies, state mutation paths, and asynchronous data propagation. Conversely, human developers spend excessive cognitive effort reviewing dense, multi-file code diffs to verify if architectural intent was maintained.

SaaG introduces a **hierarchical, bi-directional, visual graph specification** for software. Developers and coding agents collaborate on the same visual canvas and underlying graph file. Beyond static topology, Saag turns the graph into an **interactive test and verification engine** by tracing and validating how data flows across nodes given arbitrary inputs.

---

## 2. Core Tenets & Product Pillars

### 1. Bi-Directional Synchronization (Code ⟷ Graph)
* **Code $\rightarrow$ Graph:** Code changes (whether written by human or agent) are parsed to project or update the architectural graph.
* **Graph $\rightarrow$ Code:** Edits made on the graph (adding components, reconnecting data pipelines, modifying data contracts) produce actionable architectural diffs and code scaffolding for the agent to implement.
* Neither is solely subordinate: the graph is the high-level contract; the code is the executable realization.

### 2. Hierarchical Node Abstraction ("Zoomable" Graph)
Software cannot be understood at a single level of granularity. SaaG operates on hierarchical tiers:
* **L1 — System / Architectural Tier:** Screens, Services, Stores, Repositories, Network Clients, Third-party APIs (e.g., `AuthView`, `SessionManager`, `KeychainStorage`, `SupabaseClient`).
* **L2 — Component / Feature Tier:** Sub-views, ViewModels, business logic pipelines, state containers (e.g., `LoginForm`, `AuthViewModel`, `TokenRefresher`).
* **L3 — Execution / Dataflow Tier:** Functions, async tasks, publisher streams, state bindings, and handlers (e.g., `submit()`, `validateInput()`, `requestAuthToken()`).

### 3. Transparent, Agent-Friendly Graph File Format
* The graph is stored directly in the repository as a version-controlled, human-readable file (e.g., `.saag/graph.json` or `.saag/architecture.yaml`).
* Accompanied by a lightweight, modern local web UI canvas (e.g., React Flow / Svelte Flow) that visualizes, edits, and interacts with this file via a local bridge daemon.

### 4. Interactive Dataflow Testing & Verification
* Instead of running opaque, slow integration tests in heavyweight simulator environments, the user or agent can inject a test payload into any node socket (e.g., injection at `SubmitButton.onClick`).
* The system evaluates and visualizes data propagation across downstream nodes:
  * **Visited nodes** (active flow path)
  * **Branch conditions & gatekeepers** (e.g., validation failure vs. network request dispatch)
  * **State mutations** (which reactive states/bindings were altered)
  * **Terminal outputs & errors**

---

## 3. Dataflow Testing: Senior Engineering Recommendation

Regarding Question #2 (*"What does 'Testing Data Flow' mean in practice?"*):

### The Challenge with Swift/iOS
Running full end-to-end execution on iOS requires launching the Xcode build system, linking frameworks, and booting the iOS Simulator or XCTest runner. Doing this synchronously inside an interactive graph canvas introduces 10–30 second latency per interaction, breaking the fast feedback loop.

### Recommended Hybrid Strategy: "Static/Symbolic Trace $\rightarrow$ Executable XCTest"
We propose a **two-phase verification model**:

1. **Phase 1: Fast Interactive Symbolic Tracing (Canvas Loop - Sub-second)**
   * When you drop a payload into a node (e.g., `{ email: "user@example.com", password: "" }` at `LoginView.submit`):
   * The AST analyzer (powered by `SwiftSyntax` / Tree-sitter) and the coding agent symbolically evaluate the logic across the connected edges:
     * *Step 1:* `LoginView` calls `viewModel.submitLogin(credentials)`.
     * *Step 2:* `AuthViewModel.validate()` checks `password.isEmpty` $\rightarrow$ Evaluates to `true`.
     * *Step 3:* Branch taken: Emits `.validationError("Password cannot be empty")` to `@Published var errorState`.
     * *Step 4:* Flow halts before reaching `AuthService.login()`.
   * **Visual Canvas Feedback:** The canvas lights up the path in real-time, displays node state transitions, and flags unvisited/blocked nodes.

2. **Phase 2: Executable Test Materialization (CI / Verification Loop)**
   * Once you and the agent agree that the flow on the canvas is correct, SaaG can automatically generate a clean, isolated **Swift Testing / XCTest suite** matching that exact flow graph.
   * This guarantees that symbolic reasoning is backed by 100% deterministic test assertion in native Swift.

---

## 4. MVP Scope: iOS / Swift (SwiftUI + async/await)

### In-Scope for MVP (Phase 1)
1. **Swift AST Extraction (Swift $\rightarrow$ Graph):**
   * Parse a targeted SwiftUI module/feature (Views, ViewModels, Services, Models).
   * Detect structural dependencies:
     * SwiftUI reactive bindings (`@State`, `@Binding`, `@StateObject`, `@ObservedObject`, `@Observable`).
     * Asynchronous calls (`async/await`, `Task`).
     * Dependency injection (injected protocols, initializers, environment values).
2. **Standard Graph Schema (`.saag/graph.json`):**
   * Declarative definition for nodes (ID, type, level, inputs/outputs, file path/symbol references).
   * Declarative definition for edges (source, target, flow type: call, state binding, async stream).
3. **Visual Canvas Web App:**
   * Interactive canvas rendering the hierarchical nodes and edges.
   * Support for collapsing/expanding hierarchical levels (L1 $\leftrightarrow$ L2 $\leftrightarrow$ L3).
   * Ability for the developer to add/remove edges and nodes visually and save back to `.saag/graph.json`.
4. **Dataflow Tracing Simulator:**
   * Interactive payload injection UI on input sockets.
   * Node-by-node path highlighting (active paths, bypassed branches, error states).
   * Payload transformation inspection at each edge.
5. **Agent Synchronization Interface:**
   * Clear specification and tool contracts for how a coding agent reads graph diffs and generates code conforming to node boundaries.

### Explicit Non-Goals for MVP
* Full multi-repo enterprise microservice topology (reserved for post-MVP).
* Real-time automated reverse-engineering of compiled binary frameworks (Closed-source `.xcframeworks`).
* Full-fidelity iOS runtime emulator in WebAssembly (we rely on AST/symbolic tracing + native test generation).

---

## 5. User Journeys

### Journey 1: Visual Architectural Alignment (Graph $\rightarrow$ Code)
1. Developer opens the SaaG canvas and wants to add a "Biometric FaceID Login" feature.
2. Developer (or agent upon request) places a `BiometricsService` node between `LoginView` and `SessionManager`.
3. An edge is drawn: `LoginView.onAppear` $\rightarrow$ `BiometricsService.authenticate()` $\rightarrow$ `SessionManager.restoreSession()`.
4. Developer reviews the visual graph diff and approves.
5. Coding agent reads the updated `.saag/graph.json` and writes the Swift implementation (`BiometricsService.swift`, view integration) strictly conforming to the agreed inputs, outputs, and edge contracts.

### Journey 2: Dataflow Debugging & Verification (Code $\rightarrow$ Graph $\rightarrow$ Simulation)
1. An agent implements a feature, but there is an edge-case bug with token refresh expiration.
2. Developer opens the canvas, locates the `AuthPipeline` cluster, and selects `ProfileView.onRefresh`.
3. Developer injects an expired token payload `{ token: "expired_jwt", status: 401 }`.
4. The canvas traces the flow:
   * Node `APIClient` returns `401 Unauthorized`.
   * Edge branches to `TokenRefresher`.
   * Trace identifies that `TokenRefresher` fails to propagate the refresh failure back to `RootCoordinator.logout()`, causing the app to hang in a loading state.
5. Developer highlights the missing edge or asks the agent: *"Fix the graph and code so that TokenRefresher failure routes to RootCoordinator.presentLogin."*

---

## 6. Key Decisions & Open Questions for User Sign-Off

1. **AST Extraction Tooling:**
   * Recommendation: Use `swift-syntax` (Apple's official Swift parser library) via a small Swift CLI helper (`saag-swift`), or a Tree-sitter Swift parser. `swift-syntax` provides 100% grammar compliance for modern Swift (Swift 5.9–6.0 macros, `@Observable`, etc.).
2. **Web UI Canvas Technology:**
   * Recommendation: Lightweight Vite + React/Svelte with a battle-tested node-graph canvas library (e.g. React Flow / Svelte Flow).
3. **Graph Storage Format:**
   * JSON vs. YAML for `.saag/graph.json`. JSON provides instant zero-dependency parsing across all languages, while YAML is slightly friendlier to git diff conflict resolution. (Our recommendation: JSON with pretty-print or YAML).

---
