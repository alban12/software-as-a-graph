import Testing
import Foundation
@testable import SaagCore
@testable import SaagExtractor

@Suite("Swift AST Extractor Tests")
struct ExtractorTests {

    @Test("Extracts nodes and edges from sample Swift source code")
    func testExtractorOnCodeSnippet() throws {
        let sampleView = """
        import SwiftUI

        @MainActor
        public struct ProfileView: View {
            @State private var username: String = ""
            private let viewModel: ProfileViewModel

            public var body: some View {
                Button("Save") {
                    viewModel.saveProfile(name: username)
                }
            }
        }
        """

        let sampleVM = """
        import Foundation
        import Observation

        @Observable
        public final class ProfileViewModel {
            public var isLoading: Bool = false
            private let apiService: ProfileApiService

            public init(apiService: ProfileApiService) {
                self.apiService = apiService
            }

            public func saveProfile(name: String) {
                apiService.uploadUser(name: name)
            }
        }
        """

        let sampleService = """
        import Foundation

        public final class ProfileApiService {
            public init() {}
            public func uploadUser(name: String) async throws -> Bool {
                return true
            }
        }
        """

        let viewTypes = SwiftFileScanner.parseFile(content: sampleView, relativePath: "Views/ProfileView.swift")
        let vmTypes = SwiftFileScanner.parseFile(content: sampleVM, relativePath: "ViewModels/ProfileViewModel.swift")
        let serviceTypes = SwiftFileScanner.parseFile(content: sampleService, relativePath: "Services/ProfileApiService.swift")

        #expect(viewTypes.count == 1)
        #expect(vmTypes.count == 1)
        #expect(serviceTypes.count == 1)

        let viewNode = viewTypes[0].toSaagNode()
        let vmNode = vmTypes[0].toSaagNode()
        let serviceNode = serviceTypes[0].toSaagNode()

        #expect(viewNode.kind == "view")
        #expect(viewNode.name == "ProfileView")
        #expect(viewNode.stateProps?.contains(where: { $0.name == "username" }) == true)

        #expect(vmNode.kind == "viewModel")
        #expect(vmNode.name == "ProfileViewModel")
        #expect(vmNode.inputs.contains(where: { $0.name.contains("saveProfile") }) == true)

        #expect(serviceNode.kind == "service")
        #expect(serviceNode.inputs.contains(where: { $0.name.contains("uploadUser") }) == true)

        let allNodes: [String: SaagNode] = [
            viewNode.id: viewNode,
            vmNode.id: vmNode,
            serviceNode.id: serviceNode
        ]

        let viewEdges = SwiftFileScanner.inferEdges(for: viewTypes[0], against: allNodes)
        let vmEdges = SwiftFileScanner.inferEdges(for: vmTypes[0], against: allNodes)

        #expect(viewEdges.count >= 1)
        #expect(viewEdges[0].sourceNodeId == viewNode.id)
        #expect(viewEdges[0].targetNodeId == vmNode.id)

        #expect(vmEdges.count >= 1)
        #expect(vmEdges[0].sourceNodeId == vmNode.id)
        #expect(vmEdges[0].targetNodeId == serviceNode.id)
    }

    @Test("Extracts concrete SwiftUI ViewElements with line spans")
    func testViewElementExtraction() throws {
        let sampleLogin = """
        import SwiftUI

        @MainActor
        public struct LoginView: View {
            @State private var inputEmail: String = ""
            @State private var inputPassword: String = ""

            public var body: some View {
                VStack {
                    TextField("Email", text: $inputEmail)
                    SecureField("Password", text: $inputPassword)
                    Text(errorMessage)
                    Button {
                        Task {
                            await viewModel.login(credentials: credentials)
                        }
                    } label: {
                        Text("Log In")
                    }
                }
            }
        }
        """

        let parsed = SwiftFileScanner.parseFile(content: sampleLogin, relativePath: "LoginView.swift")
        #expect(parsed.count == 1)
        let node = parsed[0].toSaagNode()

        #expect(node.viewElements != nil)
        let elements = node.viewElements ?? []
        #expect(elements.count == 4)

        let tf = elements.first(where: { $0.type == "textField" })
        #expect(tf?.label == "Email")
        #expect(tf?.binding == "$inputEmail")

        let sf = elements.first(where: { $0.type == "secureField" })
        #expect(sf?.label == "Password")
        #expect(sf?.binding == "$inputPassword")

        let btn = elements.first(where: { $0.type == "button" })
        #expect(btn?.label == "Log In")
        #expect(btn?.action?.contains("viewModel.login") == true)
    }

    @Test("Extracts transient approval views and service metadata")
    func testTransientAndServiceMetaExtraction() throws {
        let sampleApproval = """
        import SwiftUI

        public struct BiometricApprovalView: View {
            public var body: some View {
                Text("Approve with FaceID")
            }
        }
        """

        let sampleAuthService = """
        public final class LiveAuthService: AuthServiceProtocol {
            public init() {}
            public func authenticate(credentials: Credentials) async throws -> UserSession {
                return UserSession(userId: "user_123", token: "tok_abc")
            }
        }
        """

        let approvalTypes = SwiftFileScanner.parseFile(content: sampleApproval, relativePath: "BiometricApprovalView.swift")
        #expect(approvalTypes.count == 1)
        let approvalNode = approvalTypes[0].toSaagNode()
        #expect(approvalNode.isTransient == true)
        #expect(approvalNode.isSqueezed == true)

        let serviceTypes = SwiftFileScanner.parseFile(content: sampleAuthService, relativePath: "LiveAuthService.swift")
        #expect(serviceTypes.count == 1)
        let serviceNode = serviceTypes[0].toSaagNode()
        #expect(serviceNode.serviceMeta != nil)
        #expect(serviceNode.serviceMeta?.serviceType == "firebase")
        #expect(serviceNode.serviceMeta?.collections?.contains("users") == true)
    }

    @Test("Generates agent workspace scoping contract and validates violations")
    func testAgentScopeContractAndViolationValidation() throws {
        let viewNode = SaagNode(
            id: "node_view",
            name: "LoginView",
            level: "L2_COMPONENT",
            kind: "view",
            sourceAnchor: SourceAnchor(filePath: "AuthSample/LoginView.swift", symbolPath: "LoginView", startLine: 1, startColumn: 1, endLine: 30, endColumn: 1)
        )
        let vmNode = SaagNode(
            id: "node_vm",
            name: "AuthViewModel",
            level: "L2_COMPONENT",
            kind: "viewModel",
            inputs: [SaagPort(id: "port_vm_in", name: "login", typeAnnotation: "Credentials", direction: "input")],
            outputs: [SaagPort(id: "port_vm_out", name: "saveToken", typeAnnotation: "String", direction: "output")],
            sourceAnchor: SourceAnchor(filePath: "AuthSample/AuthViewModel.swift", symbolPath: "AuthViewModel", startLine: 1, startColumn: 1, endLine: 40, endColumn: 1)
        )
        let storageNode = SaagNode(
            id: "node_storage",
            name: "KeychainStorage",
            level: "L2_COMPONENT",
            kind: "repository",
            inputs: [SaagPort(id: "port_storage_in", name: "save", typeAnnotation: "String", direction: "input")],
            sourceAnchor: SourceAnchor(filePath: "AuthSample/KeychainStorage.swift", symbolPath: "KeychainStorage", startLine: 1, startColumn: 1, endLine: 25, endColumn: 1)
        )

        let edge1 = SaagEdge(id: "e1", sourceNodeId: "node_view", sourcePortId: "out_tap", targetNodeId: "node_vm", targetPortId: "port_vm_in", edgeKind: "call")
        let edge2 = SaagEdge(id: "e2", sourceNodeId: "node_vm", sourcePortId: "port_vm_out", targetNodeId: "node_storage", targetPortId: "port_storage_in", edgeKind: "call")

        let graph = SaagGraph(
            metadata: GraphMetadata(projectName: "TestAuth", rootPath: "/test"),
            nodes: [viewNode.id: viewNode, vmNode.id: vmNode, storageNode.id: storageNode],
            edges: [edge1.id: edge1, edge2.id: edge2]
        )

        // Lock scope only to AuthViewModel
        let workspace = ScopeValidator.generateScopeContract(for: ["node_vm"], in: graph, name: "Auth ViewModel Scope")

        #expect(workspace.lockedNodeIds == ["node_vm"])
        #expect(workspace.allowedFilePaths == ["AuthSample/AuthViewModel.swift"])
        #expect(workspace.forbiddenFilePaths.contains("AuthSample/LoginView.swift"))
        #expect(workspace.forbiddenFilePaths.contains("AuthSample/KeychainStorage.swift"))

        // Verify boundary ports
        #expect(workspace.frozenBoundaryPorts.count == 2)
        let inPort = workspace.frozenBoundaryPorts.first(where: { $0.direction == "input" })
        #expect(inPort?.portName == "login")
        #expect(inPort?.typeAnnotation == "Credentials")

        let outPort = workspace.frozenBoundaryPorts.first(where: { $0.direction == "output" })
        #expect(outPort?.portName == "saveToken")

        // Validate agent prompt contains key sections
        let prompt = workspace.agentPrompt ?? ""
        #expect(prompt.contains("AuthSample/AuthViewModel.swift"))
        #expect(prompt.contains("IMMUTABLE"))

        // Test compliant changes
        let cleanResult = ScopeValidator.validateChanges(against: workspace, changedFiles: ["AuthSample/AuthViewModel.swift"])
        #expect(cleanResult.isCompliant == true)
        #expect(cleanResult.violations.isEmpty)

        // Test violating changes (agent modified LoginView outside scope)
        let dirtyResult = ScopeValidator.validateChanges(against: workspace, changedFiles: [
            "AuthSample/AuthViewModel.swift",
            "AuthSample/LoginView.swift"
        ])
        #expect(dirtyResult.isCompliant == false)
        #expect(dirtyResult.violations.count == 1)
        #expect(dirtyResult.violations[0].contains("LoginView.swift"))
    }

    @Test("Detects retain cycle risk in class closures capturing self without weak self")
    func testRetainCycleDetection() throws {
        let leakySwiftClass = """
        import Foundation

        public final class LeakyService {
            private var observer: Any?
            public var onResult: (() -> Void)?

            public func startListening() {
                NotificationCenter.default.addObserver(forName: .NSCalendarDayChanged, object: nil, queue: .main) { note in
                    self.handleUpdate()
                }
            }

            public func setupCallback() {
                self.onResult = {
                    self.handleUpdate()
                }
            }

            private func handleUpdate() {
                print("Updated")
            }
        }
        """

        let risks = RetainCycleDetector.detectRisks(in: leakySwiftClass, filePath: "Services/LeakyService.swift")
        #expect(risks.count >= 1)
        let firstRisk = risks[0]
        #expect(firstRisk.symbol == "LeakyService")
        #expect(firstRisk.description.contains("without [weak self]"))
        #expect(firstRisk.suggestion.contains("[weak self]"))

        // Now test safe class with [weak self]
        let safeSwiftClass = """
        import Foundation

        public final class SafeService {
            public func startListening() {
                NotificationCenter.default.addObserver(forName: .NSCalendarDayChanged, object: nil, queue: .main) { [weak self] note in
                    self?.handleUpdate()
                }
            }

            private func handleUpdate() {}
        }
        """
        let safeRisks = RetainCycleDetector.detectRisks(in: safeSwiftClass, filePath: "Services/SafeService.swift")
        #expect(safeRisks.isEmpty)
    }
}


