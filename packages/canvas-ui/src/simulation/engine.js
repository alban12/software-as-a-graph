/**
 * SaaG Dataflow Simulation Engine
 * Executes symbolic flow tracing, branch evaluation, and state mutation tracking
 * according to RFC-003.
 */

export const PRESET_SCENARIOS = [
  {
    id: 'happy_path',
    title: 'Happy Path: Valid Login',
    description: 'Valid credentials pass validation, network authentication succeeds, and token is persisted to Keychain.',
    startNodeId: 'node_loginview',
    startPortId: 'out_submit_tap',
    payload: {
      email: 'alban@example.com',
      password: 'password123'
    },
    traceGenerator: (graph) => generateHappyPathTrace(graph)
  },
  {
    id: 'validation_error',
    title: 'Validation Error: Short Password',
    description: 'Password is < 6 characters. Validation guard fails in AuthViewModel, halting the flow before reaching the network service.',
    startNodeId: 'node_loginview',
    startPortId: 'out_submit_tap',
    payload: {
      email: 'alban@example.com',
      password: '123'
    },
    traceGenerator: (graph) => generateValidationErrorTrace(graph)
  },
  {
    id: 'auth_error',
    title: 'Network Auth Failure: 401 Unauthorized',
    description: 'Valid format but invalid credentials. LiveAuthService throws AuthError.invalidCredentials; error handler mutates errorMessage state.',
    startNodeId: 'node_loginview',
    startPortId: 'out_submit_tap',
    payload: {
      email: 'alban@example.com',
      password: 'wrongpass'
    },
    traceGenerator: (graph) => generateAuthErrorTrace(graph)
  }
];

function generateHappyPathTrace(graph) {
  return [
    {
      stepIndex: 0,
      title: 'User Taps Login Button',
      activeNodeId: 'node_loginview',
      activeEdgeId: null,
      portId: 'node_loginview_out_user_action',
      status: 'success',
      payload: { email: 'alban@example.com', password: 'password123' },
      mutations: {
        node_loginview: { inputEmail: 'alban@example.com', inputPassword: '•••••••••••' }
      },
      explanation: 'User taps Submit button in LoginView. Form state is packaged into a Credentials struct and emitted.'
    },
    {
      stepIndex: 1,
      title: 'Dispatch to AuthViewModel',
      activeNodeId: 'node_authviewmodel',
      activeEdgeId: 'edge_node_loginview_to_node_authviewmodel_login',
      portId: 'port_authviewmodel_login',
      status: 'success',
      payload: { email: 'alban@example.com', password: 'password123' },
      mutations: {
        node_authviewmodel: { isLoading: true, errorMessage: null }
      },
      explanation: 'AuthViewModel.login(credentials:) receives payload. guard validate() passes. Sets isLoading = true.'
    },
    {
      stepIndex: 2,
      title: 'Async Call: AuthService.authenticate',
      activeNodeId: 'node_liveauthservice',
      activeEdgeId: 'edge_node_authviewmodel_to_node_liveauthservice_authenticate',
      portId: 'port_liveauthservice_authenticate',
      status: 'success',
      payload: { email: 'alban@example.com', password: 'password123' },
      mutations: {},
      explanation: 'LiveAuthService receives credentials over network call. Credentials validated, returns UserSession token.'
    },
    {
      stepIndex: 3,
      title: 'Save Token in KeychainStorage',
      activeNodeId: 'node_keychainstorage',
      activeEdgeId: 'edge_node_authviewmodel_to_node_keychainstorage_save',
      portId: 'port_keychainstorage_save',
      status: 'success',
      payload: { token: 'jwt_mock_token_abc123' },
      mutations: {
        node_keychainstorage: { memoryStore: 'jwt_mock_token_abc123' },
        node_authviewmodel: {
          isLoading: false,
          activeSession: { userId: 'user_mock_42', token: 'jwt_mock_token_abc123' }
        }
      },
      explanation: 'KeychainStorage.save(token:) securely persists JWT token. AuthViewModel updates activeSession and clears isLoading.'
    }
  ];
}

function generateValidationErrorTrace(graph) {
  return [
    {
      stepIndex: 0,
      title: 'User Taps Login Button',
      activeNodeId: 'node_loginview',
      activeEdgeId: null,
      portId: 'node_loginview_out_user_action',
      status: 'success',
      payload: { email: 'alban@example.com', password: '123' },
      mutations: {
        node_loginview: { inputEmail: 'alban@example.com', inputPassword: '•••' }
      },
      explanation: 'User enters a 3-character password and taps Login.'
    },
    {
      stepIndex: 1,
      title: 'Validation Guard Fails in AuthViewModel',
      activeNodeId: 'node_authviewmodel',
      activeEdgeId: 'edge_node_loginview_to_node_authviewmodel_login',
      portId: 'port_authviewmodel_validate',
      status: 'error',
      payload: { email: 'alban@example.com', password: '123' },
      mutations: {
        node_authviewmodel: {
          errorMessage: 'Password must be at least 6 characters.',
          isLoading: false
        }
      },
      explanation: 'guard validate() evaluates false (password.count < 6). errorMessage state mutated. Downstream network call HALTED.'
    }
  ];
}

function generateAuthErrorTrace(graph) {
  return [
    {
      stepIndex: 0,
      title: 'User Taps Login Button',
      activeNodeId: 'node_loginview',
      activeEdgeId: null,
      portId: 'node_loginview_out_user_action',
      status: 'success',
      payload: { email: 'alban@example.com', password: 'wrongpass' },
      mutations: {},
      explanation: 'User submits valid format credentials with incorrect password.'
    },
    {
      stepIndex: 1,
      title: 'AuthViewModel Dispatches Login',
      activeNodeId: 'node_authviewmodel',
      activeEdgeId: 'edge_node_loginview_to_node_authviewmodel_login',
      portId: 'port_authviewmodel_login',
      status: 'success',
      payload: { email: 'alban@example.com', password: 'wrongpass' },
      mutations: { node_authviewmodel: { isLoading: true, errorMessage: null } },
      explanation: 'Validation passes. ViewModel enters loading state and invokes AuthService.'
    },
    {
      stepIndex: 2,
      title: 'AuthService Throws 401 Unauthorized',
      activeNodeId: 'node_liveauthservice',
      activeEdgeId: 'edge_node_authviewmodel_to_node_liveauthservice_authenticate',
      portId: 'port_liveauthservice_authenticate',
      status: 'error',
      payload: { error: 'AuthError.invalidCredentials' },
      mutations: {
        node_authviewmodel: {
          isLoading: false,
          errorMessage: 'Invalid email or password.'
        }
      },
      explanation: 'LiveAuthService throws AuthError.invalidCredentials. AuthViewModel catches error, sets errorMessage, halts before TokenStorage.'
    }
  ];
}

export function executeCustomSimulation(startNodeId, startPortId, inputPayload, graph) {
  const steps = [];

  // Step 0: Input injection
  steps.push({
    stepIndex: 0,
    title: `Payload Injected into ${graph.nodes[startNodeId]?.name || startNodeId}`,
    activeNodeId: startNodeId,
    activeEdgeId: null,
    portId: startPortId,
    status: 'success',
    payload: inputPayload,
    mutations: {},
    explanation: `Input payload injected into ${startNodeId} socket.`
  });

  // Find outbound edges from this node
  const outboundEdges = Object.values(graph.edges || {}).filter(
    (e) => e.sourceNodeId === startNodeId
  );

  outboundEdges.forEach((edge, idx) => {
    const targetNode = graph.nodes[edge.targetNodeId];
    steps.push({
      stepIndex: idx + 1,
      title: `Dispatched to ${targetNode?.name || edge.targetNodeId}`,
      activeNodeId: edge.targetNodeId,
      activeEdgeId: edge.id,
      portId: edge.targetPortId,
      status: 'success',
      payload: inputPayload,
      mutations: {},
      explanation: `Traversed edge [${edge.edgeKind}] to ${targetNode?.name}. Target port: ${edge.targetPortId}.`
    });
  });

  return steps;
}
