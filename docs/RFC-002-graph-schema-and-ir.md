# RFC-002: Graph Schema & Intermediate Representation (IR)

**Status:** Draft / In Review  
**Date:** 2026-09-08  
**Reference Target:** Swift / SwiftUI (Ecosystem-Agnostic Core)  
**File Location:** `.saag/graph.json`  

---

## 1. Objectives & Principles

The SaaG Intermediate Representation (IR) is the core contract shared between human developers, the visual canvas UI, the AST extractors, and coding agents.

### Core Principles
1. **Language-Agnostic Core with Idiomatic Metadata:**
   The base node/edge topology is generic (usable for Swift, Python, TypeScript), while language-specific details (such as Swift's `@Binding`, `@Observable`, or `async throws`) reside in structured metadata fields.
2. **First-Class Sockets/Ports:**
   Dataflow requires knowing *where* data enters and leaves. Edges do not just connect Node A to Node B; they connect an **Output Port** (trigger, return value, emitted event, state publisher) to an **Input Port** (parameter, handler, state consumer).
3. **Hierarchical Nesting (Parent-Child):**
   Nodes can contain child nodes. An L1 feature container (e.g., `AuthSystem`) contains L2 components (`LoginView`, `AuthViewModel`, `KeychainStorage`), which in turn contain L3 execution units (`login()`, `validatePassword()`, `@Published var errorState`).
4. **Deterministic Source Anchoring:**
   Every node and port must anchor directly to a physical source code location (relative file path, symbol path, byte/line span), enabling instant bi-directional navigation and diffing.

---

## 2. Complete Schema Specification (`.saag/graph.json`)

```typescript
export interface SaagGraph {
  schemaVersion: "1.0.0";
  metadata: GraphMetadata;
  nodes: Record<string, SaagNode>;
  edges: Record<string, SaagEdge>;
}

export interface GraphMetadata {
  projectName: string;
  targetPlatform: "swift" | "typescript" | "python" | "generic";
  rootPath: string;
  lastSynchronizedAt: string;
  sourceChecksum?: string;
}

export interface SaagNode {
  id: string; // Unique, deterministic ID (e.g. "auth.login_view")
  name: string;
  level: "L1_SYSTEM" | "L2_COMPONENT" | "L3_EXECUTION";
  kind: NodeKind;
  parentId?: string; // ID of parent container node for hierarchy
  
  // Sockets for dataflow
  inputs: Port[];
  outputs: Port[];
  
  // State variables owned by this node (especially for SwiftUI / reactive models)
  stateProps?: StateProperty[];
  
  // Source code traceability
  sourceAnchor?: SourceAnchor;
  
  // Canvas presentation layout
  canvasMeta?: CanvasMeta;
}

export type NodeKind =
  // L1 & L2 Kinds
  | "view"              // SwiftUI View, UIViewController, React Component
  | "viewModel"         // SwiftUI Observable ViewModel, Store
  | "service"           // Business logic service, API Client
  | "repository"        // Storage gateway, CoreData, Keychain, SwiftData
  | "externalSystem"    // Third-party API (Stripe, Firebase, Supabase)
  
  // L3 Kinds
  | "function"          // Method, async task, pure function
  | "handler"           // Button action, gesture recognizer, event callback
  | "stateHolder"       // Specific reactive state variable / property wrapper
  | "decisionBranch";   // If/else, switch case, guard validation gate

export interface Port {
  id: string; // e.g. "in_credentials", "out_on_success"
  name: string;
  typeAnnotation: string; // e.g. "Credentials", "Result<User, AuthError>", "Void"
  schemaSnippet?: string; // Optional JSON schema or struct representation
  direction: "input" | "output";
  isAsync?: boolean;
  canThrow?: boolean;
}

export interface StateProperty {
  name: string;
  typeAnnotation: string;
  wrapperKind?: "@State" | "@Binding" | "@Observable" | "@Published" | "@Environment" | "plain";
  defaultValue?: string;
  isReadOnly?: boolean;
}

export interface SourceAnchor {
  filePath: string;         // Relative to repository root (e.g., "Features/Auth/LoginView.swift")
  symbolPath: string;       // Fully qualified symbol (e.g., "AuthModule.LoginView.body.submitButton")
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  symbolChecksum?: string;  // Hash of the symbol's AST subtree to detect drift
}

export interface CanvasMeta {
  position: { x: number; y: number };
  width?: number;
  height?: number;
  isCollapsed?: boolean;     // Whether children are visible or hidden in canvas
  colorTag?: string;
}

export interface SaagEdge {
  id: string; // Unique ID (e.g. "edge_login_tap_to_viewmodel")
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  
  edgeKind: EdgeKind;
  executionMode: "sync" | "async" | "reactive_stream";
  
  // For symbolic simulation and contracts
  contract?: EdgeContract;
}

export type EdgeKind =
  | "call"               // Synchronous or asynchronous invocation
  | "dataTransfer"       // Pure payload transfer
  | "stateBinding"       // Two-way or one-way reactive state binding ($binding)
  | "eventEmit"          // UI Action tap, NotificationCenter, Combine Subject
  | "dependencyInject";  // Constructor or Environment injection

export interface EdgeContract {
  payloadType: string;         // e.g. "LoginRequest"
  guarantees?: string[];       // e.g. ["non-empty username", "valid email regex"]
  errorType?: string;          // e.g. "NetworkError"
}
```

---

## 3. Concrete Example: SwiftUI Authentication Feature

Below is how a standard modern SwiftUI login feature translates into `.saag/graph.json`:

```json
{
  "schemaVersion": "1.0.0",
  "metadata": {
    "projectName": "MyApp",
    "targetPlatform": "swift",
    "rootPath": ".",
    "lastSynchronizedAt": "2026-09-08T01:50:00Z"
  },
  "nodes": {
    "node_login_view": {
      "id": "node_login_view",
      "name": "LoginView",
      "level": "L2_COMPONENT",
      "kind": "view",
      "inputs": [],
      "outputs": [
        {
          "id": "out_submit_tap",
          "name": "onSubmitTap",
          "typeAnnotation": "Void",
          "direction": "output"
        }
      ],
      "stateProps": [
        { "name": "email", "typeAnnotation": "String", "wrapperKind": "@State", "defaultValue": "\"\"" },
        { "name": "password", "typeAnnotation": "String", "wrapperKind": "@State", "defaultValue": "\"\"" }
      ],
      "sourceAnchor": {
        "filePath": "Features/Auth/Views/LoginView.swift",
        "symbolPath": "Auth.LoginView",
        "startLine": 12,
        "startColumn": 1,
        "endLine": 65,
        "endColumn": 2
      },
      "canvasMeta": { "position": { "x": 100, "y": 200 }, "isCollapsed": false }
    },

    "node_auth_viewmodel": {
      "id": "node_auth_viewmodel",
      "name": "AuthViewModel",
      "level": "L2_COMPONENT",
      "kind": "viewModel",
      "inputs": [
        {
          "id": "in_login_request",
          "name": "login(credentials:)",
          "typeAnnotation": "Credentials",
          "direction": "input",
          "isAsync": true
        }
      ],
      "outputs": [
        {
          "id": "out_auth_success",
          "name": "onSuccess",
          "typeAnnotation": "UserSession",
          "direction": "output"
        },
        {
          "id": "out_auth_failure",
          "name": "onError",
          "typeAnnotation": "AuthError",
          "direction": "output"
        }
      ],
      "stateProps": [
        { "name": "isLoading", "typeAnnotation": "Bool", "wrapperKind": "@Observable", "defaultValue": "false" },
        { "name": "errorMessage", "typeAnnotation": "String?", "wrapperKind": "@Observable", "defaultValue": "nil" }
      ],
      "sourceAnchor": {
        "filePath": "Features/Auth/ViewModels/AuthViewModel.swift",
        "symbolPath": "Auth.AuthViewModel",
        "startLine": 8,
        "startColumn": 1,
        "endLine": 80,
        "endColumn": 2
      },
      "canvasMeta": { "position": { "x": 450, "y": 200 }, "isCollapsed": false }
    },

    "node_auth_service": {
      "id": "node_auth_service",
      "name": "AuthServiceProtocol",
      "level": "L2_COMPONENT",
      "kind": "service",
      "inputs": [
        {
          "id": "in_authenticate",
          "name": "authenticate(credentials:)",
          "typeAnnotation": "Credentials",
          "direction": "input",
          "isAsync": true,
          "canThrow": true
        }
      ],
      "outputs": [
        {
          "id": "out_auth_response",
          "name": "authResponse",
          "typeAnnotation": "UserSession",
          "direction": "output"
        }
      ],
      "sourceAnchor": {
        "filePath": "Services/Auth/AuthService.swift",
        "symbolPath": "Services.AuthService",
        "startLine": 5,
        "startColumn": 1,
        "endLine": 45,
        "endColumn": 2
      },
      "canvasMeta": { "position": { "x": 800, "y": 200 }, "isCollapsed": false }
    }
  },
  "edges": {
    "edge_view_to_vm": {
      "id": "edge_view_to_vm",
      "sourceNodeId": "node_login_view",
      "sourcePortId": "out_submit_tap",
      "targetNodeId": "node_auth_viewmodel",
      "targetPortId": "in_login_request",
      "edgeKind": "eventEmit",
      "executionMode": "async",
      "contract": {
        "payloadType": "Credentials"
      }
    },
    "edge_vm_to_service": {
      "id": "edge_vm_to_service",
      "sourceNodeId": "node_auth_viewmodel",
      "sourcePortId": "in_login_request",
      "targetNodeId": "node_auth_service",
      "targetPortId": "in_authenticate",
      "edgeKind": "call",
      "executionMode": "async",
      "contract": {
        "payloadType": "Credentials",
        "errorType": "AuthError"
      }
    }
  }
}
```

---

## 4. Hierarchy: How "Zooming" Works

```
+-------------------------------------------------------------------------------+
| L1: Feature Container (e.g. AuthModule)                                       |
|                                                                               |
|   +-------------------+       +---------------------+       +---------------+ |
|   | L2: LoginView     | ====> | L2: AuthViewModel   | ====> | L2: Service   | |
|   |                   |       |                     |       |               | |
|   | [Zoom in to L3]   |       | [Zoom in to L3]     |       +---------------+ |
|   |  * email state    |       |  * validate()       |                         |
|   |  * password state |       |  * isLoading state  |                         |
|   |  * button action  |       |  * network call task|                         |
|   +-------------------+       +---------------------+                         |
+-------------------------------------------------------------------------------+
```

* **When Collapsed (L1 / L2 View):** The canvas displays clean component blocks (`LoginView` $\rightarrow$ `AuthViewModel` $\rightarrow$ `AuthService`).
* **When Expanded (L3 View):** The user clicks into `AuthViewModel`, expanding internal execution nodes:
  * Input socket `login(credentials:)`
  * Guard node `isInputValid` $\rightarrow$ false branch triggers `errorMessage = "Invalid input"`
  * True branch triggers async task `service.authenticate(credentials)`
  * Result node updates `UserSession`.

---

## 5. Drift Detection & Synchronization Strategy

When code changes outside the canvas (or when the agent edits a file):
1. **Symbol Checksum Matching:** Each node stores a hash of its underlying AST declaration (`symbolChecksum`).
2. **Ast Re-scan:**
   * If AST structure matches $\rightarrow$ preserve user's canvas node coordinates and manual edge annotations.
   * If a method parameter was added $\rightarrow$ add input port to the node without clearing existing connections.
   * If a method was removed $\rightarrow$ mark port as orphan/stale with a visual warning badge.
3. **Graph Diffing:** The agent and developer can run `saag diff` to see architectural changes before committing.
