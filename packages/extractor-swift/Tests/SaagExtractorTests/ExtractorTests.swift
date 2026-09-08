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
}
