/**
 * SaaG Dataflow Simulation Engine
 * Executes symbolic flow tracing, branch evaluation, and state mutation tracking
 * according to RFC-003.
 */

export const AUTH_SCENARIOS = [
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

export const LANDMARKS_SCENARIOS = [
  {
    id: 'landmarks_favorite_toggle',
    title: 'Landmarks: Toggle Favorite Landmark',
    description: 'User taps FavoriteButton in LandmarkDetail. Dispatches action to ModelData, updating the reactive landmarks array and invalidating LandmarkRow and CategoryHome.',
    startNodeId: 'node_favoritebutton',
    startPortId: 'node_favoritebutton_out_user_action',
    payload: {
      landmarkId: 1001,
      name: 'Silver Salmon Creek',
      isFavorite: true
    },
    traceGenerator: (graph) => generateLandmarksFavoriteTrace(graph)
  },
  {
    id: 'landmarks_profile_edit',
    title: 'Landmarks: Update User Profile',
    description: 'User edits profile name and seasonal photo in ProfileEditor. ProfileHost commits changes to ModelData, updating ProfileSummary.',
    startNodeId: 'node_profileeditor',
    startPortId: 'node_profileeditor_out_user_action',
    payload: {
      username: 'alban_architect',
      seasonalPhoto: 'winter',
      prefersNotifications: true
    },
    traceGenerator: (graph) => generateLandmarksProfileTrace(graph)
  },
  {
    id: 'landmarks_category_nav',
    title: 'Landmarks: Navigate Category Shelf',
    description: 'User taps category row in CategoryHome. Navigates to CategoryItem and presents LandmarkDetail view with full metadata.',
    startNodeId: 'node_categoryhome',
    startPortId: 'node_categoryhome_out_user_action',
    payload: {
      categoryName: 'Lakes',
      selectedLandmark: 'Lake McDonald'
    },
    traceGenerator: (graph) => generateLandmarksCategoryTrace(graph)
  }
];

export const MAKEITSO_SCENARIOS = [
  {
    id: 'makeitso_create_reminder',
    title: 'MakeItSo: Create & Persist Reminder',
    description: 'User enters reminder in ReminderDetailsView. RemindersListViewModel validates input and writes new document to RemindersRepository in Firestore.',
    startNodeId: 'node_reminderdetailsview',
    startPortId: 'node_reminderdetailsview_out_user_action',
    payload: {
      title: 'Review SaaG architecture graph',
      hasDueDate: true
    },
    traceGenerator: (graph) => generateMakeItSoCreateReminderTrace(graph)
  }
];

export const PRESET_SCENARIOS = AUTH_SCENARIOS;

export const ALL_SCENARIOS = [
  ...AUTH_SCENARIOS,
  ...LANDMARKS_SCENARIOS,
  ...MAKEITSO_SCENARIOS
];

export function getScenariosForGraph(graph) {
  const projectName = (graph?.metadata?.projectName || '').toLowerCase();
  const nodeKeys = Object.keys(graph?.nodes || {});
  const isLandmarks = projectName.includes('landmark') || nodeKeys.includes('node_landmarksapp');
  const isMakeItSo = projectName.includes('makeitso') || nodeKeys.includes('node_makeitsoapp');

  if (isLandmarks) {
    return LANDMARKS_SCENARIOS;
  }
  if (isMakeItSo) {
    return MAKEITSO_SCENARIOS;
  }
  return PRESET_SCENARIOS;
}

function generateHappyPathTrace(graph) {
  const hasBiometric = Boolean(graph?.nodes?.node_biometricapprovalview);

  if (hasBiometric) {
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
        perfMetrics: { latencyMs: 4, memoryDeltaMb: 0.2, cpuTimeMs: 2, isCriticalPath: false },
        explanation: 'User taps Submit button in LoginView. Form state is packaged into a Credentials struct and emitted.'
      },
      {
        stepIndex: 1,
        title: '⚡ Squeezed Pass-Through: Biometric Approval',
        activeNodeId: 'node_biometricapprovalview',
        activeEdgeId: 'edge_node_loginview_to_node_biometricapprovalview',
        portId: 'port_biometricapprovalview_requestApproval',
        status: 'success',
        payload: { email: 'alban@example.com', password: 'password123' },
        mutations: {
          node_biometricapprovalview: { isApproved: true }
        },
        perfMetrics: { latencyMs: 12, memoryDeltaMb: 0.8, cpuTimeMs: 6, isCriticalPath: false },
        explanation: 'BiometricApprovalView is marked as transient and squeezed. Passes through credentials automatically to AuthViewModel.'
      },
      {
        stepIndex: 2,
        title: 'Dispatch to AuthViewModel',
        activeNodeId: 'node_authviewmodel',
        activeEdgeId: 'edge_node_biometricapprovalview_to_node_authviewmodel',
        portId: 'port_authviewmodel_login',
        status: 'success',
        payload: { email: 'alban@example.com', password: 'password123' },
        mutations: {
          node_authviewmodel: { isLoading: true, errorMessage: null }
        },
        perfMetrics: { latencyMs: 8, memoryDeltaMb: 0.5, cpuTimeMs: 5, isCriticalPath: false },
        explanation: 'AuthViewModel.login(credentials:) receives payload. guard validate() passes. Sets isLoading = true.'
      },
      {
        stepIndex: 3,
        title: 'Async Call: LiveAuthService (Firebase)',
        activeNodeId: 'node_liveauthservice',
        activeEdgeId: 'edge_node_authviewmodel_to_node_liveauthservice_authenticate',
        portId: 'port_liveauthservice_authenticate',
        status: 'success',
        payload: { email: 'alban@example.com', password: 'password123' },
        mutations: {},
        perfMetrics: { latencyMs: 380, memoryDeltaMb: 14.2, cpuTimeMs: 44, isCriticalPath: true },
        explanation: 'LiveAuthService authenticates with Firebase identitytoolkit.googleapis.com gateway. Returns active UserSession token.'
      },
      {
        stepIndex: 4,
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
        perfMetrics: { latencyMs: 15, memoryDeltaMb: -1.2, cpuTimeMs: 8, isCriticalPath: false },
        explanation: 'KeychainStorage.save(token:) securely persists JWT token in iOS Keychain. AuthViewModel updates activeSession and clears isLoading.'
      }
    ];
  }

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
      perfMetrics: { latencyMs: 4, memoryDeltaMb: 0.2, cpuTimeMs: 2, isCriticalPath: false },
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
      perfMetrics: { latencyMs: 8, memoryDeltaMb: 0.5, cpuTimeMs: 5, isCriticalPath: false },
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
      perfMetrics: { latencyMs: 380, memoryDeltaMb: 14.2, cpuTimeMs: 44, isCriticalPath: true },
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
      perfMetrics: { latencyMs: 15, memoryDeltaMb: -1.2, cpuTimeMs: 8, isCriticalPath: false },
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
      perfMetrics: { latencyMs: 4, memoryDeltaMb: 0.2, cpuTimeMs: 2, isCriticalPath: false },
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
      perfMetrics: { latencyMs: 2, memoryDeltaMb: 0.1, cpuTimeMs: 1, isCriticalPath: false },
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
      perfMetrics: { latencyMs: 4, memoryDeltaMb: 0.2, cpuTimeMs: 2, isCriticalPath: false },
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
      perfMetrics: { latencyMs: 8, memoryDeltaMb: 0.5, cpuTimeMs: 5, isCriticalPath: false },
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
      perfMetrics: { latencyMs: 290, memoryDeltaMb: 4.8, cpuTimeMs: 32, isCriticalPath: true },
      explanation: 'LiveAuthService throws AuthError.invalidCredentials. AuthViewModel catches error, sets errorMessage, halts before TokenStorage.'
    }
  ];
}

function generateLandmarksFavoriteTrace(graph) {
  return [
    {
      stepIndex: 0,
      title: 'User Taps Favorite Button',
      activeNodeId: 'node_favoritebutton',
      activeEdgeId: null,
      portId: 'node_favoritebutton_out_user_action',
      status: 'success',
      payload: { landmarkId: 1001, isFavorite: true },
      mutations: {
        node_favoritebutton: { isSet: true }
      },
      perfMetrics: { latencyMs: 2, memoryDeltaMb: 0.1, cpuTimeMs: 1, isCriticalPath: false },
      explanation: 'User taps the star icon in FavoriteButton. Emits onUserAction event with toggled favorite state.'
    },
    {
      stepIndex: 1,
      title: 'LandmarkDetail Mediates Action',
      activeNodeId: 'node_landmarkdetail',
      activeEdgeId: 'edge_node_landmarkdetail_to_node_favoritebutton',
      portId: 'node_landmarkdetail_in',
      status: 'success',
      payload: { landmarkId: 1001, isFavorite: true },
      mutations: {},
      perfMetrics: { latencyMs: 4, memoryDeltaMb: 0.3, cpuTimeMs: 2, isCriticalPath: false },
      explanation: 'LandmarkDetail receives the tap event from its child component and dispatches mutation to ModelData store.'
    },
    {
      stepIndex: 2,
      title: 'ModelData State Mutation (@Published)',
      activeNodeId: 'node_modeldata',
      activeEdgeId: 'edge_node_landmarkdetail_to_node_modeldata_action',
      portId: 'node_modeldata_in',
      status: 'success',
      payload: { landmarkIndex: 0, isFavorite: true },
      mutations: {
        node_modeldata: { landmarks: 'Updated [1001: ★ Favorite]' }
      },
      perfMetrics: { latencyMs: 8, memoryDeltaMb: 1.4, cpuTimeMs: 6, isCriticalPath: false },
      explanation: 'ModelData toggles isFavorite at index in the @Published landmarks collection, broadcasting an objectWillChange notification.'
    },
    {
      stepIndex: 3,
      title: 'Reactive Update: LandmarkRow',
      activeNodeId: 'node_landmarkrow',
      activeEdgeId: 'edge_node_modeldata_to_node_landmarkrow_state',
      portId: 'node_landmarkrow_in',
      status: 'success',
      payload: { landmarkId: 1001, isFavorite: true },
      mutations: {
        node_landmarkrow: { starRendered: 'yellow_filled' }
      },
      perfMetrics: { latencyMs: 3, memoryDeltaMb: 0.2, cpuTimeMs: 2, isCriticalPath: false },
      explanation: 'LandmarkRow in the Navigation list re-renders to display the filled yellow star next to Silver Salmon Creek.'
    },
    {
      stepIndex: 4,
      title: 'Reactive Invalidation: CategoryHome',
      activeNodeId: 'node_categoryhome',
      activeEdgeId: 'edge_node_modeldata_to_node_categoryhome_state',
      portId: 'node_categoryhome_in',
      status: 'success',
      payload: { landmarkId: 1001, isFavorite: true },
      mutations: {
        node_categoryhome: { featuresBadgeCount: 1 }
      },
      perfMetrics: { latencyMs: 5, memoryDeltaMb: 0.4, cpuTimeMs: 3, isCriticalPath: false },
      explanation: 'CategoryHome refreshes its featured items and favorites carousel.'
    }
  ];
}

function generateLandmarksProfileTrace(graph) {
  return [
    {
      stepIndex: 0,
      title: 'User Edits Profile Fields',
      activeNodeId: 'node_profileeditor',
      activeEdgeId: null,
      portId: 'node_profileeditor_out_user_action',
      status: 'success',
      payload: { username: 'alban_architect', seasonalPhoto: 'winter' },
      mutations: {
        node_profileeditor: { draftUsername: 'alban_architect', draftPhoto: 'winter' }
      },
      perfMetrics: { latencyMs: 3, memoryDeltaMb: 0.2, cpuTimeMs: 2, isCriticalPath: false },
      explanation: 'User updates profile form controls in ProfileEditor.'
    },
    {
      stepIndex: 1,
      title: 'ProfileHost Commits Changes',
      activeNodeId: 'node_profilehost',
      activeEdgeId: 'edge_node_profilehost_to_node_profileeditor',
      portId: 'node_profilehost_in',
      status: 'success',
      payload: { username: 'alban_architect', seasonalPhoto: 'winter' },
      mutations: {
        node_profilehost: { editMode: 'inactive' }
      },
      perfMetrics: { latencyMs: 6, memoryDeltaMb: 0.5, cpuTimeMs: 4, isCriticalPath: false },
      explanation: 'User taps Done in ProfileHost. Dismisses editor sheet and persists draft to ModelData.'
    },
    {
      stepIndex: 2,
      title: 'ModelData Updates Profile Store',
      activeNodeId: 'node_modeldata',
      activeEdgeId: 'edge_node_profilehost_to_node_modeldata_action',
      portId: 'node_modeldata_in',
      status: 'success',
      payload: { username: 'alban_architect', seasonalPhoto: 'winter' },
      mutations: {
        node_modeldata: { profile: 'Profile(username: "alban_architect", seasonalPhoto: .winter)' }
      },
      perfMetrics: { latencyMs: 10, memoryDeltaMb: 1.1, cpuTimeMs: 7, isCriticalPath: false },
      explanation: 'ModelData.profile is overwritten with the new Profile struct.'
    },
    {
      stepIndex: 3,
      title: 'ProfileSummary Renders Updated Profile',
      activeNodeId: 'node_profilesummary',
      activeEdgeId: 'edge_node_modeldata_to_node_profilesummary_state',
      portId: 'node_profilesummary_in',
      status: 'success',
      payload: { username: 'alban_architect', seasonalPhoto: 'winter' },
      mutations: {
        node_profilesummary: { renderedUsername: 'alban_architect' }
      },
      perfMetrics: { latencyMs: 4, memoryDeltaMb: 0.3, cpuTimeMs: 3, isCriticalPath: false },
      explanation: 'ProfileSummary displays the updated username and badge.'
    }
  ];
}

function generateLandmarksCategoryTrace(graph) {
  return [
    {
      stepIndex: 0,
      title: 'User Taps Lakes Category',
      activeNodeId: 'node_categoryhome',
      activeEdgeId: null,
      portId: 'node_categoryhome_out_user_action',
      status: 'success',
      payload: { categoryName: 'Lakes' },
      mutations: {},
      perfMetrics: { latencyMs: 2, memoryDeltaMb: 0.1, cpuTimeMs: 1, isCriticalPath: false },
      explanation: 'User taps on the Lakes horizontal row in CategoryHome.'
    },
    {
      stepIndex: 1,
      title: 'CategoryRow Filters Lakes',
      activeNodeId: 'node_categoryrow',
      activeEdgeId: 'edge_node_categoryhome_to_node_categoryrow',
      portId: 'node_categoryrow_in',
      status: 'success',
      payload: { categoryName: 'Lakes' },
      mutations: {},
      perfMetrics: { latencyMs: 4, memoryDeltaMb: 0.4, cpuTimeMs: 3, isCriticalPath: false },
      explanation: 'CategoryRow filters landmarks for category Lakes.'
    },
    {
      stepIndex: 2,
      title: 'User Taps Lake McDonald Card',
      activeNodeId: 'node_categoryitem',
      activeEdgeId: 'edge_node_categoryrow_to_node_categoryitem',
      portId: 'node_categoryitem_in',
      status: 'success',
      payload: { landmarkId: 1002, name: 'Lake McDonald' },
      mutations: {},
      perfMetrics: { latencyMs: 3, memoryDeltaMb: 0.3, cpuTimeMs: 2, isCriticalPath: false },
      explanation: 'CategoryItem emits selection of Lake McDonald.'
    },
    {
      stepIndex: 3,
      title: 'Navigation: LandmarkDetail Presented',
      activeNodeId: 'node_landmarkdetail',
      activeEdgeId: 'edge_node_categoryitem_to_node_landmarkdetail',
      portId: 'node_landmarkdetail_in',
      status: 'success',
      payload: { landmarkId: 1002, name: 'Lake McDonald' },
      mutations: {
        node_landmarkdetail: { isPresented: true, landmarkName: 'Lake McDonald' }
      },
      perfMetrics: { latencyMs: 12, memoryDeltaMb: 2.1, cpuTimeMs: 8, isCriticalPath: false },
      explanation: 'NavigationLink pushes LandmarkDetail view onto the navigation stack.'
    }
  ];
}

function generateMakeItSoCreateReminderTrace(graph) {
  return [
    {
      stepIndex: 0,
      title: 'User Enters Reminder in Details View',
      activeNodeId: 'node_reminderdetailsview',
      activeEdgeId: null,
      portId: 'node_reminderdetailsview_out_user_action',
      status: 'success',
      payload: { title: 'Review SaaG architecture graph', hasDueDate: true },
      mutations: {
        node_reminderdetailsview: { titleText: 'Review SaaG architecture graph' }
      },
      perfMetrics: { latencyMs: 3, memoryDeltaMb: 0.2, cpuTimeMs: 2, isCriticalPath: false },
      explanation: 'User types title in ReminderDetailsView and taps Save/Commit.'
    },
    {
      stepIndex: 1,
      title: 'RemindersListViewModel Validates & Creates Reminder',
      activeNodeId: 'node_reminderslistviewmodel',
      activeEdgeId: 'edge_node_reminderslistview_to_node_reminderslistviewmodel_createNewReminder',
      portId: 'node_reminderslistviewmodel_in',
      status: 'success',
      payload: { title: 'Review SaaG architecture graph' },
      mutations: {
        node_reminderslistviewmodel: { isSaving: true }
      },
      perfMetrics: { latencyMs: 6, memoryDeltaMb: 0.6, cpuTimeMs: 4, isCriticalPath: false },
      explanation: 'RemindersListViewModel receives new reminder, validates title is non-empty, and prepares Firestore document.'
    },
    {
      stepIndex: 2,
      title: 'RemindersRepository Persists to Firestore',
      activeNodeId: 'node_remindersrepository',
      activeEdgeId: 'edge_node_reminderslistviewmodel_to_node_remindersrepository_addReminder',
      portId: 'node_remindersrepository_in',
      status: 'success',
      payload: { documentId: 'rem_123', status: 'persisted' },
      mutations: {
        node_remindersrepository: { documentCount: 1 }
      },
      perfMetrics: { latencyMs: 140, memoryDeltaMb: 5.2, cpuTimeMs: 22, isCriticalPath: true },
      explanation: 'RemindersRepository calls Firestore addDocument(), writing new reminder to Firebase.'
    },
    {
      stepIndex: 3,
      title: 'RemindersListView Displays New Item',
      activeNodeId: 'node_reminderslistview',
      activeEdgeId: 'edge_node_viewmodel_to_node_reminderslistview_state',
      portId: 'node_reminderslistview_in',
      status: 'success',
      payload: { totalReminders: 1 },
      mutations: {
        node_reminderslistview: { remindersCount: 1 }
      },
      perfMetrics: { latencyMs: 8, memoryDeltaMb: 0.4, cpuTimeMs: 5, isCriticalPath: false },
      explanation: 'RemindersListView updates its List rows via EnvironmentObject subscription.'
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
