import Foundation
import SaagCore

public enum ScopeValidator {
    /// Generates an AgentWorkspace contract from a set of locked nodes in a graph.
    public static func generateScopeContract(
        for nodeIds: [String],
        in graph: SaagGraph,
        name: String = "Scoped Agent Workspace"
    ) -> AgentWorkspace {
        let lockedSet = Set(nodeIds)
        var allowedFiles = Set<String>()
        var allGraphFiles = Set<String>()

        for node in graph.nodes.values {
            if let path = node.sourceAnchor?.filePath {
                allGraphFiles.insert(path)
                if lockedSet.contains(node.id) {
                    allowedFiles.insert(path)
                }
            }
        }

        let forbiddenFiles = Array(allGraphFiles.subtracting(allowedFiles)).sorted()
        let allowedFilesList = Array(allowedFiles).sorted()

        var frozenPortsMap: [String: BoundaryPort] = [:]

        // Identify boundary edges crossing the scope perimeter
        for edge in graph.edges.values {
            let srcInScope = lockedSet.contains(edge.sourceNodeId)
            let tgtInScope = lockedSet.contains(edge.targetNodeId)

            guard srcInScope != tgtInScope else { continue } // either both in or both out

            let srcNode = graph.nodes[edge.sourceNodeId]
            let tgtNode = graph.nodes[edge.targetNodeId]

            if !srcInScope && tgtInScope {
                // Inbound boundary port
                if let tgt = tgtNode,
                   let port = tgt.inputs.first(where: { $0.id == edge.targetPortId }) {
                    let bp = BoundaryPort(
                        nodeId: tgt.id,
                        nodeName: tgt.name,
                        portId: port.id,
                        portName: port.name,
                        direction: "input",
                        typeAnnotation: port.typeAnnotation,
                        connectedToNodeId: srcNode?.id,
                        connectedToNodeName: srcNode?.name
                    )
                    frozenPortsMap[port.id] = bp
                }
            } else if srcInScope && !tgtInScope {
                // Outbound boundary port
                if let src = srcNode,
                   let port = src.outputs.first(where: { $0.id == edge.sourcePortId }) {
                    let bp = BoundaryPort(
                        nodeId: src.id,
                        nodeName: src.name,
                        portId: port.id,
                        portName: port.name,
                        direction: "output",
                        typeAnnotation: port.typeAnnotation,
                        connectedToNodeId: tgtNode?.id,
                        connectedToNodeName: tgtNode?.name
                    )
                    frozenPortsMap[port.id] = bp
                }
            }
        }

        let frozenPorts = Array(frozenPortsMap.values).sorted { $0.portName < $1.portName }

        let workspaceId = "scope_\(UUID().uuidString.prefix(8).lowercased())"
        var workspace = AgentWorkspace(
            id: workspaceId,
            name: name,
            description: "Agent scope locking \(nodeIds.count) nodes with \(frozenPorts.count) boundary contracts",
            lockedNodeIds: nodeIds,
            allowedFilePaths: allowedFilesList,
            frozenBoundaryPorts: frozenPorts,
            forbiddenFilePaths: forbiddenFiles
        )

        workspace.agentPrompt = formatAgentPrompt(for: workspace, graph: graph)
        return workspace
    }

    /// Formats an autonomous AI agent system prompt adhering to the scope boundaries.
    public static func formatAgentPrompt(for workspace: AgentWorkspace, graph: SaagGraph) -> String {
        let allowedList = workspace.allowedFilePaths.map { "- `\($0)`" }.joined(separator: "\n")
        let forbiddenList = workspace.forbiddenFilePaths.isEmpty
            ? "- None"
            : workspace.forbiddenFilePaths.map { "- `\($0)`" }.joined(separator: "\n")

        let lockedNodeNames = workspace.lockedNodeIds.compactMap { graph.nodes[$0]?.name }.joined(separator: ", ")

        var boundarySection = ""
        if workspace.frozenBoundaryPorts.isEmpty {
            boundarySection = "- No external boundary interfaces crossed."
        } else {
            boundarySection = workspace.frozenBoundaryPorts.map { bp in
                let dirIcon = bp.direction == "input" ? "📥 IN" : "📤 OUT"
                let peer = bp.connectedToNodeName != nil ? " (connected with \(bp.connectedToNodeName!))" : ""
                return "- **\(dirIcon)** `\(bp.nodeName).\(bp.portName)`: `\(bp.typeAnnotation)`\(peer) [IMMUTABLE]"
            }.joined(separator: "\n")
        }

        return """
        # Autonomous AI Agent Scoping Contract
        **Scope Name:** \(workspace.name)
        **Scope ID:** `\(workspace.id)`
        **Target Components:** \(lockedNodeNames)

        ## 1. Allowed Files (READ/WRITE PERMISSION GRANTED)
        You are STRICTLY authorized to inspect and modify ONLY the following files:
        \(allowedList)

        ## 2. Frozen Boundary Contracts (IMMUTABLE INTERFACES)
        The following socket signatures define external boundaries connecting to other architectural subsystems. You MUST NOT change method names, argument types, or return types for these interfaces:
        \(boundarySection)

        ## 3. Forbidden Files (ACCESS DENIED)
        Do NOT modify, delete, or rename any of the following files:
        \(forbiddenList)

        ## 4. Architectural Rules
        - Preserve all existing public contracts on boundary types.
        - Every code modification must satisfy `swift test`.
        - Any change to files outside Section 1 will trigger an immediate architectural scope violation.
        """
    }

    /// Validates a list of modified files against the active AgentWorkspace contract.
    public static func validateChanges(
        against scope: AgentWorkspace,
        changedFiles: [String]
    ) -> ScopeValidationResult {
        var violations: [String] = []
        let allowedSet = Set(scope.allowedFilePaths)

        for file in changedFiles {
            let normalized = file.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !normalized.isEmpty else { continue }

            // Check if modified file is explicitly allowed
            let isAllowed = allowedSet.contains { allowed in
                normalized == allowed || normalized.hasSuffix(allowed) || allowed.hasSuffix(normalized)
            }

            if !isAllowed {
                violations.append("Violation: File '\(normalized)' was modified but is outside the allowed agent scope.")
            }
        }

        return ScopeValidationResult(
            isCompliant: violations.isEmpty,
            violations: violations,
            allowedFiles: scope.allowedFilePaths,
            modifiedFiles: changedFiles
        )
    }
}
