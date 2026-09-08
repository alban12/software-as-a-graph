import Foundation

public struct SaagGraph: Codable, Equatable {
    public var schemaVersion: String
    public var metadata: GraphMetadata
    public var nodes: [String: SaagNode]
    public var edges: [String: SaagEdge]

    public init(
        schemaVersion: String = "1.0.0",
        metadata: GraphMetadata,
        nodes: [String: SaagNode] = [:],
        edges: [String: SaagEdge] = [:]
    ) {
        self.schemaVersion = schemaVersion
        self.metadata = metadata
        self.nodes = nodes
        self.edges = edges
    }
}

public struct GraphMetadata: Codable, Equatable {
    public var projectName: String
    public var targetPlatform: String
    public var rootPath: String
    public var lastSynchronizedAt: String
    public var sourceChecksum: String?

    public init(
        projectName: String,
        targetPlatform: String = "swift",
        rootPath: String,
        lastSynchronizedAt: String = ISO8601DateFormatter().string(from: Date()),
        sourceChecksum: String? = nil
    ) {
        self.projectName = projectName
        self.targetPlatform = targetPlatform
        self.rootPath = rootPath
        self.lastSynchronizedAt = lastSynchronizedAt
        self.sourceChecksum = sourceChecksum
    }
}

public struct SaagNode: Codable, Equatable {
    public var id: String
    public var name: String
    public var level: String // "L1_SYSTEM" | "L2_COMPONENT" | "L3_EXECUTION"
    public var kind: String  // "view" | "viewModel" | "service" | "repository" | ...
    public var parentId: String?
    public var inputs: [SaagPort]
    public var outputs: [SaagPort]
    public var stateProps: [StateProperty]?
    public var sourceAnchor: SourceAnchor?
    public var canvasMeta: CanvasMeta?

    public init(
        id: String,
        name: String,
        level: String = "L2_COMPONENT",
        kind: String,
        parentId: String? = nil,
        inputs: [SaagPort] = [],
        outputs: [SaagPort] = [],
        stateProps: [StateProperty]? = nil,
        sourceAnchor: SourceAnchor? = nil,
        canvasMeta: CanvasMeta? = nil
    ) {
        self.id = id
        self.name = name
        self.level = level
        self.kind = kind
        self.parentId = parentId
        self.inputs = inputs
        self.outputs = outputs
        self.stateProps = stateProps
        self.sourceAnchor = sourceAnchor
        self.canvasMeta = canvasMeta
    }
}

public struct SaagPort: Codable, Equatable {
    public var id: String
    public var name: String
    public var typeAnnotation: String
    public var schemaSnippet: String?
    public var direction: String // "input" | "output"
    public var isAsync: Bool?
    public var canThrow: Bool?

    public init(
        id: String,
        name: String,
        typeAnnotation: String,
        schemaSnippet: String? = nil,
        direction: String,
        isAsync: Bool? = nil,
        canThrow: Bool? = nil
    ) {
        self.id = id
        self.name = name
        self.typeAnnotation = typeAnnotation
        self.schemaSnippet = schemaSnippet
        self.direction = direction
        self.isAsync = isAsync
        self.canThrow = canThrow
    }
}

public struct StateProperty: Codable, Equatable {
    public var name: String
    public var typeAnnotation: String
    public var wrapperKind: String?
    public var defaultValue: String?
    public var isReadOnly: Bool?

    public init(
        name: String,
        typeAnnotation: String,
        wrapperKind: String? = nil,
        defaultValue: String? = nil,
        isReadOnly: Bool? = nil
    ) {
        self.name = name
        self.typeAnnotation = typeAnnotation
        self.wrapperKind = wrapperKind
        self.defaultValue = defaultValue
        self.isReadOnly = isReadOnly
    }
}

public struct SourceAnchor: Codable, Equatable {
    public var filePath: String
    public var symbolPath: String
    public var startLine: Int
    public var startColumn: Int
    public var endLine: Int
    public var endColumn: Int
    public var symbolChecksum: String?

    public init(
        filePath: String,
        symbolPath: String,
        startLine: Int,
        startColumn: Int,
        endLine: Int,
        endColumn: Int,
        symbolChecksum: String? = nil
    ) {
        self.filePath = filePath
        self.symbolPath = symbolPath
        self.startLine = startLine
        self.startColumn = startColumn
        self.endLine = endLine
        self.endColumn = endColumn
        self.symbolChecksum = symbolChecksum
    }
}

public struct CanvasMeta: Codable, Equatable {
    public var position: CanvasPosition
    public var width: Double?
    public var height: Double?
    public var isCollapsed: Bool?
    public var colorTag: String?

    public init(
        position: CanvasPosition,
        width: Double? = nil,
        height: Double? = nil,
        isCollapsed: Bool? = nil,
        colorTag: String? = nil
    ) {
        self.position = position
        self.width = width
        self.height = height
        self.isCollapsed = isCollapsed
        self.colorTag = colorTag
    }
}

public struct CanvasPosition: Codable, Equatable {
    public var x: Double
    public var y: Double

    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }
}

public struct SaagEdge: Codable, Equatable {
    public var id: String
    public var sourceNodeId: String
    public var sourcePortId: String
    public var targetNodeId: String
    public var targetPortId: String
    public var edgeKind: String       // "call" | "dataTransfer" | "stateBinding" | "eventEmit" | "dependencyInject"
    public var executionMode: String   // "sync" | "async" | "reactive_stream"
    public var contract: EdgeContract?

    public init(
        id: String,
        sourceNodeId: String,
        sourcePortId: String,
        targetNodeId: String,
        targetPortId: String,
        edgeKind: String,
        executionMode: String = "sync",
        contract: EdgeContract? = nil
    ) {
        self.id = id
        self.sourceNodeId = sourceNodeId
        self.sourcePortId = sourcePortId
        self.targetNodeId = targetNodeId
        self.targetPortId = targetPortId
        self.edgeKind = edgeKind
        self.executionMode = executionMode
        self.contract = contract
    }
}

public struct EdgeContract: Codable, Equatable {
    public var payloadType: String
    public var guarantees: [String]?
    public var errorType: String?

    public init(
        payloadType: String,
        guarantees: [String]? = nil,
        errorType: String? = nil
    ) {
        self.payloadType = payloadType
        self.guarantees = guarantees
        self.errorType = errorType
    }
}
