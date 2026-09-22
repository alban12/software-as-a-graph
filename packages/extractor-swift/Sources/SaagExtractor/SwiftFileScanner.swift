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
    public var previewVariants: [PreviewVariant] = []
    public var viewElements: [ViewElement] = []

    public func toSaagNode() -> SaagNode {
        let nodeKind = determineNodeKind()
        let nodeId = "node_\(name.lowercased())"

        // Construct input ports (methods that can be called)
        var inputPorts = methods.map { method -> SaagPort in
            var p = method
            p.direction = "input"
            return p
        }

        // In SwiftUI, every view has an entry render lifecycle: body: some View
        if nodeKind == "view" && !inputPorts.contains(where: { $0.id == "\(nodeId)_in" }) {
            inputPorts.insert(SaagPort(
                id: "\(nodeId)_in",
                name: "body",
                typeAnnotation: "some View",
                direction: "input"
            ), at: 0)
        } else if nodeKind == "viewModel" && !inputPorts.contains(where: { $0.id == "\(nodeId)_in" }) {
            inputPorts.insert(SaagPort(
                id: "\(nodeId)_in",
                name: "mutateState",
                typeAnnotation: "Action<State>",
                direction: "input"
            ), at: 0)
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
        } else if nodeKind == "viewModel" || nodeKind == "service" || nodeKind == "repository" {
            outputPorts.append(SaagPort(
                id: "\(nodeId)_out_result",
                name: "onResult",
                typeAnnotation: "Result<Any, Error>",
                direction: "output"
            ))
            if nodeKind == "viewModel" {
                outputPorts.append(SaagPort(
                    id: "\(nodeId)_out_state",
                    name: "stateUpdate",
                    typeAnnotation: "ObservableState<\(name)>",
                    direction: "output"
                ))
            }
        }

        let anchor = SourceAnchor(
            filePath: relativePath,
            symbolPath: name,
            startLine: startLine,
            startColumn: 1,
            endLine: endLine,
            endColumn: 1
        )

        let preview: PreviewMeta? = (nodeKind == "view") ? PreviewMeta(
            hasPreview: true,
            previewKind: "device_frame",
            deviceFrame: "iphone-16-pro",
            variants: previewVariants.isEmpty ? [
                PreviewVariant(id: "default", name: "Default State"),
                PreviewVariant(id: "loading", name: "Loading State"),
                PreviewVariant(id: "error", name: "Validation Error State")
            ] : previewVariants
        ) : nil

        let isTransientNode = name.contains("Approval") || name.contains("Prompt") || name.contains("Guard") || name.contains("Biometric") || name.contains("Transient")
        let isSqueezedNode = isTransientNode ? true : nil

        let isFirebase = bodyContent.contains("Firebase") || bodyContent.contains("Firestore") || bodyContent.contains("Auth.auth()") || name.contains("Firebase") || name.contains("LiveAuth")
        let serviceMeta: ServiceMeta? = ((nodeKind == "service" || nodeKind == "repository") && isFirebase) ? ServiceMeta(
            serviceType: "firebase",
            provider: bodyContent.contains("Firestore") ? "Cloud Firestore" : "Firebase Authentication",
            projectRef: "authsample-dev",
            status: "online",
            consoleUrl: "https://console.firebase.google.com",
            collections: bodyContent.contains("reminders") ? ["reminders"] : ["users", "user_sessions", "audit_logs"],
            endpoints: ["identitytoolkit.googleapis.com", "firestore.googleapis.com"]
        ) : nil

        // Performance & Retain Cycle Analysis
        var retainRisks: [RetainCycleRisk] = []
        if declKind == "class" || name.hasSuffix("ViewModel") || name.hasSuffix("Service") {
            let detected = RetainCycleDetector.detectRisks(in: "class \(name) {\n\(bodyContent)\n}", filePath: relativePath)
            retainRisks = detected.map { r in
                RetainCycleRisk(
                    symbol: r.symbol,
                    line: r.line + startLine - 1,
                    description: r.description,
                    severity: r.severity,
                    suggestion: r.suggestion
                )
            }
        }

        let estimatedMem: Double = (nodeKind == "service") ? 14.2 : (nodeKind == "viewModel" ? 1.8 : 0.8)
        let estimatedCpu: Double = (nodeKind == "service") ? 44.0 : (nodeKind == "viewModel" ? 8.0 : 4.0)
        let perfMeta = NodePerfMeta(
            retainCycleRisks: retainRisks,
            estimatedMemoryMb: estimatedMem,
            cpuTimeMs: estimatedCpu
        )

        return SaagNode(
            id: nodeId,
            name: name,
            level: "L2_COMPONENT",
            kind: nodeKind,
            inputs: inputPorts,
            outputs: outputPorts,
            stateProps: properties.isEmpty ? nil : properties,
            viewElements: viewElements.isEmpty ? nil : viewElements,
            isTransient: isTransientNode ? true : nil,
            isSqueezed: isSqueezedNode,
            serviceMeta: serviceMeta,
            previewMeta: preview,
            sourceAnchor: anchor,
            perfMeta: perfMeta
        )
    }

    private func determineNodeKind() -> String {
        if conformances.contains("App") || name.hasSuffix("App") || attributes.contains("@main") {
            return "app"
        }
        if conformances.contains("View") || name.hasSuffix("View") || name.hasSuffix("Screen") {
            return "view"
        }
        if name.hasSuffix("Storage") || name.hasSuffix("Repository") || name.hasSuffix("Database") || conformances.contains(where: { $0.contains("Storage") }) || conformances.contains(where: { $0.contains("Repository") }) {
            return "repository"
        }
        if name.hasSuffix("Service") || name.hasSuffix("Client") || conformances.contains(where: { $0.contains("Service") }) {
            return "service"
        }
        if attributes.contains("@Observable") || conformances.contains("ObservableObject") || name.hasSuffix("ViewModel") || name.hasSuffix("Store") {
            return "viewModel"
        }
        return "service"
    }
}

public enum SwiftFileScanner {

    public static func parseFile(content: String, relativePath: String) -> [ParsedTypeDecl] {
        var results: [ParsedTypeDecl] = []
        let lines = content.components(separatedBy: .newlines)

        let typeRegex = try! NSRegularExpression(
            pattern: #"(@[A-Za-z0-9_()]+(?:\s+@[A-Za-z0-9_()]+)*\s+)?(public\s+|private\s+|fileprivate\s+|internal\s+|final\s+)*(struct|class|protocol|actor)\s+([A-Za-z0-9_]+)(?:<[^>]+>)?(?:\s*:\s*([^{]+))?\s*\{"#,
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

            // Skip common sub-models, preview providers, or internal test helpers
            if typeName == "Credentials" || typeName == "UserSession" || typeName == "AuthError" ||
               typeName.hasSuffix("_Previews") || typeName.hasSuffix("Previews") ||
               confStr.contains("PreviewProvider") || typeName.contains("PreviewProvider") {
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
            let previews = parsePreviews(in: content)
            let isView = conformances.contains("View") || typeName.hasSuffix("View") || typeName.hasSuffix("Screen")
            let viewElements = isView ? parseViewElements(in: lines, startLine: startLine, endLine: endLine) : []

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
                endLine: endLine,
                previewVariants: previews,
                viewElements: viewElements
            ))
        }

        return results
    }

    private static func parsePreviews(in content: String) -> [PreviewVariant] {
        var variants: [PreviewVariant] = []
        let previewRegex = try! NSRegularExpression(
            pattern: #"#Preview(?:\s*\(\s*"([^"]+)"\s*\))?\s*\{"#,
            options: []
        )
        let nsContent = content as NSString
        let matches = previewRegex.matches(in: content, range: NSRange(location: 0, length: nsContent.length))

        for (idx, match) in matches.enumerated() {
            let nameRange = match.range(at: 1)
            let name = nameRange.location != NSNotFound ? nsContent.substring(with: nameRange) : "Preview \(idx + 1)"
            let id = name.lowercased().replacingOccurrences(of: " ", with: "_")
            variants.append(PreviewVariant(id: id, name: name))
        }
        return variants
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
                var matchedMethod = false
                // Find matching method call
                for targetMethod in targetNode.inputs {
                    if targetMethod.name == "body" || targetMethod.name == "mutateState" {
                        continue
                    }
                    let methodNameOnly = targetMethod.name.components(separatedBy: "(").first ?? targetMethod.name
                    if !methodNameOnly.isEmpty && type.bodyContent.contains(methodNameOnly) {
                        matchedMethod = true
                        let edgeId = "edge_\(sourceNode.id)_to_\(targetNode.id)_\(methodNameOnly)"
                        let sourcePort = sourceNode.outputs.first?.id ?? "\(sourceNode.id)_out"

                        let edgeKind = (sourceNode.kind == "view") ? "eventEmit" : "call"
                        let mode = (targetMethod.isAsync == true) ? "async" : "sync"

                        let isCritical = targetNode.kind == "service" || targetNode.name.contains("Live") || targetNode.name.contains("AuthService")
                        let latency: Double = isCritical ? 380.0 : ((targetMethod.isAsync == true) ? 25.0 : 6.0)
                        let edgePerf = EdgePerfMeta(
                            averageLatencyMs: latency,
                            isCriticalPath: isCritical
                        )

                        let edge = SaagEdge(
                            id: edgeId,
                            sourceNodeId: sourceNode.id,
                            sourcePortId: sourcePort,
                            targetNodeId: targetNode.id,
                            targetPortId: targetMethod.id,
                            edgeKind: edgeKind,
                            executionMode: mode,
                            contract: EdgeContract(payloadType: targetMethod.typeAnnotation),
                            perfMeta: edgePerf
                        )
                        edges.append(edge)
                    }
                }

                if !matchedMethod && targetNode.kind == "view" {
                    let isNav = (type.bodyContent.contains("NavigationLink") && type.bodyContent.contains(targetName)) ||
                                (type.bodyContent.contains(".sheet") && type.bodyContent.contains(targetName)) ||
                                (type.bodyContent.contains(".fullScreenCover") && type.bodyContent.contains(targetName))
                    let edgeKind = isNav ? "navigation" : "composition"
                    let payloadType = isNav ? "\(targetNode.name) Presentation" : "\(targetNode.name) Subview"
                    let edgeId = "edge_\(sourceNode.id)_to_\(targetNode.id)"
                    let sourcePort = sourceNode.outputs.first?.id ?? "\(sourceNode.id)_out"
                    let targetPort = targetNode.inputs.first?.id ?? "\(targetNode.id)_in"
                    let edge = SaagEdge(
                        id: edgeId,
                        sourceNodeId: sourceNode.id,
                        sourcePortId: sourcePort,
                        targetNodeId: targetNode.id,
                        targetPortId: targetPort,
                        edgeKind: edgeKind,
                        executionMode: "sync",
                        contract: EdgeContract(payloadType: payloadType, guarantees: [isNav ? "NavigationStack" : "SwiftUIHierarchy"]),
                        perfMeta: EdgePerfMeta(averageLatencyMs: 0.0, isCriticalPath: false)
                    )
                    edges.append(edge)
                }

                // If target is a ViewModel / Observable Store (e.g. ModelData) referenced by this View:
                if !matchedMethod && targetNode.kind == "viewModel" && sourceNode.kind == "view" {
                    // 1. Reactive State Binding Edge: ViewModel updates drive View rendering
                    let stateEdgeId = "edge_\(targetNode.id)_to_\(sourceNode.id)_state"
                    let stateSourcePort = targetNode.outputs.first(where: { $0.id.contains("state") })?.id ?? (targetNode.outputs.first?.id ?? "\(targetNode.id)_out_state")
                    let stateTargetPort = sourceNode.inputs.first?.id ?? "\(sourceNode.id)_in"
                    let stateEdge = SaagEdge(
                        id: stateEdgeId,
                        sourceNodeId: targetNode.id,
                        sourcePortId: stateSourcePort,
                        targetNodeId: sourceNode.id,
                        targetPortId: stateTargetPort,
                        edgeKind: "stateBinding",
                        executionMode: "sync",
                        contract: EdgeContract(payloadType: "\(targetNode.name) State", guarantees: ["ObservableState", "MainActor"]),
                        perfMeta: EdgePerfMeta(averageLatencyMs: 1.2, isCriticalPath: true)
                    )
                    edges.append(stateEdge)

                    // 2. User Action / Mutation Edge: View actions mutate ViewModel state
                    if type.bodyContent.contains("\(lowerTargetName).") || type.bodyContent.contains("$\(lowerTargetName)") || type.bodyContent.contains("\(targetName)(") {
                        let actionEdgeId = "edge_\(sourceNode.id)_to_\(targetNode.id)_action"
                        let actionSourcePort = sourceNode.outputs.first?.id ?? "\(sourceNode.id)_out_user_action"
                        let actionTargetPort = targetNode.inputs.first?.id ?? "\(targetNode.id)_in"
                        let actionEdge = SaagEdge(
                            id: actionEdgeId,
                            sourceNodeId: sourceNode.id,
                            sourcePortId: actionSourcePort,
                            targetNodeId: targetNode.id,
                            targetPortId: actionTargetPort,
                            edgeKind: "eventEmit",
                            executionMode: "sync",
                            contract: EdgeContract(payloadType: "UserAction", guarantees: ["MainActor"]),
                            perfMeta: EdgePerfMeta(averageLatencyMs: 2.0, isCriticalPath: false)
                        )
                        edges.append(actionEdge)
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

    private static func parseViewElements(in lines: [String], startLine: Int, endLine: Int) -> [ViewElement] {
        var elements: [ViewElement] = []
        var elIndex = 1

        var inButton = false
        var buttonStartLine = 0
        var buttonAction: String? = nil
        var buttonLabel = ""

        for (zeroIdx, line) in lines.enumerated() {
            let lineNum = zeroIdx + 1
            guard lineNum >= startLine && lineNum <= endLine else { continue }
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            // TextField
            if let tfMatch = matchFirst(pattern: #"TextField\s*\(\s*"([^"]+)"\s*,\s*text:\s*([^)]+)\)"#, in: trimmed) {
                let label = tfMatch[1]
                let binding = tfMatch[2].trimmingCharacters(in: .whitespaces)
                elements.append(ViewElement(
                    id: "el_textfield_\(elIndex)",
                    type: "textField",
                    label: label,
                    binding: binding,
                    startLine: lineNum,
                    endLine: lineNum
                ))
                elIndex += 1
                continue
            }

            // SecureField
            if let sfMatch = matchFirst(pattern: #"SecureField\s*\(\s*"([^"]+)"\s*,\s*text:\s*([^)]+)\)"#, in: trimmed) {
                let label = sfMatch[1]
                let binding = sfMatch[2].trimmingCharacters(in: .whitespaces)
                elements.append(ViewElement(
                    id: "el_securefield_\(elIndex)",
                    type: "secureField",
                    label: label,
                    binding: binding,
                    startLine: lineNum,
                    endLine: lineNum
                ))
                elIndex += 1
                continue
            }

            // Button begin
            if trimmed.hasPrefix("Button") {
                inButton = true
                buttonStartLine = lineNum
                buttonAction = nil
                buttonLabel = ""
            }

            if inButton {
                if trimmed.contains("await ") {
                    if let callMatch = matchFirst(pattern: #"await\s+([A-Za-z0-9_.]+\s*\([^)]*\))"#, in: trimmed) {
                        buttonAction = callMatch[1]
                    }
                }
                if let textMatch = matchFirst(pattern: #"Text\s*\(\s*"([^"]+)"\s*\)"#, in: trimmed) {
                    buttonLabel = textMatch[1]
                }
                // Check if closing button
                if (trimmed == "}" || trimmed.hasPrefix("}.disabled") || trimmed.hasPrefix("} label:")) && !buttonLabel.isEmpty {
                    elements.append(ViewElement(
                        id: "el_button_\(elIndex)",
                        type: "button",
                        label: buttonLabel.isEmpty ? "Action" : buttonLabel,
                        action: buttonAction,
                        startLine: buttonStartLine,
                        endLine: lineNum
                    ))
                    elIndex += 1
                    inButton = false
                    continue
                }
            }

            // Standalone Text outside button
            if !inButton, let textMatch = matchFirst(pattern: #"Text\s*\(\s*(?:"([^"]+)"|([A-Za-z0-9_.]+))\s*\)"#, in: trimmed) {
                let textVal = !textMatch[1].isEmpty ? textMatch[1] : textMatch[2]
                elements.append(ViewElement(
                    id: "el_text_\(elIndex)",
                    type: "text",
                    label: textVal,
                    startLine: lineNum,
                    endLine: lineNum
                ))
                elIndex += 1
                continue
            }

            // ProgressView
            if !inButton, trimmed.contains("ProgressView()") {
                elements.append(ViewElement(
                    id: "el_progressview_\(elIndex)",
                    type: "progressView",
                    label: "Loading Indicator",
                    startLine: lineNum,
                    endLine: lineNum
                ))
                elIndex += 1
                continue
            }
        }

        return elements
    }

    private static func matchFirst(pattern: String, in text: String) -> [String]? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else { return nil }
        let nsText = text as NSString
        guard let match = regex.firstMatch(in: text, range: NSRange(location: 0, length: nsText.length)) else { return nil }
        var results: [String] = []
        for i in 0..<match.numberOfRanges {
            let r = match.range(at: i)
            if r.location != NSNotFound {
                results.append(nsText.substring(with: r))
            } else {
                results.append("")
            }
        }
        return results
    }
}
