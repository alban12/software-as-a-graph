import Foundation
import SaagCore

public enum RetainCycleDetector {
    /// Static analysis scanner that detects retain cycle risks (strong self captures in closures/Tasks)
    public static func detectRisks(in fileContent: String, filePath: String = "") -> [RetainCycleRisk] {
        var risks: [RetainCycleRisk] = []
        let lines = fileContent.components(separatedBy: .newlines)

        var currentClassName: String? = nil
        var insideClass = false
        var classBraceDepth = 0
        var insideClosure = false
        var closureStartLine = 0
        var closureHasWeakSelf = false
        var closureStrongSelfLines: [Int] = []
        var closureKind = "escaping closure"

        for (index, rawLine) in lines.enumerated() {
            let lineNumber = index + 1
            let line = rawLine.trimmingCharacters(in: .whitespaces)

            // Skip comments
            if line.hasPrefix("//") { continue }

            // Detect class declaration
            if line.contains("class ") && !line.contains("class func") {
                let parts = line.components(separatedBy: "class ")
                if parts.count > 1 {
                    let afterClass = parts[1].trimmingCharacters(in: .whitespaces)
                    let name = afterClass.components(separatedBy: CharacterSet.alphanumerics.inverted).first ?? "Class"
                    currentClassName = name
                    insideClass = true
                    classBraceDepth = 0
                }
            }

            guard insideClass else { continue }

            // Track braces for class scope
            let openBraces = line.filter { $0 == "{" }.count
            let closeBraces = line.filter { $0 == "}" }.count
            classBraceDepth += (openBraces - closeBraces)

            // Closure detection triggers
            let isNotificationObserver = line.contains("addObserver(") || line.contains("addObserver(forName:")
            let isDetachedTask = line.contains("Task.detached")
            let isDispatch = line.contains("DispatchQueue.main.asyncAfter") || line.contains("DispatchQueue.global().async")
            let isCombine = line.contains(".sink {") || line.contains(".subscribe {")
            let isClosureProperty = (line.contains("= {") || line.contains(": () ->") || line.contains("handler: {") || line.contains("completion: {")) && line.contains("{")

            if (isNotificationObserver || isDetachedTask || isDispatch || isCombine || isClosureProperty) && line.contains("{") {
                insideClosure = true
                closureStartLine = lineNumber
                closureHasWeakSelf = line.contains("[weak self]") || line.contains("[unowned self]")
                closureKind = isNotificationObserver ? "NotificationCenter observer" :
                              isDetachedTask ? "detached Task" :
                              isDispatch ? "asynchronous dispatch closure" :
                              isCombine ? "Combine subscriber closure" : "closure callback"
            } else if insideClosure && (line.contains("[weak self]") || line.contains("[unowned self]")) {
                closureHasWeakSelf = true
            }

            if insideClosure {
                if (line.contains("self.") || line.contains(" self ") || line.hasSuffix(" self") || line.hasPrefix("self.")) && !line.contains("[weak self]") && !line.contains("[unowned self]") {
                    closureStrongSelfLines.append(lineNumber)
                }
            }

            if insideClosure && closeBraces > 0 {
                if !closureHasWeakSelf && !closureStrongSelfLines.isEmpty {
                    let reportedLine = closureStrongSelfLines.first ?? closureStartLine
                    let symbolName = currentClassName ?? "Class"
                    risks.append(RetainCycleRisk(
                        symbol: "\(symbolName)",
                        line: reportedLine,
                        description: "Strong reference to 'self' inside \(closureKind) without [weak self]",
                        severity: "warning",
                        suggestion: "Add '[weak self]' to the capture list to prevent potential memory leaks."
                    ))
                }
                insideClosure = false
                closureStrongSelfLines.removeAll()
                closureHasWeakSelf = false
            }

            if classBraceDepth <= 0 {
                insideClass = false
                currentClassName = nil
            }
        }

        return risks
    }
}
