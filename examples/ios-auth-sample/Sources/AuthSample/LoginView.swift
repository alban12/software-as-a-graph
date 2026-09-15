import SwiftUI

@MainActor
public struct LoginView: View {
    @State private var viewModel: AuthViewModel
    @State private var inputEmail: String = ""
    @State private var inputPassword: String = ""
    @State private var showBiometricPrompt: Bool = false

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
                showBiometricPrompt = true
            } label: {
                if viewModel.isLoading {
                    ProgressView()
                } else {
                    Text("Sign In")
                }
            }
            .disabled(viewModel.isLoading)
        }
        .padding()
        .sheet(isPresented: $showBiometricPrompt) {
            BiometricApprovalView(
                viewModel: viewModel,
                credentials: Credentials(email: inputEmail, password: inputPassword)
            )
        }
    }
}

#Preview("Default State") {
    LoginView()
}

#Preview("Error State") {
    let vm = AuthViewModel()
    vm.errorMessage = "Password must be at least 6 characters."
    return LoginView(viewModel: vm)
}

