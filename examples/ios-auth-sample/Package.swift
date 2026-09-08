// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AuthSample",
    platforms: [
        .macOS(.v14),
        .iOS(.v17)
    ],
    products: [
        .library(name: "AuthSample", targets: ["AuthSample"])
    ],
    targets: [
        .target(
            name: "AuthSample",
            path: "Sources/AuthSample"
        ),
        .testTarget(
            name: "AuthSampleTests",
            dependencies: ["AuthSample"],
            path: "Tests/AuthSampleTests"
        )
    ]
)
