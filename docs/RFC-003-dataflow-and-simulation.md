# RFC-003: Dataflow Tracing, Simulation, and Test Generation

**Status:** Draft / In Review  
**Date:** 2026-09-08  
**Reference Target:** Swift / SwiftUI (Ecosystem-Agnostic Engine)  
**Document Owner:** Alban & Antigravity  

---

## 1. The Core Testing Paradigm

Traditional testing requires writing assertions against isolated units or running slow UI end-to-end automations.

In SaaG, **testing is visual and data-driven directly on the architecture**:
> *You inject a payload at an input socket of any node. You observe the path the data takes through the graph, inspect intermediate transformations, observe which state variables mutate, and confirm where the flow halts or terminates.*

```
[Test Injection]
       |
       v
+--------------+       +-------------------+       +---------------------+
|  LoginView   | ----> |   AuthViewModel   | ----> | AuthServiceProtocol |
+--------------+       +-------------------+       +---------------------+
                         | (Validation Fail)         | (Network Error)
                         v                           v
                       [Error State Mutated]       [Retry Policy Triggered]
```

---

## 2. Anatomy of a Dataflow Simulation Run

### 2.1. The Input Injection Event
An injection consists of:
* **Target:** `(nodeId, portId)`
* **Payload:** JSON/Swift representation matching the port's `typeAnnotation` (e.g., `{"email": "alban@example.com", "password": "pass"}`)
* **Initial State Context:** (Optional) starting state of relevant nodes (e.g., `isLoggedIn: false`).

### 2.2. Trace Lifecycle (Step-by-Step Propagation)
1. **Activation:** The target node receives the payload on its input port.
2. **Node Evaluation:**
   * Pure functions / transformations compute output payloads.
   * State holders update internal properties (marked as *Mutated* in the trace).
   * Conditional branches (guards, if/else, switch) evaluate predicates against the payload.
3. **Edge Dispatch:**
   * Output ports emit payloads along connected edges.
   * For asynchronous edges (`async/await`, `Task`), the simulation records latency/concurrency characteristics.
4. **Boundary Handling (Network / Keychain / External):**
   * If a node represents an external system or I/O boundary, SaaG checks for **stubs/mocks** defined on the edge or node.
   * If no stub is defined, the coding agent or user can interactively select:
     * *Option A:* Mock Return (e.g., return mock `UserSession(id: "usr_123")`).
     * *Option B:* Mock Throw (e.g., throw `AuthError.invalidCredentials`).
     * *Option C:* Live Execution (if connected to a local debug daemon).
5. **Termination:** The trace completes when all active branches reach terminal nodes or unhandled errors.

---

## 3. Visual Canvas Feedback (The Testing UX)

When a simulation is executed, the visual canvas renders real-time diagnostics:

| Visual State | Appearance | Meaning |
| :--- | :--- | :--- |
| **Active Flow** | Glowing Green Animated Stroke | Edge and nodes traversed by the data payload. |
| **Bypassed Path** | Dimmed Gray (30% opacity) | Branch not taken (e.g., `else` branch when validation passed). |
| **State Mutation** | Amber Pulsing Ring around Node | A reactive state variable (`@State`, `@Observable`) changed value. |
| **Error / Exception** | Glowing Red Stroke + Warning Badge | Flow halted due to a thrown error, guard return, or precondition failure. |
| **Async Wait** | Cyan Pulse | Edge waiting on an asynchronous task resolution. |

### Time-Travel Scrubber
The canvas includes a playback scrubber at the bottom:
`[ Step 1: Tap ] -> [ Step 2: Validate ] -> [ Step 3: Auth Request ] -> [ Step 4: Session Saved ]`
Clicking any step highlights the exact node active at that point in time and displays the payload inspector sidebar.

---

## 4. Agent Collaboration in the Simulation Loop

The coding agent is not just a passive reader; it is an active participant in testing:

### Use Case A: Developer Requests Verification
* **Human Prompt:** *"I want to test what happens if the user enters a password with less than 6 characters."*
* **Agent Action:**
  1. Identifies entry port: `LoginView.onSubmitTap`.
  2. Constructs injection payload: `Credentials(email: "test@example.com", password: "123")`.
  3. Executes symbolic trace.
  4. Responds: *"The flow successfully branches at `AuthViewModel.validatePassword()`, does not trigger `AuthService.login()`, and sets `AuthViewModel.errorMessage` to 'Password must be at least 6 characters'. Canvas highlights the error branch."*

### Use Case B: Agent Detects Broken Data Pipeline
* When an agent edits code or refactors an architectural component, it automatically re-runs baseline graph traces.
* If an edge contract breaks (e.g., a service now returns `Optional<User>` instead of `User`, but downstream expects non-optional), SaaG flags the broken edge on the graph immediately.

---

## 5. From Canvas Trace to Native Swift Test (XCTest / Swift Testing)

A major goal of SaaG is bridging visual understanding with **concrete executable code**.

Once you and the agent verify a flow on the canvas, SaaG can serialize the trace into a native, standalone Swift test file using Apple's modern `Testing` library (`@Test`) or `XCTest`:

### Example Generated Swift Test:
```swift
import Testing
@testable import MyApp

@Suite("SaaG Dataflow Verification: Login Pipeline")
struct LoginDataflowTests {

    @Test("Verifies short password triggers validation error and halts network call")
    func testShortPasswordHaltsBeforeService() async throws {
        // 1. Initial State
        let mockService = MockAuthService()
        let viewModel = AuthViewModel(authService: mockService)
        
        // 2. Input Injection at Port: login(credentials:)
        let payload = Credentials(email: "alban@example.com", password: "123")
        await viewModel.login(credentials: payload)
        
        // 3. Flow Assertions derived from Graph Trace
        #expect(viewModel.errorMessage == "Password must be at least 6 characters")
        #expect(viewModel.isLoading == false)
        #expect(mockService.authenticateCallCount == 0, "Service must not be called when validation fails")
    }
}
```

This ensures that the mental agreement between you and the agent is immediately locked in as a regression test in your CI pipeline.
