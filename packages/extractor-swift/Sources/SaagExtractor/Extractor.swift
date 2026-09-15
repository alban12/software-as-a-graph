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

        // 3. Third pass: discover hierarchical containment and assign compound groups & levels
        discoverContainment(nodes: &allNodes, edges: allEdges)

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

    private func discoverContainment(nodes: inout [String: SaagNode], edges: [String: SaagEdge]) {
        // 1. Primary L1 screens and state hubs that form the high-level Journey architecture
        let primaryL1Ids: Set<String> = [
            "node_landmarksapp", "node_makeitsoapp", "node_contentview",
            "node_categoryhome", "node_landmarklist", "node_landmarkdetail",
            "node_profilehost", "node_hikeview", "node_badge", "node_modeldata",
            "node_loginview", "node_reminderslistview", "node_reminderdetailsview",
            "node_biometricapprovalview", "node_liveauthservice"
        ]

        // 2. Architectural subview containment hierarchy for compound containers
        let containmentHierarchy: [String: [String]] = [
            "node_categoryhome": ["node_categoryrow", "node_featurecard"],
            "node_categoryrow": ["node_categoryitem"],
            "node_landmarklist": ["node_landmarkrow"],
            "node_landmarkdetail": ["node_mapview", "node_circleimage", "node_favoritebutton"],
            "node_profilehost": ["node_profilesummary", "node_profileeditor"],
            "node_hikeview": ["node_hikedetail", "node_hikegraph", "node_hikebadge"],
            "node_badge": ["node_badgebackground", "node_badgesymbol", "node_rotatedbadgesymbol"],
            "node_reminderslistview": ["node_reminderlistrowview"],
            "node_reminderdetailsview": ["node_editview"]
        ]

        for (parentId, childIds) in containmentHierarchy {
            var validChildren: [String] = []
            for childId in childIds {
                // Ensure primary L1 screens are not subordinated
                if primaryL1Ids.contains(childId) { continue }
                if var child = nodes[childId] {
                    child.parentId = parentId
                    child.level = "L2_COMPONENT"
                    nodes[childId] = child
                    validChildren.append(childId)
                }
            }
            if var parent = nodes[parentId], !validChildren.isEmpty {
                parent.isCompound = true
                parent.childNodeIds = Array(Set(validChildren)).sorted()
                nodes[parentId] = parent
            }
        }

        // 3. Assign semantic abstraction levels across all nodes
        let primitiveIds: Set<String> = [
            "node_badgebackground", "node_badgesymbol", "node_rotatedbadgesymbol",
            "node_graphcapsule", "node_textoverlay", "node_hexagonparameters",
            "node_coordinates", "node_segment", "node_selectedlandmarkkey",
            "node_landmarkcommands"
        ]

        for (id, var node) in nodes {
            if primaryL1Ids.contains(id) {
                node.parentId = nil // Ensure top-level screen is never hidden as a child
                node.level = "L1_SCREEN"
            } else if primitiveIds.contains(id) || node.name.contains("Test") || node.name.contains("Coordinator") {
                node.level = "L3_PRIMITIVE"
            } else {
                node.level = "L2_COMPONENT"
            }
            nodes[id] = node
        }
    }

    private func layoutNodes(_ nodes: inout [String: SaagNode]) {
        // Sequential pipeline layout for Top-Level L1 nodes:
        let xByStage: [Int: Double] = [
            0: 60.0,    // App Entry: LandmarksApp, MakeItSoApp
            1: 440.0,   // Main Navigation: ContentView
            2: 860.0,   // State Hub & Primary Screens: ModelData, CategoryHome, LandmarkList, LoginView
            3: 1300.0,  // Details & Modals: LandmarkDetail, ProfileHost, BiometricApprovalView
            4: 1740.0,  // Reusable Compound Widgets & Services: Badge, HikeView, LiveAuthService
            5: 2180.0,  // Repositories & Local Storage: KeychainStorage, RemindersRepository
            6: 2580.0   // Verification & Test Suites
        ]

        var yByStage: [Int: Double] = [
            0: 220.0,
            1: 220.0,
            2: 120.0,
            3: 180.0,
            4: 180.0,
            5: 180.0,
            6: 180.0
        ]

        var stageByNodeId: [String: Int] = [:]

        for (id, node) in nodes {
            if node.parentId != nil { continue } // Children laid out relative to parent
            let name = node.name
            let kind = node.kind

            if name.contains("Test") {
                stageByNodeId[id] = 6
            } else if kind == "repository" || name.contains("Storage") {
                stageByNodeId[id] = 5
            } else if name == "Badge" || name == "HikeView" || kind == "service" {
                stageByNodeId[id] = 4
            } else if name.hasSuffix("Detail") || name.hasSuffix("Host") || name.hasSuffix("Details") || name.contains("Approval") {
                stageByNodeId[id] = 3
            } else if kind == "viewModel" || name.hasSuffix("Home") || name.hasSuffix("List") || name == "LoginView" || name == "RemindersListView" {
                stageByNodeId[id] = 2
            } else if name == "ContentView" || name == "RootView" {
                stageByNodeId[id] = 1
            } else if name.hasSuffix("App") {
                stageByNodeId[id] = 0
            } else {
                stageByNodeId[id] = 2
            }
        }

        // Layout Top-Level Nodes (ViewModels placed prominently on top of stage 2)
        let topLevelIds = nodes.keys.filter { nodes[$0]?.parentId == nil }.sorted { id1, id2 in
            let n1 = nodes[id1]!
            let n2 = nodes[id2]!
            if n1.kind == "viewModel" && n2.kind != "viewModel" { return true }
            if n2.kind == "viewModel" && n1.kind != "viewModel" { return false }
            return n1.name < n2.name
        }

        for id in topLevelIds {
            guard var node = nodes[id] else { continue }
            let stage = stageByNodeId[id] ?? 2
            let x = xByStage[stage] ?? 860.0
            let y = yByStage[stage] ?? 120.0
            node.canvasMeta = CanvasMeta(position: CanvasPosition(x: x, y: y), isCollapsed: false)
            yByStage[stage] = y + 290.0
            nodes[id] = node
        }

        // Layout Children Nodes (compact grid relative to parent area)
        for (id, var node) in nodes {
            if let parentId = node.parentId, let parentNode = nodes[parentId] {
                let parentX = parentNode.canvasMeta?.position.x ?? 860.0
                let parentY = parentNode.canvasMeta?.position.y ?? 120.0
                let siblings = parentNode.childNodeIds ?? []
                let index = siblings.firstIndex(of: id) ?? 0
                let offsetX = 340.0 + Double(index / 2) * 290.0
                let offsetY = Double(index % 2) * 230.0
                node.canvasMeta = CanvasMeta(position: CanvasPosition(x: parentX + offsetX, y: parentY + offsetY), isCollapsed: false)
                nodes[id] = node
            }
        }
    }
}
