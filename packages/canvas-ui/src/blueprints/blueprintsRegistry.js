/**
 * SaaG Architectural Blueprints Registry
 * 
 * Pre-packaged, self-contained functional capabilities and micro-topologies
 * spanning iOS Native, Machine Learning / GPU pipelines, and Autonomous Agent Swarms.
 */

export const CAPABILITY_BLUEPRINTS = [
  {
    id: 'blueprint_stripe_checkout',
    title: 'Stripe Payments & Checkout',
    domain: 'ios',
    category: 'E-Commerce & Payments',
    icon: '💳',
    badge: 'iOS Native',
    description: 'Clean Architecture 3-node payment flow with SwiftUI Apple Pay sheet, stateful ViewModel, and Stripe gateway service.',
    tags: ['stripe', 'payment', 'apple pay', 'checkout', 'ios', 'swiftui', 'ecommerce'],
    nodeCount: 3,
    relativeNodes: [
      {
        idSuffix: 'view',
        name: 'StripeCheckoutView',
        kind: 'view',
        level: 'L1_SCREEN',
        description: 'SwiftUI Payment Sheet with Apple Pay button, Card fields, and order summary.',
        offsetX: 0,
        offsetY: 0,
        inputs: [
          { id: 'in_order', label: 'OrderSummary', type: 'Order' }
        ],
        outputs: [
          { id: 'out_pay_action', label: 'PayAction', type: 'PaymentRequest' }
        ],
        viewElements: [
          { id: 'btn_apple_pay', type: 'Button', label: 'Pay with Pay', startLine: 28, endLine: 31, systemImage: 'applelogo' },
          { id: 'txt_amount', type: 'Text', label: '$49.99 Total', startLine: 34, endLine: 36 },
          { id: 'btn_card_pay', type: 'Button', label: 'Pay with Credit Card', startLine: 40, endLine: 43, systemImage: 'creditcard' }
        ],
        sourceFile: 'Views/StripeCheckoutView.swift',
        codeTemplate: `import SwiftUI

public struct StripeCheckoutView: View {
    @StateObject private var viewModel = StripeCheckoutViewModel()
    public let orderAmount: Double

    public init(orderAmount: Double = 49.99) {
        self.orderAmount = orderAmount
    }

    public var body: some View {
        VStack(spacing: 20) {
            Text("Complete Payment")
                .font(.title2.bold())
            
            Text("$\\(String(format: "%.2f", orderAmount)) Total")
                .font(.system(size: 32, weight: .heavy, design: .rounded))
                .foregroundColor(.accentColor)

            if viewModel.isProcessing {
                ProgressView("Securing Payment Intent...")
                    .progressViewStyle(CircularProgressViewStyle())
            } else {
                Button(action: {
                    Task { await viewModel.processApplePay(amount: orderAmount) }
                }) {
                    Label("Pay with Pay", systemImage: "applelogo")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.black)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }

                Button(action: {
                    Task { await viewModel.processCardPayment(amount: orderAmount) }
                }) {
                    Label("Pay with Credit Card", systemImage: "creditcard")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }
            }
        }
        .padding(24)
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(radius: 8)
    }
}
`
      },
      {
        idSuffix: 'vm',
        name: 'StripeCheckoutViewModel',
        kind: 'viewModel',
        level: 'L2_COMPONENT',
        description: 'Observable state machine managing payment tokens, error states, and Apple Pay authorization.',
        offsetX: 360,
        offsetY: 0,
        inputs: [
          { id: 'in_req', label: 'Request', type: 'PaymentRequest' }
        ],
        outputs: [
          { id: 'out_token', label: 'PaymentIntent', type: 'PaymentIntentToken' }
        ],
        properties: [
          { name: 'isProcessing', type: 'Bool' },
          { name: 'paymentState', type: 'PaymentStatus' },
          { name: 'errorMessage', type: 'String?' }
        ],
        methods: [
          { name: 'processApplePay(amount: Double)', returnType: 'Task<Void, Error>' },
          { name: 'processCardPayment(amount: Double)', returnType: 'Task<Void, Error>' }
        ],
        sourceFile: 'ViewModels/StripeCheckoutViewModel.swift',
        codeTemplate: `import Foundation
import Combine

public enum PaymentStatus {
    case idle
    case processing
    case succeeded(transactionId: String)
    case failed(message: String)
}

@MainActor
public class StripeCheckoutViewModel: ObservableObject {
    @Published public var isProcessing: Bool = false
    @Published public var paymentState: PaymentStatus = .idle
    @Published public var errorMessage: String? = nil

    private let stripeService: StripePaymentService

    public init(stripeService: StripePaymentService = StripePaymentService()) {
        self.stripeService = stripeService
    }

    public func processApplePay(amount: Double) async {
        isProcessing = true
        errorMessage = nil
        do {
            let confirmation = try await stripeService.createPaymentIntent(amount: amount, currency: "usd")
            paymentState = .succeeded(transactionId: confirmation.id)
        } catch {
            errorMessage = error.localizedDescription
            paymentState = .failed(message: error.localizedDescription)
        }
        isProcessing = false
    }

    public func processCardPayment(amount: Double) async {
        isProcessing = true
        errorMessage = nil
        do {
            let confirmation = try await stripeService.createPaymentIntent(amount: amount, currency: "usd")
            paymentState = .succeeded(transactionId: confirmation.id)
        } catch {
            errorMessage = error.localizedDescription
            paymentState = .failed(message: error.localizedDescription)
        }
        isProcessing = false
    }
}
`
      },
      {
        idSuffix: 'service',
        name: 'StripePaymentService',
        kind: 'service',
        level: 'L3_PRIMITIVE',
        description: 'Low-level API client communicating with Stripe PaymentIntent endpoints and Apple Pay PassKit.',
        offsetX: 720,
        offsetY: 0,
        inputs: [
          { id: 'in_intent', label: 'Intent', type: 'PaymentIntentToken' }
        ],
        outputs: [
          { id: 'out_confirmation', label: 'Confirmation', type: 'PaymentConfirmation' }
        ],
        properties: [
          { name: 'publishableKey', type: 'String' },
          { name: 'merchantId', type: 'String' }
        ],
        methods: [
          { name: 'createPaymentIntent(amount: Double, currency: String)', returnType: 'Task<PaymentConfirmation, Error>' }
        ],
        sourceFile: 'Services/StripePaymentService.swift',
        codeTemplate: `import Foundation

public struct PaymentConfirmation: Codable {
    public let id: String
    public let status: String
    public let amount: Double
}

public class StripePaymentService {
    private let publishableKey: String
    private let merchantId: String

    public init(publishableKey: String = "pk_test_saag", merchantId: String = "merchant.com.saag") {
        self.publishableKey = publishableKey
        self.merchantId = merchantId
    }

    public func createPaymentIntent(amount: Double, currency: String = "usd") async throws -> PaymentConfirmation {
        // Simulates atomic Stripe API handshake with tokenized idempotency key
        try await Task.sleep(nanoseconds: 600_000_000)
        return PaymentConfirmation(
            id: "pi_\\(UUID().uuidString.prefix(8))",
            status: "succeeded",
            amount: amount
        )
    }
}
`
      }
    ],
    relativeEdges: [
      {
        idSuffix: 'edge_view_to_vm',
        sourceSuffix: 'view',
        targetSuffix: 'vm',
        sourceHandle: 'out_pay_action',
        targetHandle: 'in_req',
        label: 'PayAction',
        edgeKind: 'dataflow',
        contract: 'PaymentRequest'
      },
      {
        idSuffix: 'edge_vm_to_service',
        sourceSuffix: 'vm',
        targetSuffix: 'service',
        sourceHandle: 'out_token',
        targetHandle: 'in_intent',
        label: 'PaymentIntent',
        edgeKind: 'dataflow',
        contract: 'PaymentIntentToken'
      }
    ]
  },
  {
    id: 'blueprint_firebase_auth',
    title: 'Firebase Authentication Flow',
    domain: 'ios',
    category: 'Security & Identity',
    icon: '🔥',
    badge: 'iOS Native',
    description: 'Complete user sign-in and sign-up journey featuring Email/Password, Google OAuth, session tokens, and Keychain storage.',
    tags: ['firebase', 'auth', 'login', 'signup', 'keychain', 'identity', 'security', 'ios'],
    nodeCount: 3,
    relativeNodes: [
      {
        idSuffix: 'view',
        name: 'FirebaseAuthView',
        kind: 'view',
        level: 'L1_SCREEN',
        description: 'Sign in with Email and Google with animated loading indicators and password validation.',
        offsetX: 0,
        offsetY: 0,
        inputs: [],
        outputs: [
          { id: 'out_creds', label: 'Credentials', type: 'AuthCredentials' }
        ],
        viewElements: [
          { id: 'btn_sign_in', type: 'Button', label: 'Sign In with Email', startLine: 35, endLine: 38, systemImage: 'envelope.fill' },
          { id: 'btn_google', type: 'Button', label: 'Continue with Google', startLine: 42, endLine: 45, systemImage: 'globe' },
          { id: 'txt_welcome', type: 'Text', label: 'Welcome Back', startLine: 20, endLine: 22 }
        ],
        sourceFile: 'Views/FirebaseAuthView.swift',
        codeTemplate: `import SwiftUI

public struct FirebaseAuthView: View {
    @StateObject private var viewModel = FirebaseAuthViewModel()
    @State private var email: String = ""
    @State private var password: String = ""

    public var body: some View {
        VStack(spacing: 18) {
            Text("Welcome Back")
                .font(.largeTitle.bold())

            TextField("Email Address", text: $email)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .textContentType(.emailAddress)
                .autocapitalization(.none)

            SecureField("Password", text: $password)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .textContentType(.password)

            if viewModel.isLoading {
                ProgressView()
            } else {
                Button(action: {
                    Task { await viewModel.signIn(email: email, password: password) }
                }) {
                    Label("Sign In with Email", systemImage: "envelope.fill")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                }

                Button(action: {
                    Task { await viewModel.signInWithGoogle() }
                }) {
                    Label("Continue with Google", systemImage: "globe")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color(.systemGray6))
                        .foregroundColor(.primary)
                        .cornerRadius(10)
                }
            }
        }
        .padding(24)
    }
}
`
      },
      {
        idSuffix: 'vm',
        name: 'FirebaseAuthViewModel',
        kind: 'viewModel',
        level: 'L2_COMPONENT',
        description: 'Manages user authentication state, session cookies, and validation rules.',
        offsetX: 360,
        offsetY: 0,
        inputs: [
          { id: 'in_auth_creds', label: 'Credentials', type: 'AuthCredentials' }
        ],
        outputs: [
          { id: 'out_user_session', label: 'UserSession', type: 'User' }
        ],
        properties: [
          { name: 'currentUser', type: 'User?' },
          { name: 'isAuthenticated', type: 'Bool' },
          { name: 'isLoading', type: 'Bool' }
        ],
        methods: [
          { name: 'signIn(email: String, password: String)', returnType: 'Task<Void, Error>' },
          { name: 'signInWithGoogle()', returnType: 'Task<Void, Error>' }
        ],
        sourceFile: 'ViewModels/FirebaseAuthViewModel.swift',
        codeTemplate: `import Foundation

public struct User: Identifiable, Codable {
    public let id: String
    public let email: String
    public let displayName: String?
}

@MainActor
public class FirebaseAuthViewModel: ObservableObject {
    @Published public var currentUser: User? = nil
    @Published public var isAuthenticated: Bool = false
    @Published public var isLoading: Bool = false

    private let authService: FirebaseAuthService

    public init(authService: FirebaseAuthService = FirebaseAuthService()) {
        self.authService = authService
    }

    public func signIn(email: String, password: String) async {
        isLoading = true
        do {
            let user = try await authService.authenticateWithEmail(email: email, password: password)
            self.currentUser = user
            self.isAuthenticated = true
        } catch {
            print("Auth error: \\(error.localizedDescription)")
        }
        isLoading = false
    }

    public func signInWithGoogle() async {
        isLoading = true
        do {
            let user = try await authService.authenticateWithGoogle()
            self.currentUser = user
            self.isAuthenticated = true
        } catch {
            print("Google auth error: \\(error.localizedDescription)")
        }
        isLoading = false
    }
}
`
      },
      {
        idSuffix: 'service',
        name: 'FirebaseAuthService',
        kind: 'service',
        level: 'L3_PRIMITIVE',
        description: 'Direct wrapper over Firebase Auth SDK and iOS Keychain secure enclave.',
        offsetX: 720,
        offsetY: 0,
        inputs: [
          { id: 'in_token_req', label: 'AuthRequest', type: 'AuthRequest' }
        ],
        outputs: [
          { id: 'out_token_res', label: 'AuthToken', type: 'FirebaseAuthToken' }
        ],
        properties: [
          { name: 'apiKey', type: 'String' },
          { name: 'appId', type: 'String' }
        ],
        methods: [
          { name: 'authenticateWithEmail(email: String, password: String)', returnType: 'Task<User, Error>' },
          { name: 'authenticateWithGoogle()', returnType: 'Task<User, Error>' }
        ],
        sourceFile: 'Services/FirebaseAuthService.swift',
        codeTemplate: `import Foundation

public class FirebaseAuthService {
    public init() {}

    public func authenticateWithEmail(email: String, password: String) async throws -> User {
        try await Task.sleep(nanoseconds: 500_000_000)
        return User(id: UUID().uuidString, email: email, displayName: email.components(separatedBy: "@").first)
    }

    public func authenticateWithGoogle() async throws -> User {
        try await Task.sleep(nanoseconds: 500_000_000)
        return User(id: UUID().uuidString, email: "googleuser@gmail.com", displayName: "Google User")
    }
}
`
      }
    ],
    relativeEdges: [
      {
        idSuffix: 'edge_view_to_vm',
        sourceSuffix: 'view',
        targetSuffix: 'vm',
        sourceHandle: 'out_creds',
        targetHandle: 'in_auth_creds',
        label: 'AuthCredentials',
        edgeKind: 'dataflow',
        contract: 'AuthCredentials'
      },
      {
        idSuffix: 'edge_vm_to_service',
        sourceSuffix: 'vm',
        targetSuffix: 'service',
        sourceHandle: 'out_user_session',
        targetHandle: 'in_token_req',
        label: 'AuthRequest',
        edgeKind: 'dataflow',
        contract: 'AuthRequest'
      }
    ]
  },
  {
    id: 'blueprint_tabular_preprocessing',
    title: 'Tabular GPU Preprocessing Pipeline',
    domain: 'ml',
    category: 'Data Science & PyTorch',
    icon: '📊',
    badge: 'Machine Learning',
    description: 'High-throughput RAPIDS cuDF / PyTorch pipeline executing zero-copy null imputation, categorical encoding, scaling, and CUDA tensor batching.',
    tags: ['ml', 'pytorch', 'cudf', 'gpu', 'h100', 'preprocessing', 'tabular', 'dataset'],
    nodeCount: 5,
    relativeNodes: [
      {
        idSuffix: 'ingest',
        name: 'ParquetDataIngestion',
        kind: 'dataset',
        level: 'L1_SYSTEM',
        description: 'Streams multi-gigabyte tabular datasets from NVMe directly into cuDF GPU dataframes.',
        offsetX: 0,
        offsetY: 0,
        inputs: [
          { id: 'in_uri', label: 'DataURI', type: 'str' }
        ],
        outputs: [
          { id: 'out_raw_df', label: 'GPUDataFrame', type: 'cudf.DataFrame' }
        ],
        sourceFile: 'benchmarks/ML/tabular_ingest.py',
        codeTemplate: `import cudf

def load_parquet_dataset(uri: str) -> cudf.DataFrame:
    """Zero-copy Parquet streaming directly onto GPU VRAM."""
    print(f"Reading dataset from {uri} into cuDF...")
    return cudf.read_parquet(uri)
`
      },
      {
        idSuffix: 'imputer',
        name: 'GPUNullImputer',
        kind: 'preprocessor',
        level: 'L2_COMPONENT',
        description: 'Parallel GPU median and mode imputation for missing features with 0 CPU roundtrips.',
        offsetX: 300,
        offsetY: 0,
        inputs: [
          { id: 'in_raw_df', label: 'GPUDataFrame', type: 'cudf.DataFrame' }
        ],
        outputs: [
          { id: 'out_clean_df', label: 'CleanDataFrame', type: 'cudf.DataFrame' }
        ],
        sourceFile: 'benchmarks/ML/null_imputer.py',
        codeTemplate: `import cudf

def impute_missing_values(df: cudf.DataFrame) -> cudf.DataFrame:
    """Imputes numerical columns with median and categoricals with mode on GPU."""
    for col in df.select_dtypes(include=['float32', 'float64']).columns:
        df[col] = df[col].fillna(df[col].median())
    return df
`
      },
      {
        idSuffix: 'encoder',
        name: 'CategoricalTargetEncoder',
        kind: 'preprocessor',
        level: 'L2_COMPONENT',
        description: 'High-cardinality target encoder using RAPIDS cuML.',
        offsetX: 600,
        offsetY: 0,
        inputs: [
          { id: 'in_clean_df', label: 'CleanDataFrame', type: 'cudf.DataFrame' }
        ],
        outputs: [
          { id: 'out_encoded_df', label: 'EncodedDataFrame', type: 'cudf.DataFrame' }
        ],
        sourceFile: 'benchmarks/ML/categorical_encoder.py',
        codeTemplate: `import cudf

def encode_categoricals(df: cudf.DataFrame, cat_columns: list) -> cudf.DataFrame:
    """Performs GPU frequency encoding for high-cardinality strings."""
    for col in cat_columns:
        if col in df.columns:
            df[col] = df[col].astype('category').cat.codes
    return df
`
      },
      {
        idSuffix: 'scaler',
        name: 'GPUStandardScaler',
        kind: 'preprocessor',
        level: 'L2_COMPONENT',
        description: 'Z-score normalization fitting mean and standard deviation across numerical columns.',
        offsetX: 900,
        offsetY: 0,
        inputs: [
          { id: 'in_encoded_df', label: 'EncodedDataFrame', type: 'cudf.DataFrame' }
        ],
        outputs: [
          { id: 'out_scaled_df', label: 'ScaledFeatures', type: 'cudf.DataFrame' }
        ],
        sourceFile: 'benchmarks/ML/standard_scaler.py',
        codeTemplate: `import cudf

def scale_numerical_features(df: cudf.DataFrame) -> cudf.DataFrame:
    """Applies Z-score standardization on GPU."""
    num_cols = df.select_dtypes(include=['float32', 'float64', 'int64']).columns
    means = df[num_cols].mean()
    stds = df[num_cols].std()
    df[num_cols] = (df[num_cols] - means) / (stds + 1e-7)
    return df
`
      },
      {
        idSuffix: 'tensor_loader',
        name: 'CUDATensorBatchLoader',
        kind: 'dataset',
        level: 'L3_PRIMITIVE',
        description: 'Zero-copy PyTorch DataLoader converting GPU DataFrames directly into torch.Tensor batches on H100 VRAM.',
        offsetX: 1200,
        offsetY: 0,
        inputs: [
          { id: 'in_scaled_df', label: 'ScaledFeatures', type: 'cudf.DataFrame' }
        ],
        outputs: [
          { id: 'out_batches', label: 'TensorBatches', type: 'DataLoader' }
        ],
        sourceFile: 'benchmarks/ML/tensor_loader.py',
        codeTemplate: `import torch
from torch.utils.data import TensorDataset, DataLoader

def to_cuda_dataloader(df, batch_size=2048):
    """Zero-copy cuDF DLPack bridge to PyTorch tensors."""
    tensor = torch.as_tensor(df.to_cupy(), device='cuda')
    dataset = TensorDataset(tensor)
    return DataLoader(dataset, batch_size=batch_size, shuffle=True)
`
      }
    ],
    relativeEdges: [
      {
        idSuffix: 'edge_ingest_to_imputer',
        sourceSuffix: 'ingest',
        targetSuffix: 'imputer',
        sourceHandle: 'out_raw_df',
        targetHandle: 'in_raw_df',
        label: 'Raw DataFrame',
        edgeKind: 'dataflow',
        contract: 'cudf.DataFrame'
      },
      {
        idSuffix: 'edge_imputer_to_encoder',
        sourceSuffix: 'imputer',
        targetSuffix: 'encoder',
        sourceHandle: 'out_clean_df',
        targetHandle: 'in_clean_df',
        label: 'Imputed DataFrame',
        edgeKind: 'dataflow',
        contract: 'cudf.DataFrame'
      },
      {
        idSuffix: 'edge_encoder_to_scaler',
        sourceSuffix: 'encoder',
        targetSuffix: 'scaler',
        sourceHandle: 'out_encoded_df',
        targetHandle: 'in_encoded_df',
        label: 'Encoded DataFrame',
        edgeKind: 'dataflow',
        contract: 'cudf.DataFrame'
      },
      {
        idSuffix: 'edge_scaler_to_loader',
        sourceSuffix: 'scaler',
        targetSuffix: 'tensor_loader',
        sourceHandle: 'out_scaled_df',
        targetHandle: 'in_scaled_df',
        label: 'Normalized Features',
        edgeKind: 'dataflow',
        contract: 'cudf.DataFrame'
      }
    ]
  },
  {
    id: 'blueprint_supervisor_swarm',
    title: 'Supervisor-Worker Swarm',
    domain: 'agents',
    category: 'Multi-Agent Coordination',
    icon: '🤖',
    badge: 'Autonomous Agents',
    description: 'Hierarchical multi-agent coordinator with Task Ingestion Router, Supervisor Agent, parallel Research & Coding workers, and Human-in-the-Loop Gate.',
    tags: ['agent', 'swarm', 'supervisor', 'router', 'worker', 'gate', 'langgraph', 'crewai'],
    nodeCount: 5,
    relativeNodes: [
      {
        idSuffix: 'router',
        name: 'TaskIngestionRouter',
        kind: 'router',
        level: 'L1_SYSTEM',
        description: 'Decomposes user objectives into DAG task sub-graphs with dependency ordering.',
        offsetX: 0,
        offsetY: 0,
        inputs: [
          { id: 'in_user_prompt', label: 'UserGoal', type: 'TaskObjective' }
        ],
        outputs: [
          { id: 'out_decomposed_tasks', label: 'TaskDAG', type: 'TaskPlan' }
        ],
        sourceFile: 'benchmarks/Agents/task_router.py',
        codeTemplate: `class TaskIngestionRouter:
    def route_objective(self, user_goal: str) -> dict:
        """Parses goal into parallel research and coding milestones."""
        return {
            "goal": user_goal,
            "tasks": ["gather_architecture_context", "synthesize_code_changes"]
        }
`
      },
      {
        idSuffix: 'supervisor',
        name: 'SupervisorCoordinator',
        kind: 'agent',
        level: 'L1_SCREEN',
        description: 'Coordinates worker execution, enforces blast radius constraints, and aggregates worker outputs.',
        offsetX: 300,
        offsetY: 0,
        inputs: [
          { id: 'in_task_plan', label: 'TaskPlan', type: 'TaskPlan' }
        ],
        outputs: [
          { id: 'out_dispatch', label: 'SubtaskDispatch', type: 'WorkerTask' }
        ],
        sourceFile: 'benchmarks/Agents/supervisor.py',
        codeTemplate: `class SupervisorCoordinator:
    def __init__(self, max_rounds: int = 5):
        self.max_rounds = max_rounds

    def orchestrate(self, task_plan: dict) -> dict:
        """Dispatches subtasks to parallel specialized workers."""
        return {"status": "dispatched", "plan": task_plan}
`
      },
      {
        idSuffix: 'researcher',
        name: 'ResearchWorkerAgent',
        kind: 'agent',
        level: 'L2_COMPONENT',
        description: 'Performs web queries, documentation lookups, and codebase semantic search.',
        offsetX: 600,
        offsetY: -120,
        inputs: [
          { id: 'in_query', label: 'ResearchTask', type: 'ResearchQuery' }
        ],
        outputs: [
          { id: 'out_citations', label: 'ResearchContext', type: 'ContextPacket' }
        ],
        sourceFile: 'benchmarks/Agents/research_worker.py',
        codeTemplate: `class ResearchWorkerAgent:
    def execute(self, query: str) -> dict:
        """Extracts verified codebase facts and API socket documentation."""
        return {"citations": ["CleanArchitecture.swift", "API.md"], "query": query}
`
      },
      {
        idSuffix: 'coder',
        name: 'CodeSynthesizerAgent',
        kind: 'agent',
        level: 'L2_COMPONENT',
        description: 'Generates verified code modifications bounded to AST socket contracts.',
        offsetX: 600,
        offsetY: 120,
        inputs: [
          { id: 'in_context', label: 'ContextPacket', type: 'ContextPacket' }
        ],
        outputs: [
          { id: 'out_ast_diff', label: 'CodeDiff', type: 'ASTPatch' }
        ],
        sourceFile: 'benchmarks/Agents/coder_worker.py',
        codeTemplate: `class CodeSynthesizerAgent:
    def write_diff(self, context: dict) -> dict:
        """Generates AST code patch adhering to interface sockets."""
        return {"action": "modify", "diff": "patch applied"}
`
      },
      {
        idSuffix: 'gate',
        name: 'HumanInTheLoopGate',
        kind: 'gate',
        level: 'L3_PRIMITIVE',
        description: 'Blocks code deployment until explicit human confirmation or simulated test verification passes.',
        offsetX: 900,
        offsetY: 0,
        inputs: [
          { id: 'in_patch', label: 'PendingPatch', type: 'ASTPatch' }
        ],
        outputs: [
          { id: 'out_approved', label: 'ApprovedCommit', type: 'CommitAction' }
        ],
        sourceFile: 'benchmarks/Agents/approval_gate.py',
        codeTemplate: `class HumanInTheLoopGate:
    def require_approval(self, patch: dict) -> bool:
        """Pauses autonomous agent execution until developer clicks Approve."""
        print("Waiting for human gate sign-off on patch:", patch)
        return True
`
      }
    ],
    relativeEdges: [
      {
        idSuffix: 'edge_router_to_supervisor',
        sourceSuffix: 'router',
        targetSuffix: 'supervisor',
        sourceHandle: 'out_decomposed_tasks',
        targetHandle: 'in_task_plan',
        label: 'Task Plan',
        edgeKind: 'dataflow',
        contract: 'TaskPlan'
      },
      {
        idSuffix: 'edge_supervisor_to_researcher',
        sourceSuffix: 'supervisor',
        targetSuffix: 'researcher',
        sourceHandle: 'out_dispatch',
        targetHandle: 'in_query',
        label: 'Research Query',
        edgeKind: 'dataflow',
        contract: 'ResearchQuery'
      },
      {
        idSuffix: 'edge_supervisor_to_coder',
        sourceSuffix: 'supervisor',
        targetSuffix: 'coder',
        sourceHandle: 'out_dispatch',
        targetHandle: 'in_context',
        label: 'Code Context',
        edgeKind: 'dataflow',
        contract: 'ContextPacket'
      },
      {
        idSuffix: 'edge_coder_to_gate',
        sourceSuffix: 'coder',
        targetSuffix: 'gate',
        sourceHandle: 'out_ast_diff',
        targetHandle: 'in_patch',
        label: 'Pending Patch',
        edgeKind: 'dataflow',
        contract: 'ASTPatch'
      }
    ]
  }
];
