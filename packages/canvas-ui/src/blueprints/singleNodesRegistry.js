/**
 * Single Node Templates Registry
 * 
 * Curated catalog of individual architectural building blocks that can be
 * dragged directly onto the SaaG canvas across iOS Native, Autonomous Agents,
 * and Machine Learning domains.
 */

export const SINGLE_NODE_TEMPLATES = [
  // ==========================================
  // iOS / Native Clean Architecture
  // ==========================================
  {
    id: 'template_ios_view',
    name: 'CustomScreenView',
    kind: 'view',
    level: 'L1_SCREEN',
    domain: 'ios',
    icon: '📱',
    badge: 'iOS View',
    description: 'SwiftUI Screen View with interactive UI elements and event bindings.',
    tags: ['view', 'swiftui', 'screen', 'ios', 'ui'],
    sourceFile: 'Views/CustomScreenView.swift',
    viewElements: [
      { id: 'btn_action', type: 'Button', label: 'Action Button', startLine: 15, endLine: 18 },
      { id: 'txt_heading', type: 'Text', label: 'Screen Title', startLine: 12, endLine: 13 }
    ],
    inputs: [{ id: 'in_state', label: 'StateInput', type: 'ViewState' }],
    outputs: [{ id: 'out_user_action', label: 'UserAction', type: 'UserAction' }],
    codeTemplate: `import SwiftUI

public struct CustomScreenView: View {
    @State private var title: String = "Welcome Screen"

    public init() {}

    public var body: some View {
        VStack(spacing: 16) {
            Text(title)
                .font(.headline)
            Button("Action Button") {
                print("Action tapped")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}
`
  },
  {
    id: 'template_ios_viewmodel',
    name: 'CustomViewModel',
    kind: 'viewModel',
    level: 'L1_SYSTEM',
    domain: 'ios',
    icon: '🧩',
    badge: 'iOS State',
    description: 'Observable state manager coordinating between Views and Services.',
    tags: ['viewmodel', 'state', 'observable', 'ios', 'clean architecture'],
    sourceFile: 'ViewModels/CustomViewModel.swift',
    properties: [
      { name: 'isLoading', type: 'Bool' },
      { name: 'errorMessage', type: 'String?' }
    ],
    methods: [
      { name: 'loadData()', returnType: 'Task<Void, Error>' }
    ],
    inputs: [{ id: 'in_action', label: 'ActionInput', type: 'UserAction' }],
    outputs: [{ id: 'out_service_call', label: 'ServiceCall', type: 'Request' }],
    codeTemplate: `import Foundation
import Combine

@MainActor
public class CustomViewModel: ObservableObject {
    @Published public var isLoading: Bool = false
    @Published public var errorMessage: String? = nil

    public init() {}

    public func loadData() async {
        isLoading = true
        defer { isLoading = false }
        // Fetch data from service
    }
}
`
  },
  {
    id: 'template_ios_service',
    name: 'CustomAPIService',
    kind: 'service',
    level: 'L1_SYSTEM',
    domain: 'ios',
    icon: '⚡',
    badge: 'iOS Service',
    description: 'Async business logic & remote API client conforming to interface contract.',
    tags: ['service', 'api', 'network', 'ios', 'async'],
    sourceFile: 'Services/CustomAPIService.swift',
    properties: [
      { name: 'endpoint', type: 'URL' }
    ],
    methods: [
      { name: 'fetch()', returnType: 'Task<Data, Error>' }
    ],
    inputs: [{ id: 'in_req', label: 'Request', type: 'Request' }],
    outputs: [{ id: 'out_resp', label: 'Response', type: 'Response' }],
    codeTemplate: `import Foundation

public class CustomAPIService {
    public let endpoint: URL

    public init(endpoint: URL = URL(string: "https://api.example.com")!) {
        self.endpoint = endpoint
    }

    public func fetch() async throws -> Data {
        let (data, _) = try await URLSession.shared.data(from: endpoint)
        return data
    }
}
`
  },
  {
    id: 'template_ios_repository',
    name: 'LocalDataRepository',
    kind: 'repository',
    level: 'L2_SUBSYSTEM',
    domain: 'ios',
    icon: '💾',
    badge: 'iOS Storage',
    description: 'Offline storage layer with SwiftData / CoreData cache persistence.',
    tags: ['repository', 'database', 'cache', 'swiftdata', 'storage'],
    sourceFile: 'Repositories/LocalDataRepository.swift',
    properties: [
      { name: 'isCacheValid', type: 'Bool' }
    ],
    methods: [
      { name: 'saveRecord()', returnType: 'Void' },
      { name: 'getRecord()', returnType: 'Record?' }
    ],
    inputs: [{ id: 'in_save', label: 'SaveRecord', type: 'Record' }],
    outputs: [{ id: 'out_cached', label: 'CachedData', type: 'Record?' }],
    codeTemplate: `import Foundation

public class LocalDataRepository {
    private var cache = [String: Any]()

    public init() {}

    public func save(key: String, value: Any) {
        cache[key] = value
    }

    public func get(key: String) -> Any? {
        return cache[key]
    }
}
`
  },

  // ==========================================
  // Autonomous Agent Architecture
  // ==========================================
  {
    id: 'template_agent_worker',
    name: 'AutonomousWorkerAgent',
    kind: 'agent',
    level: 'L1_SYSTEM',
    domain: 'agents',
    icon: '🤖',
    badge: 'Agent Node',
    description: 'LLM reasoning agent equipped with tool execution loop and state memory.',
    tags: ['agent', 'worker', 'reasoning', 'autonomous', 'swarm'],
    sourceFile: 'benchmarks/Agents/worker_agent.py',
    inputs: [{ id: 'in_task', label: 'TaskSpec', type: 'TaskSpec' }],
    outputs: [{ id: 'out_result', label: 'ExecutionResult', type: 'ExecutionResult' }],
    codeTemplate: `class AutonomousWorkerAgent:
    def __init__(self, role: str = "Developer"):
        self.role = role

    def execute_task(self, task: dict) -> dict:
        return {"status": "completed", "result": f"Executed by {self.role}"}
`
  },
  {
    id: 'template_agent_tool',
    name: 'CodeExecutionTool',
    kind: 'tool',
    level: 'L2_SUBSYSTEM',
    domain: 'agents',
    icon: '🔧',
    badge: 'Agent Tool',
    description: 'Sandboxed deterministic tool executed by LLM agents via function calling.',
    tags: ['tool', 'execution', 'sandbox', 'agents'],
    sourceFile: 'benchmarks/Agents/tools.py',
    inputs: [{ id: 'in_args', label: 'ToolArguments', type: 'ToolCall' }],
    outputs: [{ id: 'out_payload', label: 'ToolResult', type: 'ToolOutput' }],
    codeTemplate: `def execute_sandboxed_code(command: str) -> dict:
    return {"exit_code": 0, "output": f"Executed {command}"}
`
  },
  {
    id: 'template_agent_router',
    name: 'TaskRouter',
    kind: 'router',
    level: 'L1_SCREEN',
    domain: 'agents',
    icon: '🔀',
    badge: 'Agent Router',
    description: 'Intent classifier routing tasks to specialized sub-agents based on context.',
    tags: ['router', 'intent', 'dispatcher', 'agents'],
    sourceFile: 'benchmarks/Agents/router.py',
    inputs: [{ id: 'in_user_prompt', label: 'UserPrompt', type: 'String' }],
    outputs: [{ id: 'out_routed_task', label: 'RoutedTask', type: 'TaskAssignment' }],
    codeTemplate: `class TaskRouter:
    def route(self, prompt: str) -> str:
        return "researcher" if "research" in prompt.lower() else "developer"
`
  },
  {
    id: 'template_agent_gate',
    name: 'ApprovalVerificationGate',
    kind: 'gate',
    level: 'L3_PRIMITIVE',
    domain: 'agents',
    icon: '🛡️',
    badge: 'Safety Gate',
    description: 'Human-in-the-loop validation barrier before critical mutations are committed.',
    tags: ['gate', 'safety', 'hitl', 'verification', 'agents'],
    sourceFile: 'benchmarks/Agents/approval_gate.py',
    inputs: [{ id: 'in_candidate_patch', label: 'ProposedPatch', type: 'Patch' }],
    outputs: [{ id: 'out_decision', label: 'ApprovalDecision', type: 'Bool' }],
    codeTemplate: `class ApprovalVerificationGate:
    def verify(self, patch: dict) -> bool:
        # Prompt user or verify safety constraints
        return True
`
  },

  // ==========================================
  // Machine Learning & Hardware Topologies
  // ==========================================
  {
    id: 'template_ml_preprocessor',
    name: 'FeatureTransformer',
    kind: 'preprocessor',
    level: 'L2_SUBSYSTEM',
    domain: 'ml',
    icon: '⚡',
    badge: 'ML Preprocess',
    description: 'GPU-accelerated cuDF feature transformation and tensor normalization stage.',
    tags: ['preprocessor', 'cudf', 'features', 'ml', 'pipeline'],
    sourceFile: 'benchmarks/ML/feature_transformer.py',
    inputs: [{ id: 'in_raw_df', label: 'RawData', type: 'cudf.DataFrame' }],
    outputs: [{ id: 'out_features', label: 'NormalizedFeatures', type: 'cudf.DataFrame' }],
    codeTemplate: `import cudf

class FeatureTransformer:
    def transform(self, df: cudf.DataFrame) -> cudf.DataFrame:
        return (df - df.mean()) / df.std()
`
  },
  {
    id: 'template_ml_model',
    name: 'NeuralNetModel',
    kind: 'model',
    level: 'L1_SYSTEM',
    domain: 'ml',
    icon: '🧠',
    badge: 'ML Model',
    description: 'PyTorch deep learning model with tracked parameter count and VRAM allocation.',
    tags: ['model', 'pytorch', 'neural net', 'vram', 'ml'],
    sourceFile: 'benchmarks/ML/neural_model.py',
    inputs: [{ id: 'in_batch', label: 'TensorBatch', type: 'torch.Tensor' }],
    outputs: [{ id: 'out_logits', label: 'Logits', type: 'torch.Tensor' }],
    codeTemplate: `import torch
import torch.nn as nn

class NeuralNetModel(nn.Module):
    def __init__(self, in_features=128, out_features=10):
        super().__init__()
        self.fc = nn.Linear(in_features, out_features)

    def forward(self, x):
        return self.fc(x)
`
  },
  {
    id: 'template_ml_dataset',
    name: 'ParquetDatasetLoader',
    kind: 'dataset',
    level: 'L1_SCREEN',
    domain: 'ml',
    icon: '📊',
    badge: 'ML Dataset',
    description: 'High-throughput NVMe columnar dataset with memory-mapped sharded batches.',
    tags: ['dataset', 'parquet', 'data', 'ml'],
    sourceFile: 'benchmarks/ML/dataset_loader.py',
    inputs: [{ id: 'in_path', label: 'StoragePath', type: 'Path' }],
    outputs: [{ id: 'out_raw_df', label: 'LoadedData', type: 'cudf.DataFrame' }],
    codeTemplate: `import cudf

def load_dataset(path: str) -> cudf.DataFrame:
    return cudf.read_parquet(path)
`
  },
  {
    id: 'template_ml_hardware',
    name: 'H100GPUCluster',
    kind: 'hardware',
    level: 'L3_EXECUTION',
    domain: 'ml',
    icon: '🖥️',
    badge: 'Hardware Host',
    description: '8x NVIDIA H100 80GB SXM5 cluster with 900 GB/s NVLink interconnect.',
    tags: ['hardware', 'gpu', 'h100', 'cluster', 'ml'],
    sourceFile: 'benchmarks/ML/cluster_config.py',
    inputs: [{ id: 'in_nvlink', label: 'InterconnectBus', type: 'NVLink4' }],
    outputs: [{ id: 'out_compute', label: 'CUDAStream', type: 'CUDA' }],
    codeTemplate: `# NVIDIA H100 SXM5 80GB Compute Topology
CLUSTER_SPECS = {
    "num_gpus": 8,
    "vram_per_gpu_gb": 80,
    "interconnect": "NVLink 4 (900 GB/s)",
    "fp8_tflops": 1979
}
`
  }
];
