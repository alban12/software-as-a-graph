import Foundation
import SaagCore

public struct ExtractorOptions {
    public var projectName: String
    public var rootPath: String
    public var targetSubpaths: [String]

    public init(projectName: String = "App", rootPath: String, targetSubpaths: [String] = []) {
        self.projectName = projectName
        self.rootPath = rootPath
        self.targetSubpaths = targetSubpaths
    }
}

public final class SwiftCodebaseExtractor {
    private let options: ExtractorOptions

    public init(options: ExtractorOptions) {
        self.options = options
    }

    public func extract() throws -> SaagGraph {
        let fileManager = FileManager.default
        let rootURL = URL(fileURLWithPath: options.rootPath)

        var swiftFiles: [URL] = []
        if let enumerator = fileManager.enumerator(at: rootURL, includingPropertiesForKeys: [.isRegularFileKey], options: [.skipsHiddenFiles]) {
            for case let fileURL as URL in enumerator {
                if fileURL.pathExtension == "swift" {
                    swiftFiles.append(fileURL)
                }
            }
        }

        var allNodes: [String: SaagNode] = [:]
        var allEdges: [String: SaagEdge] = [:]

        // 1. First pass: extract all nodes (types, views, viewmodels, services)
        var fileAstMap: [String: [ParsedTypeDecl]] = [:]
        for fileURL in swiftFiles {
            let content = try String(contentsOf: fileURL, encoding: .utf8)
            let relativePath = fileURL.path.replacingOccurrences(of: rootURL.path + "/", with: "")
            let parsedTypes = SwiftFileScanner.parseFile(content: content, relativePath: relativePath)
            fileAstMap[relativePath] = parsedTypes

            for type in parsedTypes {
                let node = type.toSaagNode()
                allNodes[node.id] = node
            }
        }

        // 2. Second pass: discover edges (view -> viewmodel calls, viewmodel -> service calls)
        for (_, parsedTypes) in fileAstMap {
            for type in parsedTypes {
                let inferredEdges = SwiftFileScanner.inferEdges(for: type, against: allNodes)
                for edge in inferredEdges {
                    allEdges[edge.id] = edge
                }
            }
        }

        // Assign clean visual coordinates for the canvas
        layoutNodes(&allNodes)

        let metadata = GraphMetadata(
            projectName: options.projectName,
            targetPlatform: "swift",
            rootPath: options.rootPath,
            lastSynchronizedAt: ISO8601DateFormatter().string(from: Date())
        )

        return SaagGraph(
            schemaVersion: "1.0.0",
            metadata: metadata,
            nodes: allNodes,
            edges: allEdges
        )
    }

    private func layoutNodes(_ nodes: inout [String: SaagNode]) {
        // Arrange nodes by kind in horizontal bands
        let xByType: [String: Double] = [
            "view": 80.0,
            "viewModel": 420.0,
            "service": 760.0,
            "repository": 1100.0,
            "externalSystem": 1440.0
        ]
        var yByType: [String: Double] = [
            "view": 100.0,
            "viewModel": 100.0,
            "service": 100.0,
            "repository": 100.0,
            "externalSystem": 100.0
        ]

        for (id, var node) in nodes {
            let kind = node.kind
            let x = xByType[kind] ?? 100.0
            let y = yByType[kind] ?? 100.0
            node.canvasMeta = CanvasMeta(position: CanvasPosition(x: x, y: y), isCollapsed: false)
            yByType[kind] = y + 160.0
            nodes[id] = node
        }
    }
}
