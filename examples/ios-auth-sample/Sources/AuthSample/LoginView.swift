import SwiftUI

@MainActor
public struct LoginView: View {
    @State private var viewModel: AuthViewModel
    @State private var inputEmail: String = ""
    @State private var inputPassword: String = ""

    public init(viewModel: AuthViewModel? = nil) {
        _viewModel = State(initialValue: viewModel ?? AuthViewModel())
    }

    public var body: some View {
        VStack(spacing: 16) {
            TextField("Email", text: $inputEmail)
                .textContentType(.emailAddress)

            SecureField("Password", text: $inputPassword)

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .foregroundStyle(.red)
            }

            Button {
                Task {
                    let credentials = Credentials(email: inputEmail, password: inputPassword)
                    await viewModel.login(credentials: credentials)
                }
            } label: {
                if viewModel.isLoading {
                    ProgressView()
                } else {
                    Text("Log In")
                }
            }
            .disabled(viewModel.isLoading)
        }
        .padding()
    }
}
