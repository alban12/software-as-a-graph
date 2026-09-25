/**
 * Materializes a Capability Blueprint at specific canvas coordinates.
 */
export function instantiateBlueprint(blueprint, dropPosition = { x: 200, y: 200 }, existingNodeIds = []) {
  const timestamp = Date.now().toString(36).slice(-4);
  const idMap = new Map(); // idSuffix -> uniqueNodeId

  // 1. Assign unique IDs to each relative node
  blueprint.relativeNodes.forEach((rn) => {
    let candidateId = `node_${rn.name.toLowerCase()}`;
    if (existingNodeIds.includes(candidateId)) {
      candidateId = `${candidateId}_${timestamp}`;
    }
    idMap.set(rn.idSuffix, candidateId);
  });

  // 2. Generate ReactFlow nodes
  const newNodes = blueprint.relativeNodes.map((rn) => {
    const uniqueId = idMap.get(rn.idSuffix);
    const pos = {
      x: Math.round(dropPosition.x + rn.offsetX),
      y: Math.round(dropPosition.y + rn.offsetY)
    };
    return {
      id: uniqueId,
      type: 'saagNode',
      position: pos,
      data: {
        id: uniqueId,
        name: rn.name,
        kind: rn.kind,
        level: rn.level || 'L1_SCREEN',
        description: rn.description,
        inputs: rn.inputs || [],
        outputs: rn.outputs || [],
        properties: rn.properties || [],
        methods: rn.methods || [],
        viewElements: rn.viewElements || [],
        sourceFile: rn.sourceFile,
        blueprintId: blueprint.id,
        canvasMeta: {
          position: pos
        }
      }
    };
  });

  // 3. Generate ReactFlow edges pre-wiring the micro-topology
  const newEdges = (blueprint.relativeEdges || []).map((re, idx) => {
    const sourceId = idMap.get(re.sourceSuffix);
    const targetId = idMap.get(re.targetSuffix);
    return {
      id: `edge_${sourceId}_to_${targetId}_${timestamp}_${idx}`,
      source: sourceId,
      target: targetId,
      sourceHandle: re.sourceHandle,
      targetHandle: re.targetHandle,
      label: re.label,
      data: {
        edgeKind: re.edgeKind || 'dataflow',
        contract: re.contract
      }
    };
  });

  // 4. Extract starter code files for optional scaffolding
  const filesToScaffold = blueprint.relativeNodes
    .filter((rn) => rn.sourceFile && rn.codeTemplate)
    .map((rn) => ({
      filePath: rn.sourceFile,
      content: rn.codeTemplate,
      nodeId: idMap.get(rn.idSuffix)
    }));

  return {
    blueprintId: blueprint.id,
    blueprintTitle: blueprint.title,
    nodes: newNodes,
    edges: newEdges,
    filesToScaffold
  };
}
