import Foundation

public protocol AuthServiceProtocol: Sendable {
    func authenticate(credentials: Credentials) async throws -> UserSession
}

public final class LiveAuthService: AuthServiceProtocol {
    public init() {}

    public func authenticate(credentials: Credentials) async throws -> UserSession {
        // Simulate network call
        if credentials.password == "wrongpass" {
            throw AuthError.invalidCredentials
        }
        return UserSession(
            userId: "user_mock_42",
            token: "jwt_mock_token_abc123",
            expiresAt: Date().addingTimeInterval(3600)
        )
    }
}
