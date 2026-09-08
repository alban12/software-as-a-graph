// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "extractor-swift",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "saag-swift", targets: ["SaagCLI"]),
        .library(name: "SaagCore", targets: ["SaagCore"]),
        .library(name: "SaagExtractor", targets: ["SaagExtractor"])
    ],
    dependencies: [],
    targets: [
        .target(
            name: "SaagCore",
            path: "Sources/SaagCore"
        ),
        .target(
            name: "SaagExtractor",
            dependencies: [
                "SaagCore"
            ],
            path: "Sources/SaagExtractor"
        ),
        .executableTarget(
            name: "SaagCLI",
            dependencies: [
                "SaagCore",
                "SaagExtractor"
            ],
            path: "Sources/SaagCLI"
        ),
        .testTarget(
            name: "SaagExtractorTests",
            dependencies: [
                "SaagCore",
                "SaagExtractor"
            ],
            path: "Tests/SaagExtractorTests"
        )
    ]
)
