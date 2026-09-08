import Testing
import Foundation
@testable import SaagCore
@testable import SaagExtractor

@Suite("Swift Test Generator & Graph Differ Tests")
struct GeneratorTests {

    @Test("TestGenerator produces valid Swift Testing suite for happy path")
    func testHappyPathGeneration() {
        let code = TestGenerator.generateSwiftTest(for: "happy_path", moduleName: "AuthSample")
        #expect(code.contains("@Suite"))
        #expect(code.contains("@Test"))
        #expect(code.contains("@testable import AuthSample"))
        #expect(code.contains("viewModel.login(credentials: inputPayload)"))
        #expect(code.contains("viewModel.activeSession != nil"))
    }

    @Test("TestGenerator produces valid Swift Testing suite for validation error")
    func testValidationErrorGeneration() {
        let code = TestGenerator.generateSwiftTest(for: "validation_error", moduleName: "AuthSample")
        #expect(code.contains("@Suite"))
        #expect(code.contains("Password must be at least 6 characters."))
        #expect(code.contains("savedToken == nil"))
    }

    @Test("GraphDiffer accurately detects added and removed nodes")
    func testGraphDiffer() {
        let meta = GraphMetadata(projectName: "Test", rootPath: ".")
        let node1 = SaagNode(id: "node_1", name: "Node1", kind: "view")
        let node2 = SaagNode(id: "node_2", name: "Node2", kind: "service")
        let node3 = SaagNode(id: "node_3", name: "Node3", kind: "repository")

        let base = SaagGraph(metadata: meta, nodes: [node1.id: node1, node2.id: node2])
        let head = SaagGraph(metadata: meta, nodes: [node2.id: node2, node3.id: node3])

        let diff = GraphDiffer.diff(base: base, head: head)
        #expect(diff.hasChanges == true)
        #expect(diff.removedNodes.contains("node_1"))
        #expect(diff.addedNodes.contains("node_3"))
        #expect(!diff.addedNodes.contains("node_2"))
    }
}
