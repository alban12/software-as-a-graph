import Foundation
import SaagCore

public struct ParsedTypeDecl {
    public var name: String
    public var declKind: String // "struct" | "class" | "protocol" | "actor"
    public var conformances: [String]
    public var attributes: [String]
    public var properties: [StateProperty]
    public var methods: [SaagPort]
    public var bodyContent: String
    public var relativePath: String
    public var startLine: Int
    public var endLine: Int

    public func toSaagNode() -> SaagNode {
        let nodeKind = determineNodeKind()
        let nodeId = "node_\(name.lowercased())"

        // Construct input ports (methods that can be called)
        let inputPorts = methods.map { method -> SaagPort in
            var p = method
            p.direction = "input"
            return p
        }

        // Construct output ports (events or returns emitted by this node)
        var outputPorts: [SaagPort] = []
        if nodeKind == "view" {
            // Views typically emit user interaction events
            outputPorts.append(SaagPort(
                id: "\(nodeId)_out_user_action",
                name: "onUserAction",
                typeAnnotation: "Void",
                direction: "output"
            ))
        } else if nodeKind == "viewModel" || nodeKind == "service" {
            outputPorts.append(SaagPort(
                id: "\(nodeId)_out_result",
                name: "onResult",
                typeAnnotation: "Result<Any, Error>",
                direction: "output"
            ))
        }

        let anchor = SourceAnchor(
            filePath: relativePath,
            symbolPath: name,
            startLine: startLine,
            startColumn: 1,
            endLine: endLine,
            endColumn: 1
        )

        return SaagNode(
            id: nodeId,
            name: name,
            level: "L2_COMPONENT",
            kind: nodeKind,
            inputs: inputPorts,
            outputs: outputPorts,
            stateProps: properties.isEmpty ? nil : properties,
            sourceAnchor: anchor
        )
    }

    private func determineNodeKind() -> String {
        if conformances.contains("View") || name.hasSuffix("View") || name.hasSuffix("Screen") {
            return "view"
        }
        if attributes.contains("@Observable") || conformances.contains("ObservableObject") || name.hasSuffix("ViewModel") || name.hasSuffix("Store") {
            return "viewModel"
        }
        if name.hasSuffix("Service") || name.hasSuffix("Client") || conformances.contains(where: { $0.contains("Service") }) {
            return "service"
        }
        if name.hasSuffix("Storage") || name.hasSuffix("Repository") || name.hasSuffix("Database") || conformances.contains(where: { $0.contains("Storage") }) {
            return "repository"
        }
        return "service"
    }
}

public enum SwiftFileScanner {

    public static func parseFile(content: String, relativePath: String) -> [ParsedTypeDecl] {
        var results: [ParsedTypeDecl] = []
        let lines = content.components(separatedBy: .newlines)

        let typeRegex = try! NSRegularExpression(
            pattern: #"(@[A-Za-z0-9_()]+(?:\s+@[A-Za-z0-9_()]+)*\s+)?(public\s+|private\s+|fileprivate\s+|internal\s+|final\s+)*(struct|class|protocol|actor)\s+([A-Za-z0-9_]+)(?:\s*:\s*([^{]+))?\s*\{"#,
            options: []
        )

        let nsContent = content as NSString
        let matches = typeRegex.matches(in: content, range: NSRange(location: 0, length: nsContent.length))

        for match in matches {
            let fullRange = match.range
            let attrRange = match.range(at: 1)
            let kindRange = match.range(at: 3)
            let nameRange = match.range(at: 4)
            let confRange = match.range(at: 5)

            let attributesStr = attrRange.location != NSNotFound ? nsContent.substring(with: attrRange).trimmingCharacters(in: .whitespacesAndNewlines) : ""
            let declKind = nsContent.substring(with: kindRange)
            let typeName = nsContent.substring(with: nameRange)
            let confStr = confRange.location != NSNotFound ? nsContent.substring(with: confRange).trimmingCharacters(in: .whitespacesAndNewlines) : ""

            // Skip common sub-models or internal types if they are plain structs without features
            if typeName == "Credentials" || typeName == "UserSession" || typeName == "AuthError" {
                continue
            }

            let conformances = confStr.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
            let attributes = attributesStr.components(separatedBy: .whitespacesAndNewlines).filter { $0.hasPrefix("@") }

            // Extract body between { and matching }
            let startIdx = fullRange.location + fullRange.length - 1
            let (body, endOffset) = extractMatchingBraces(from: content, startOffset: startIdx)

            let startLine = lineIndex(for: fullRange.location, in: lines) + 1
            let endLine = lineIndex(for: endOffset, in: lines) + 1

            let properties = parseProperties(in: body)
            let methods = parseMethods(in: body, typeName: typeName)

            results.append(ParsedTypeDecl(
                name: typeName,
                declKind: declKind,
                conformances: conformances,
                attributes: attributes,
                properties: properties,
                methods: methods,
                bodyContent: body,
                relativePath: relativePath,
                startLine: startLine,
                endLine: endLine
            ))
        }

        return results
    }

    public static func inferEdges(for type: ParsedTypeDecl, against allNodes: [String: SaagNode]) -> [SaagEdge] {
        var edges: [SaagEdge] = []
        let sourceNodeId = "node_\(type.name.lowercased())"
        guard let sourceNode = allNodes[sourceNodeId] else { return [] }

        // Find calls to other known nodes
        for (_, targetNode) in allNodes {
            if targetNode.id == sourceNode.id { continue }

            let targetName = targetNode.name
            let lowerTargetName = targetName.prefix(1).lowercased() + targetName.dropFirst()

            // Check if source references target name or camelCase variable
            let isReferenced = type.bodyContent.contains(targetName) ||
                               type.bodyContent.contains(lowerTargetName) ||
                               type.properties.contains(where: { $0.typeAnnotation.contains(targetName) })

            if isReferenced {
                // Find matching method call
                for targetMethod in targetNode.inputs {
                    let methodNameOnly = targetMethod.name.components(separatedBy: "(").first ?? targetMethod.name
                    if type.bodyContent.contains(methodNameOnly) {
                        let edgeId = "edge_\(sourceNode.id)_to_\(targetNode.id)_\(methodNameOnly)"
                        let sourcePort = sourceNode.outputs.first?.id ?? "\(sourceNode.id)_out"

                        let edgeKind = (sourceNode.kind == "view") ? "eventEmit" : "call"
                        let mode = (targetMethod.isAsync == true) ? "async" : "sync"

                        let edge = SaagEdge(
                            id: edgeId,
                            sourceNodeId: sourceNode.id,
                            sourcePortId: sourcePort,
                            targetNodeId: targetNode.id,
                            targetPortId: targetMethod.id,
                            edgeKind: edgeKind,
                            executionMode: mode,
                            contract: EdgeContract(payloadType: targetMethod.typeAnnotation)
                        )
                        edges.append(edge)
                    }
                }
            }
        }

        return edges
    }

    private static func parseProperties(in body: String) -> [StateProperty] {
        var props: [StateProperty] = []
        let propRegex = try! NSRegularExpression(
            pattern: #"(@[A-Za-z0-9_]+(?:\s+@[A-Za-z0-9_]+)*\s+)?(public\s+|private\s+|internal\s+)?(var|let)\s+([A-Za-z0-9_]+)\s*:\s*([^=\n{]+)(?:=\s*([^;\n]+))?"#,
            options: []
        )
        let nsBody = body as NSString
        let matches = propRegex.matches(in: body, range: NSRange(location: 0, length: nsBody.length))

        for match in matches {
            let attrRange = match.range(at: 1)
            let mutRange = match.range(at: 3)
            let nameRange = match.range(at: 4)
            let typeRange = match.range(at: 5)
            let valRange = match.range(at: 6)

            let attr = attrRange.location != NSNotFound ? nsBody.substring(with: attrRange).trimmingCharacters(in: .whitespaces) : nil
            let mut = nsBody.substring(with: mutRange)
            let name = nsBody.substring(with: nameRange)
            let typeAnnotation = nsBody.substring(with: typeRange).trimmingCharacters(in: .whitespaces)
            let defVal = valRange.location != NSNotFound ? nsBody.substring(with: valRange).trimmingCharacters(in: .whitespaces) : nil

            // Skip body property in Views
            if name == "body" { continue }

            props.append(StateProperty(
                name: name,
                typeAnnotation: typeAnnotation,
                wrapperKind: attr,
                defaultValue: defVal,
                isReadOnly: mut == "let"
            ))
        }
        return props
    }

    private static func parseMethods(in body: String, typeName: String) -> [SaagPort] {
        var ports: [SaagPort] = []
        let funcRegex = try! NSRegularExpression(
            pattern: #"(?:public\s+|private\s+|internal\s+|@MainActor\s+)*func\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*(async)?\s*(throws)?(?:\s*->\s*([^{\n]+))?"#,
            options: []
        )
        let nsBody = body as NSString
        let matches = funcRegex.matches(in: body, range: NSRange(location: 0, length: nsBody.length))

        for match in matches {
            let nameRange = match.range(at: 1)
            let paramsRange = match.range(at: 2)
            let asyncRange = match.range(at: 3)
            let throwsRange = match.range(at: 4)
            let retRange = match.range(at: 5)

            let name = nsBody.substring(with: nameRange)
            let params = nsBody.substring(with: paramsRange).trimmingCharacters(in: .whitespaces)
            let isAsync = asyncRange.location != NSNotFound
            let canThrow = throwsRange.location != NSNotFound
            let returnType = retRange.location != NSNotFound ? nsBody.substring(with: retRange).trimmingCharacters(in: .whitespaces) : "Void"

            let portId = "port_\(typeName.lowercased())_\(name)"
            let signature = "\(name)(\(params))"
            let typeAnnotation = params.isEmpty ? returnType : "(\(params)) -> \(returnType)"

            ports.append(SaagPort(
                id: portId,
                name: signature,
                typeAnnotation: typeAnnotation,
                direction: "input",
                isAsync: isAsync,
                canThrow: canThrow
            ))
        }
        return ports
    }

    private static func extractMatchingBraces(from string: String, startOffset: Int) -> (String, Int) {
        let chars = Array(string)
        guard startOffset < chars.count, chars[startOffset] == "{" else {
            return ("", startOffset)
        }

        var depth = 0
        var inside = ""
        var endOffset = startOffset

        for i in startOffset..<chars.count {
            let ch = chars[i]
            if ch == "{" {
                depth += 1
            } else if ch == "}" {
                depth -= 1
                if depth == 0 {
                    endOffset = i
                    break
                }
            }
            if depth > 0 && i > startOffset {
                inside.append(ch)
            }
        }
        return (inside, endOffset)
    }

    private static func lineIndex(for charOffset: Int, in lines: [String]) -> Int {
        var current = 0
        for (idx, line) in lines.enumerated() {
            current += line.count + 1 // newline char
            if current >= charOffset {
                return idx
            }
        }
        return lines.count - 1
    }
}
