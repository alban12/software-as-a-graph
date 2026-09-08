import Foundation
import SaagCore
import SaagExtractor

func printUsage() {
    print("""
    SaaG Swift Toolkit v1.0.0
    Commands:
      saag-swift extract --path <source-dir> [--project <name>] [--output <file>]
      saag-swift diff --base <graph-base.json> --head <graph-head.json>
      saag-swift generate-test --scenario <name> [--module <name>] [--output <file>]

    Options:
      --path        Directory of Swift codebase to extract
      --output      Target output file path
      --scenario    happy_path | validation_error | auth_error
      --module      Target Swift module name (default: AuthSample)
    """)
}

func main() {
    let args = CommandLine.arguments

    if args.contains("diff") {
        handleDiff(args: args)
        return
    }

    if args.contains("generate-test") {
        handleGenerateTest(args: args)
        return
    }

    if args.contains("extract") {
        handleExtract(args: args)
        return
    }

    printUsage()
    exit(1)
}

func handleExtract(args: [String]) {
    var pathIndex: Int?
    var projectIndex: Int?
    var outputIndex: Int?

    for (i, arg) in args.enumerated() {
        if arg == "--path" && i + 1 < args.count { pathIndex = i + 1 }
        if arg == "--project" && i + 1 < args.count { projectIndex = i + 1 }
        if arg == "--output" && i + 1 < args.count { outputIndex = i + 1 }
    }

    guard let pIdx = pathIndex else {
        print("Error: Missing required argument --path <source-directory>")
        printUsage()
        exit(1)
    }

    let rawPath = args[pIdx]
    let rootURL = URL(fileURLWithPath: rawPath).standardizedFileURL
    let projectName = projectIndex != nil ? args[projectIndex!] : rootURL.lastPathComponent
    let outputPath = outputIndex != nil ? args[outputIndex!] : rootURL.appendingPathComponent(".saag/graph.json").path

    print("🔎 Analyzing Swift codebase at: \(rootURL.path)")
    print("📦 Project Name: \(projectName)")

    let options = ExtractorOptions(
        projectName: projectName,
        rootPath: rootURL.path
    )

    let extractor = SwiftCodebaseExtractor(options: options)

    do {
        let graph = try extractor.extract()
        print("✅ Found \(graph.nodes.count) nodes and \(graph.edges.count) connecting edges.")

        for (_, node) in graph.nodes {
            print("   • [\(node.kind.uppercased())] \(node.name) (\(node.inputs.count) inputs, \(node.outputs.count) outputs)")
        }

        for (_, edge) in graph.edges {
            print("   -> Edge: \(edge.sourceNodeId) [\(edge.edgeKind)] => \(edge.targetNodeId)")
        }

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        let data = try encoder.encode(graph)

        let outputURL = URL(fileURLWithPath: outputPath)
        let dirURL = outputURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: dirURL, withIntermediateDirectories: true)
        try data.write(to: outputURL)

        print("💾 Graph exported successfully to: \(outputURL.path)")
    } catch {
        print("❌ Extraction failed: \(error)")
        exit(1)
    }
}

func handleDiff(args: [String]) {
    var baseIdx: Int?
    var headIdx: Int?

    for (i, arg) in args.enumerated() {
        if arg == "--base" && i + 1 < args.count { baseIdx = i + 1 }
        if arg == "--head" && i + 1 < args.count { headIdx = i + 1 }
    }

    guard let bIdx = baseIdx, let hIdx = headIdx else {
        print("Error: Missing --base or --head argument")
        exit(1)
    }

    do {
        let baseData = try Data(contentsOf: URL(fileURLWithPath: args[bIdx]))
        let headData = try Data(contentsOf: URL(fileURLWithPath: args[hIdx]))

        let decoder = JSONDecoder()
        let baseGraph = try decoder.decode(SaagGraph.self, from: baseData)
        let headGraph = try decoder.decode(SaagGraph.self, from: headData)

        let diff = GraphDiffer.diff(base: baseGraph, head: headGraph)

        print("📊 SaaG Architectural Diff:")
        if !diff.hasChanges {
            print("   ✨ No architectural changes detected.")
            return
        }

        if !diff.addedNodes.isEmpty {
            print("   ➕ Added Nodes (\(diff.addedNodes.count)):")
            for id in diff.addedNodes { print("      + \(id)") }
        }
        if !diff.removedNodes.isEmpty {
            print("   ➖ Removed Nodes (\(diff.removedNodes.count)):")
            for id in diff.removedNodes { print("      - \(id)") }
        }
        if !diff.addedEdges.isEmpty {
            print("   🔗 Added Edges (\(diff.addedEdges.count)):")
            for id in diff.addedEdges { print("      + \(id)") }
        }
        if !diff.removedEdges.isEmpty {
            print("   ✂️ Removed Edges (\(diff.removedEdges.count)):")
            for id in diff.removedEdges { print("      - \(id)") }
        }
        if !diff.modifiedNodes.isEmpty {
            print("   ⚡ Modified Nodes (\(diff.modifiedNodes.count)):")
            for (id, changes) in diff.modifiedNodes {
                print("      * \(id):")
                for c in changes { print("        • \(c)") }
            }
        }
    } catch {
        print("❌ Diff failed: \(error)")
        exit(1)
    }
}

func handleGenerateTest(args: [String]) {
    var scenarioIdx: Int?
    var outputIdx: Int?
    var moduleIdx: Int?

    for (i, arg) in args.enumerated() {
        if arg == "--scenario" && i + 1 < args.count { scenarioIdx = i + 1 }
        if arg == "--output" && i + 1 < args.count { outputIdx = i + 1 }
        if arg == "--module" && i + 1 < args.count { moduleIdx = i + 1 }
    }

    guard let sIdx = scenarioIdx else {
        print("Error: Missing required --scenario <name>")
        exit(1)
    }

    let scenario = args[sIdx]
    let module = moduleIdx != nil ? args[moduleIdx!] : "AuthSample"
    let testCode = TestGenerator.generateSwiftTest(for: scenario, moduleName: module)

    if let oIdx = outputIdx {
        let outputURL = URL(fileURLWithPath: args[oIdx])
        do {
            try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try testCode.write(to: outputURL, atomically: true, encoding: .utf8)
            print("✅ Swift Test generated successfully at: \(outputURL.path)")
        } catch {
            print("❌ Failed writing test: \(error)")
            exit(1)
        }
    } else {
        print(testCode)
    }
}

main()
