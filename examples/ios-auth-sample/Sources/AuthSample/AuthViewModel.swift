import Foundation
import Observation

@Observable
@MainActor
public final class AuthViewModel {
    public var email: String = ""
    public var password: String = ""
    public var isLoading: Bool = false
    public var errorMessage: String? = nil
    public var activeSession: UserSession? = nil

    private let authService: AuthServiceProtocol
    private let tokenStorage: TokenStorageProtocol

    public init(
        authService: AuthServiceProtocol = LiveAuthService(),
        tokenStorage: TokenStorageProtocol = KeychainStorage()
    ) {
        self.authService = authService
        self.tokenStorage = tokenStorage
    }

    public func validate() -> Bool {
        if email.trimmingCharacters(in: .whitespaces).isEmpty || password.isEmpty {
            self.errorMessage = "Email and password cannot be empty."
            return false
        }
        if password.count < 6 {
            self.errorMessage = "Password must be at least 6 characters."
            return false
        }
        self.errorMessage = nil
        return true
    }

    public func login(credentials: Credentials) async {
        self.email = credentials.email
        self.password = credentials.password
        guard validate() else {
            return
        }

        self.isLoading = true
        self.errorMessage = nil

        do {
            let session = try await authService.authenticate(credentials: credentials)
            try await tokenStorage.save(token: session.token)
            self.activeSession = session
            self.isLoading = false
        } catch let error as AuthError {
            self.isLoading = false
            switch error {
            case .invalidCredentials:
                self.errorMessage = "Invalid email or password."
            case .emptyFields:
                self.errorMessage = "Fields cannot be empty."
            case .invalidPasswordLength(let min):
                self.errorMessage = "Password must be at least \(min) characters."
            case .networkError(let msg):
                self.errorMessage = "Network error: \(msg)"
            }
        } catch {
            self.isLoading = false
            self.errorMessage = "Unexpected error occurred."
        }
    }
}
