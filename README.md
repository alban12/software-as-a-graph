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

### 4. Connect AI Coding Agents (Cursor, Claude Code, Windsurf via MCP)
SaaG includes an official **Model Context Protocol (MCP)** server:
```json
{
  "mcpServers": {
    "saag": {
      "command": "node",
      "args": ["packages/mcp-server/bin/saag-mcp.js"]
    }
  }
}
```
Exposes tools like `get_architecture_graph`, `get_node_contract`, `validate_architecture`, `simulate_dataflow`, and `apply_architectural_refactor`.

### 5. Headless CI/CD Architectural Verification
Run SaaG's architectural guardrail linter directly in CI/CD pipelines to block layer violations, retain cycles, and VRAM OOMs:
```bash
# Terminal report
npm run verify -- --project benchmarks/landmarks-graph.json

# Markdown report for GitHub PR bot comments
npm run verify -- --project auth-sample --markdown
```

### 6. Fluid 3-Lens Architectural Perspectives
Switch between three spatial projections with 1 click in the Studio Toolbar or MCP server (`layoutMode`):
- `🌳 Tree`: Top-to-bottom containment, navigation hierarchy, and component trees.
- `⏩ Pipeline`: Causal left-to-right flow ($T_0 \rightarrow T_k$) with DAG ranking, barycentric swimlanes, and reactive loopback isolation.
- `🕸️ Mesh`: Force-directed physical simulation for unoriented peer networks, microservices, and state coupling. Acts as the freeform authored canvas disposition—dragging any node in Tree or Pipeline seamlessly auto-transitions to Mesh without losing manual placements.

### 7. Bidirectional In-Place AST Sync
Modify UI element labels or controls directly in the Inspector drawer or on canvas device previews. SaaG performs in-place AST line-span reconciliation against native Swift files without clobbering formatting or comments:
- **`Landmarks`**: Edits in `CategoryHome.swift`, `LandmarkDetail.swift`, etc.
- **`MakeItSo`**: Edits in `RemindersListView.swift`, `ReminderDetailsView.swift`, etc.
- **`AuthSample`**: Edits in `LoginView.swift`, etc.

### 8. Multi-Project Simulation & Apple Testing Export
Launch interactive dataflow simulations across all benchmark applications:
- **`Landmarks`**: *Toggle Favorite Landmark* (`ModelData` reactive broadcast), *Update User Profile*, and *Category Navigation*.
- **`MakeItSo`**: *Create & Persist Reminder* (`RemindersRepository` Firestore integration).
- **`AuthSample`**: *Happy Path*, *Validation Guard Failure*, and *401 Network Failure*.
- **One-Click Swift Test Generation**: Materialize verified visual traces into standalone Apple `Testing` files (`@Suite`, `@Test`, `#expect`) and save directly into the project's test target.

### 9. Run Executable Test Suites
```bash
npm test
```
Executes all unit and integration tests across the Swift AST Extractor, Sample App, Canvas UI, and MCP Server.

---

## Architecture Documentation & RFCs

* [RFC-001: Vision, Scope, and Architecture](docs/RFC-001-vision-and-scope.md)
* [RFC-002: Graph Schema & Intermediate Representation (IR)](docs/RFC-002-graph-schema-and-ir.md)
* [RFC-003: Dataflow Tracing, Simulation, and Test Generation](docs/RFC-003-dataflow-and-simulation.md)
* [Project Roadmap & Status](docs/ROADMAP.md)
* [JSON Schema Definition](schemas/saag-schema-v1.json)
