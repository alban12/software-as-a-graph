import Testing
@testable import AuthSample

@Suite("Auth Sample Verification")
struct AuthSampleTests {
    @Test("Validation fails when password is empty")
    @MainActor
    func validationFailsForEmptyPassword() async {
        let vm = AuthViewModel()
        vm.email = "test@example.com"
        vm.password = ""
        #expect(vm.validate() == false)
        #expect(vm.errorMessage == "Email and password cannot be empty.")
    }
}
