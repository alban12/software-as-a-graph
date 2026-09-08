import Foundation
import SaagCore

public struct GraphDiffResult: Codable {
    public var addedNodes: [String]
    public var removedNodes: [String]
    public var addedEdges: [String]
    public var removedEdges: [String]
    public var modifiedNodes: [String: [String]] // nodeId -> list of changes

    public var hasChanges: Bool {
        return !addedNodes.isEmpty || !removedNodes.isEmpty ||
               !addedEdges.isEmpty || !removedEdges.isEmpty ||
               !modifiedNodes.isEmpty
    }
}

public enum GraphDiffer {

    public static func diff(base: SaagGraph, head: SaagGraph) -> GraphDiffResult {
        var addedNodes: [String] = []
        var removedNodes: [String] = []
        var addedEdges: [String] = []
        var removedEdges: [String] = []
        var modifiedNodes: [String: [String]] = [:]

        // Check node additions and modifications
        for (nodeId, headNode) in head.nodes {
            if let baseNode = base.nodes[nodeId] {
                var changes: [String] = []
                if baseNode.name != headNode.name {
                    changes.append("Name changed from '\(baseNode.name)' to '\(headNode.name)'")
                }
                if baseNode.kind != headNode.kind {
                    changes.append("Kind changed from '\(baseNode.kind)' to '\(headNode.kind)'")
                }
                if baseNode.inputs.count != headNode.inputs.count {
                    changes.append("Inputs count changed (\(baseNode.inputs.count) -> \(headNode.inputs.count))")
                }
                if baseNode.outputs.count != headNode.outputs.count {
                    changes.append("Outputs count changed (\(baseNode.outputs.count) -> \(headNode.outputs.count))")
                }
                if !changes.isEmpty {
                    modifiedNodes[nodeId] = changes
                }
            } else {
                addedNodes.append(nodeId)
            }
        }

        // Check node removals
        for (nodeId, _) in base.nodes {
            if head.nodes[nodeId] == nil {
                removedNodes.append(nodeId)
            }
        }

        // Check edge additions
        for (edgeId, _) in head.edges {
            if base.edges[edgeId] == nil {
                addedEdges.append(edgeId)
            }
        }

        // Check edge removals
        for (edgeId, _) in base.edges {
            if head.edges[edgeId] == nil {
                removedEdges.append(edgeId)
            }
        }

        return GraphDiffResult(
            addedNodes: addedNodes,
            removedNodes: removedNodes,
            addedEdges: addedEdges,
            removedEdges: removedEdges,
            modifiedNodes: modifiedNodes
        )
    }
}
