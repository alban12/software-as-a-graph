import Foundation

public struct SaagGraph: Codable, Equatable {
    public var schemaVersion: String
    public var metadata: GraphMetadata
    public var nodes: [String: SaagNode]
    public var edges: [String: SaagEdge]
    public var activeWorkspace: AgentWorkspace?

    public init(
        schemaVersion: String = "1.0.0",
        metadata: GraphMetadata,
        nodes: [String: SaagNode] = [:],
        edges: [String: SaagEdge] = [:],
        activeWorkspace: AgentWorkspace? = nil
    ) {
        self.schemaVersion = schemaVersion
        self.metadata = metadata
        self.nodes = nodes
        self.edges = edges
        self.activeWorkspace = activeWorkspace
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
    public var viewElements: [ViewElement]?
    public var isTransient: Bool?
    public var isSqueezed: Bool?
    public var isCompound: Bool?
    public var childNodeIds: [String]?
    public var serviceMeta: ServiceMeta?
    public var previewMeta: PreviewMeta?
    public var sourceAnchor: SourceAnchor?
    public var canvasMeta: CanvasMeta?
    public var perfMeta: NodePerfMeta?

    public init(
        id: String,
        name: String,
        level: String = "L2_COMPONENT",
        kind: String,
        parentId: String? = nil,
        inputs: [SaagPort] = [],
        outputs: [SaagPort] = [],
        stateProps: [StateProperty]? = nil,
        viewElements: [ViewElement]? = nil,
        isTransient: Bool? = nil,
        isSqueezed: Bool? = nil,
        isCompound: Bool? = nil,
        childNodeIds: [String]? = nil,
        serviceMeta: ServiceMeta? = nil,
        previewMeta: PreviewMeta? = nil,
        sourceAnchor: SourceAnchor? = nil,
        canvasMeta: CanvasMeta? = nil,
        perfMeta: NodePerfMeta? = nil
    ) {
        self.id = id
        self.name = name
        self.level = level
        self.kind = kind
        self.parentId = parentId
        self.inputs = inputs
        self.outputs = outputs
        self.stateProps = stateProps
        self.viewElements = viewElements
        self.isTransient = isTransient
        self.isSqueezed = isSqueezed
        self.isCompound = isCompound
        self.childNodeIds = childNodeIds
        self.serviceMeta = serviceMeta
        self.previewMeta = previewMeta
        self.sourceAnchor = sourceAnchor
        self.canvasMeta = canvasMeta
        self.perfMeta = perfMeta
    }
}

public struct ServiceMeta: Codable, Equatable {
    public var serviceType: String // "firebase" | "supabase" | "rest_api" | "cloud_function"
    public var provider: String?
    public var projectRef: String?
    public var status: String?
    public var consoleUrl: String?
    public var collections: [String]?
    public var endpoints: [String]?

    public init(
        serviceType: String,
        provider: String? = nil,
        projectRef: String? = nil,
        status: String? = "online",
        consoleUrl: String? = nil,
        collections: [String]? = nil,
        endpoints: [String]? = nil
    ) {
        self.serviceType = serviceType
        self.provider = provider
        self.projectRef = projectRef
        self.status = status
        self.consoleUrl = consoleUrl
        self.collections = collections
        self.endpoints = endpoints
    }
}

public struct ViewElement: Codable, Equatable {
    public var id: String
    public var type: String // "textField" | "secureField" | "button" | "text" | "progressView" | "toggle"
    public var label: String
    public var binding: String?
    public var action: String?
    public var startLine: Int?
    public var endLine: Int?

    public init(
        id: String,
        type: String,
        label: String,
        binding: String? = nil,
        action: String? = nil,
        startLine: Int? = nil,
        endLine: Int? = nil
    ) {
        self.id = id
        self.type = type
        self.label = label
        self.binding = binding
        self.action = action
        self.startLine = startLine
        self.endLine = endLine
    }
}

public struct PreviewMeta: Codable, Equatable {
    public var hasPreview: Bool
    public var previewKind: String? // "device_frame" | "component_mockup" | "live_render"
    public var deviceFrame: String? // "iphone-16-pro" | "ipad" | "mac"
    public var variants: [PreviewVariant]?

    public init(
        hasPreview: Bool = true,
        previewKind: String? = "device_frame",
        deviceFrame: String? = "iphone-16-pro",
        variants: [PreviewVariant]? = nil
    ) {
        self.hasPreview = hasPreview
        self.previewKind = previewKind
        self.deviceFrame = deviceFrame
        self.variants = variants
    }
}

public struct PreviewVariant: Codable, Equatable {
    public var id: String
    public var name: String
    public var previewUrl: String?
    public var stateDescription: String?

    public init(id: String, name: String, previewUrl: String? = nil, stateDescription: String? = nil) {
        self.id = id
        self.name = name
        self.previewUrl = previewUrl
        self.stateDescription = stateDescription
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
    public var perfMeta: EdgePerfMeta?

    public init(
        id: String,
        sourceNodeId: String,
        sourcePortId: String,
        targetNodeId: String,
        targetPortId: String,
        edgeKind: String,
        executionMode: String = "sync",
        contract: EdgeContract? = nil,
        perfMeta: EdgePerfMeta? = nil
    ) {
        self.id = id
        self.sourceNodeId = sourceNodeId
        self.sourcePortId = sourcePortId
        self.targetNodeId = targetNodeId
        self.targetPortId = targetPortId
        self.edgeKind = edgeKind
        self.executionMode = executionMode
        self.contract = contract
        self.perfMeta = perfMeta
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

public struct BoundaryPort: Codable, Equatable {
    public var nodeId: String
    public var nodeName: String
    public var portId: String
    public var portName: String
    public var direction: String // "input" | "output"
    public var typeAnnotation: String
    public var connectedToNodeId: String?
    public var connectedToNodeName: String?

    public init(
        nodeId: String,
        nodeName: String,
        portId: String,
        portName: String,
        direction: String,
        typeAnnotation: String,
        connectedToNodeId: String? = nil,
        connectedToNodeName: String? = nil
    ) {
        self.nodeId = nodeId
        self.nodeName = nodeName
        self.portId = portId
        self.portName = portName
        self.direction = direction
        self.typeAnnotation = typeAnnotation
        self.connectedToNodeId = connectedToNodeId
        self.connectedToNodeName = connectedToNodeName
    }
}

public struct AgentWorkspace: Codable, Equatable {
    public var id: String
    public var name: String
    public var description: String?
    public var lockedNodeIds: [String]
    public var allowedFilePaths: [String]
    public var frozenBoundaryPorts: [BoundaryPort]
    public var forbiddenFilePaths: [String]
    public var agentPrompt: String?
    public var createdAt: String

    public init(
        id: String,
        name: String,
        description: String? = nil,
        lockedNodeIds: [String],
        allowedFilePaths: [String],
        frozenBoundaryPorts: [BoundaryPort] = [],
        forbiddenFilePaths: [String] = [],
        agentPrompt: String? = nil,
        createdAt: String = ISO8601DateFormatter().string(from: Date())
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.lockedNodeIds = lockedNodeIds
        self.allowedFilePaths = allowedFilePaths
        self.frozenBoundaryPorts = frozenBoundaryPorts
        self.forbiddenFilePaths = forbiddenFilePaths
        self.agentPrompt = agentPrompt
        self.createdAt = createdAt
    }
}

public struct ScopeValidationResult: Codable, Equatable {
    public var isCompliant: Bool
    public var violations: [String]
    public var allowedFiles: [String]
    public var modifiedFiles: [String]

    public init(
        isCompliant: Bool,
        violations: [String] = [],
        allowedFiles: [String] = [],
        modifiedFiles: [String] = []
    ) {
        self.isCompliant = isCompliant
        self.violations = violations
        self.allowedFiles = allowedFiles
        self.modifiedFiles = modifiedFiles
    }
}

public struct RetainCycleRisk: Codable, Equatable, Sendable {
    public var symbol: String
    public var line: Int
    public var description: String
    public var severity: String // "warning" | "critical"
    public var suggestion: String

    public init(
        symbol: String,
        line: Int,
        description: String,
        severity: String = "warning",
        suggestion: String
    ) {
        self.symbol = symbol
        self.line = line
        self.description = description
        self.severity = severity
        self.suggestion = suggestion
    }
}

public struct NodePerfMeta: Codable, Equatable, Sendable {
    public var retainCycleRisks: [RetainCycleRisk]
    public var estimatedMemoryMb: Double?
    public var cpuTimeMs: Double?

    public init(
        retainCycleRisks: [RetainCycleRisk] = [],
        estimatedMemoryMb: Double? = nil,
        cpuTimeMs: Double? = nil
    ) {
        self.retainCycleRisks = retainCycleRisks
        self.estimatedMemoryMb = estimatedMemoryMb
        self.cpuTimeMs = cpuTimeMs
    }
}

public struct EdgePerfMeta: Codable, Equatable, Sendable {
    public var averageLatencyMs: Double?
    public var isCriticalPath: Bool?

    public init(
        averageLatencyMs: Double? = nil,
        isCriticalPath: Bool? = nil
    ) {
        self.averageLatencyMs = averageLatencyMs
        self.isCriticalPath = isCriticalPath
    }
}

