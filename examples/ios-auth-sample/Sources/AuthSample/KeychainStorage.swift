import Foundation

public protocol TokenStorageProtocol: Sendable {
    func save(token: String) async throws
    func retrieve() async -> String?
    func clear() async throws
}

public actor KeychainStorage: TokenStorageProtocol {
    private var memoryStore: String?

    public init() {}

    public func save(token: String) async throws {
        self.memoryStore = token
    }

    public func retrieve() async -> String? {
        return self.memoryStore
    }

    public func clear() async throws {
        self.memoryStore = nil
    }
}
