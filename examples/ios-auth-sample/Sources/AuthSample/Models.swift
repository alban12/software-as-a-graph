import Foundation

public struct Credentials: Equatable, Sendable, Codable {
    public let email: String
    public let password: String

    public init(email: String, password: String) {
        self.email = email
        self.password = password
    }
}

public struct UserSession: Equatable, Sendable, Codable {
    public let userId: String
    public let token: String
    public let expiresAt: Date

    public init(userId: String, token: String, expiresAt: Date) {
        self.userId = userId
        self.token = token
        self.expiresAt = expiresAt
    }
}

public enum AuthError: Error, Equatable, Sendable {
    case emptyFields
    case invalidPasswordLength(min: Int)
    case invalidCredentials
    case networkError(String)
}
