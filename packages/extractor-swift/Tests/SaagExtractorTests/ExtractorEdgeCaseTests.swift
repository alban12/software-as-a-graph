import Testing
import Foundation
@testable import SaagCore
@testable import SaagExtractor

@Suite("Swift AST Extractor Edge Cases")
struct ExtractorEdgeCaseTests {

    @Test("Gracefully handles malformed Swift syntax without crashing")
    func testMalformedSwiftSyntax() throws {
        let brokenCode = """
        import SwiftUI

        public struct BrokenView: View {
            @State var count: Int =
            // Missing closing brace and syntax errors
            func doSomething( {
        """

        // SwiftParser in SwiftSyntax is resilient and recovers from broken trees
        let types = SwiftFileScanner.parseFile(content: brokenCode, relativePath: "Views/BrokenView.swift")
        // It should either recover the struct or return safely without throwing fatal error
        #expect(types.count >= 0)
    }

    @Test("Handles empty and comment-only files cleanly")
    func testEmptyAndCommentFiles() throws {
        let emptyCode = ""
        let commentCode = """
        //
        //  Header.swift
        //  Copyright (c) 2026. All rights reserved.
        //

        import Foundation
        import SwiftUI
        """

        let emptyTypes = SwiftFileScanner.parseFile(content: emptyCode, relativePath: "Empty.swift")
        let commentTypes = SwiftFileScanner.parseFile(content: commentCode, relativePath: "Comments.swift")

        #expect(emptyTypes.isEmpty)
        #expect(commentTypes.isEmpty)
    }

    @Test("Extracts multiple distinct architectural types from a single file")
    func testMultipleTypesInSingleFile() throws {
        let multiCode = """
        import SwiftUI
        import Observation

        public struct DashboardView: View {
            @State private var viewModel = DashboardViewModel()

            public var body: some View {
                Text("Dashboard")
            }
        }

        @Observable
        public final class DashboardViewModel {
            public var metrics: [String] = []

            public init() {}

            public func loadMetrics() async {
                // fetch
            }
        }

        public final class DashboardService {
            public init() {}

            public func query() async throws -> String {
                return "OK"
            }
        }
        """

        let types = SwiftFileScanner.parseFile(content: multiCode, relativePath: "Features/Dashboard.swift")
        #expect(types.count == 3)

        let names = types.map { $0.name }
        #expect(names.contains("DashboardView"))
        #expect(names.contains("DashboardViewModel"))
        #expect(names.contains("DashboardService"))

        let nodes = types.map { $0.toSaagNode() }
        let viewNode = nodes.first { $0.name == "DashboardView" }
        let vmNode = nodes.first { $0.name == "DashboardViewModel" }
        let serviceNode = nodes.first { $0.name == "DashboardService" }

        #expect(viewNode?.kind == "view")
        #expect(vmNode?.kind == "viewModel")
        #expect(serviceNode?.kind == "service")
    }

    @Test("Extracts Swift Concurrency async/throws methods into socket ports")
    func testConcurrencyAndAsyncMethods() throws {
        let serviceCode = """
        import Foundation

        public final class PaymentGatewayService {
            public init() {}

            public func authorizePayment(amount: Double, currency: String) async throws -> Bool {
                return true
            }

            public func cancelTransaction(id: String) async {
                // cancel
            }
        }
        """

        let types = SwiftFileScanner.parseFile(content: serviceCode, relativePath: "Services/PaymentGatewayService.swift")
        #expect(types.count == 1)

        let node = types[0].toSaagNode()
        #expect(node.inputs.contains(where: { $0.name.contains("authorizePayment") }))
        #expect(node.inputs.contains(where: { $0.name.contains("cancelTransaction") }))
    }

    @Test("Extracts diverse SwiftUI property wrappers into stateProps")
    func testPropertyWrappersExtraction() throws {
        let viewCode = """
        import SwiftUI

        public struct StateGalleryView: View {
            @State private var counter: Int = 0
            @Binding var isActive: Bool
            @EnvironmentObject var appStore: AppStore

            public var body: some View {
                Text("Count: \\(counter)")
            }
        }
        """

        let types = SwiftFileScanner.parseFile(content: viewCode, relativePath: "Views/StateGalleryView.swift")
        #expect(types.count == 1)

        let node = types[0].toSaagNode()
        let propNames = node.stateProps?.map { $0.name } ?? []

        #expect(propNames.contains("counter"))
        #expect(propNames.contains("isActive"))
        #expect(propNames.contains("appStore"))
    }
}
