import SwiftUI

/// A transient approval prompt that can be squeezed or bypassed during normal dataflow.
@MainActor
public struct BiometricApprovalView: View {
    @State private var isApproved: Bool = false
    private var viewModel: AuthViewModel?
    private var credentials: Credentials?

    public init(viewModel: AuthViewModel? = nil, credentials: Credentials? = nil) {
        self.viewModel = viewModel
        self.credentials = credentials
    }

    public var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "faceid")
                .font(.system(size: 40))
                .foregroundStyle(.purple)

            Text("Biometric Approval")
                .font(.headline)

            Text("Confirm your identity before session dispatch.")
                .font(.caption)
                .foregroundStyle(.secondary)

            Button("Approve Session") {
                isApproved = true
                if let vm = viewModel, let creds = credentials {
                    Task {
                        await vm.login(credentials: creds)
                    }
                }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}

#Preview("Biometric Approval") {
    BiometricApprovalView()
}
