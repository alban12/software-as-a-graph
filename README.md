# Software as a Graph (SaaG)

A shared graph representation of your software and its dependencies that you can view, edit, and agree on with your coding agent. Test your software by observing how data flows across the graph based on input payloads.

---

## Key Features

1. **Native Swift AST Extractor (`saag-swift`)**:
   Parses Swift/SwiftUI codebases, extracting Views, ViewModels, Services, and Repositories, their reactive states (`@State`, `@Observable`), socket ports, and cross-component call/event edges into `.saag/graph.json`.

2. **Interactive Visual Canvas UI**:
   Modern dark-mode canvas built with React Flow and pure Vanilla CSS. Inspect component architecture, edit nodes and sockets, drag connections, and auto-align layers (`View` $\rightarrow$ `ViewModel` $\rightarrow$ `Service` $\rightarrow$ `Repository`).

3. **Dataflow Tracing & Simulation Engine**:
   Inject payloads into input sockets, step through the execution path, observe real-time state mutations (amber badges), verify branch conditions, and identify error halts (red highlights).

4. **Bi-Directional Agent Sync & Automated Test Generation**:
   Materialize verified visual canvas traces directly into native Apple `Testing` suites (`@Test`, `#expect`) with 100% deterministic compiler/runtime agreement.

---

## Quickstart

### 1. Launch the Visual Canvas
```bash
npm run canvas
```
Open **`http://localhost:3000`** to interact with the visual canvas.

### 2. Extract Graph from Swift Codebase
```bash
npm run extract:sample
```
Extracts `examples/ios-auth-sample` into `examples/ios-auth-sample/.saag/graph.json`.

### 3. Run Architectural Diff (for Coding Agents)
```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun swift run --package-path packages/extractor-swift saag-swift diff \
  --base examples/ios-auth-sample/.saag/graph.json \
  --head examples/ios-auth-sample/.saag/graph.json
```

### 4. Run Executable Swift Tests
```bash
npm run test:sample
```
Executes the native Apple Swift Testing suite, including tests auto-generated from visual canvas simulations.

---

## Architecture Documentation & RFCs

* [RFC-001: Vision, Scope, and Architecture](docs/RFC-001-vision-and-scope.md)
* [RFC-002: Graph Schema & Intermediate Representation (IR)](docs/RFC-002-graph-schema-and-ir.md)
* [RFC-003: Dataflow Tracing, Simulation, and Test Generation](docs/RFC-003-dataflow-and-simulation.md)
* [Project Roadmap & Status](docs/ROADMAP.md)
* [JSON Schema Definition](schemas/saag-schema-v1.json)
