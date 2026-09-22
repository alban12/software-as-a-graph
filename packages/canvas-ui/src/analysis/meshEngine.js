/**
 * SaaG Equidistant Force-Directed Mesh Engine
 * 
 * Computes a balanced, non-hierarchical, force-directed network layout:
 * 1. Physical simulation (Hooke's law attraction along edges + Coulomb repulsion between nodes)
 * 2. Rectangular AABB collision separation pass with rearrangeNodes guarantee
 * 3. Hub-and-spoke centering (e.g. ModelData or Router centered among connected peers)
 * 4. Deterministic initial seed for reproducible layout
 */

import { getNodeDimensions, rearrangeNodes } from './treeEngine.js';

export function computeMeshForceLayout(visibleNodeList, rawGraph, options = {}) {
  const {
    iterations = 100,
    idealDistance = 240,
    paddingX = 35,
    paddingY = 35,
    gravity = 0.16,
    center = { x: 1000, y: 800 }
  } = options;

  const nodeMap = new Map();
  const nodes = [];
  const rawNodesMap = {};
  const initialRadius = Math.max(220, (visibleNodeList?.length || 1) * 16);

  (visibleNodeList || []).forEach((n, idx) => {
    const data = n.data || n;
    const dim = getNodeDimensions(n);
    rawNodesMap[n.id] = data;
    const nodeItem = {
      id: n.id,
      name: data.name || n.id,
      kind: data.kind || 'unknown',
      width: dim.width,
      height: dim.height,
      degree: 0,
      // Deterministic compact initial circle placement to avoid random jitter
      x: center.x + Math.cos((idx / (visibleNodeList.length || 1)) * 2 * Math.PI) * initialRadius,
      y: center.y + Math.sin((idx / (visibleNodeList.length || 1)) * 2 * Math.PI) * initialRadius,
      vx: 0,
      vy: 0
    };
    nodeMap.set(n.id, nodeItem);
    nodes.push(nodeItem);
  });

  if (nodes.length === 0) {
    return { positions: {}, hubNodeId: null, nodeCount: 0, edgeCount: 0 };
  }

  // Count edge degrees
  const rawEdges = Object.values(rawGraph?.edges || {});
  const edgeList = [];

  rawEdges.forEach((edge) => {
    if (nodeMap.has(edge.sourceNodeId) && nodeMap.has(edge.targetNodeId)) {
      if (edge.sourceNodeId !== edge.targetNodeId) {
        const source = nodeMap.get(edge.sourceNodeId);
        const target = nodeMap.get(edge.targetNodeId);
        source.degree++;
        target.degree++;
        edgeList.push({ source, target });
      }
    }
  });

  // Identify central hub nodes (highest degree, e.g. ModelData or Router)
  let maxDegree = 0;
  let hubNode = null;
  nodes.forEach((n) => {
    if (n.degree > maxDegree) {
      maxDegree = n.degree;
      hubNode = n;
    }
  });

  // Force-directed simulation loop with simulated annealing
  const k = Math.max(idealDistance, 200);
  let temperature = 80.0;
  const cooling = 0.96;

  for (let iter = 0; iter < iterations; iter++) {
    // 1. Reset velocities
    nodes.forEach((n) => {
      n.vx = 0;
      n.vy = 0;
    });

    // 2. Coulomb Repulsion between all pairs of nodes: Fr = k^2 / dist
    for (let i = 0; i < nodes.length; i++) {
      const u = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const v = nodes[j];

        const dx = u.x - v.x;
        const dy = u.y - v.y;
        const rawDist = Math.hypot(dx, dy);
        const dist = Math.max(rawDist, 10.0);

        const repForce = (k * k) / dist;
        const fx = (dx / dist) * repForce;
        const fy = (dy / dist) * repForce;

        u.vx += fx;
        u.vy += fy;
        v.vx -= fx;
        v.vy -= fy;
      }
    }

    // 3. Hooke Attraction along edges: Fa = dist^2 / k
    edgeList.forEach(({ source, target }) => {
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.hypot(dx, dy) || 1.0;

      const attForce = (dist * dist) / k;
      const fx = (dx / dist) * attForce;
      const fy = (dy / dist) * attForce;

      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    });

    // 4. Global Centering Gravity: pull ALL nodes towards center so peripheral nodes do not drift away
    nodes.forEach((n) => {
      const nodeGravity = (n === hubNode)
        ? gravity * 1.6
        : (n.degree === 0 ? gravity * 2.2 : gravity);

      n.vx += (center.x - n.x) * nodeGravity;
      n.vy += (center.y - n.y) * nodeGravity;

      // Soft bounding barrier for disconnected nodes so they stay in orbit around the cluster
      if (n.degree === 0) {
        const distFromCenter = Math.hypot(n.x - center.x, n.y - center.y);
        const maxAllowedRadius = initialRadius * 1.8;
        if (distFromCenter > maxAllowedRadius) {
          const excess = distFromCenter - maxAllowedRadius;
          n.vx += ((center.x - n.x) / distFromCenter) * excess * 0.2;
          n.vy += ((center.y - n.y) / distFromCenter) * excess * 0.2;
        }
      }
    });

    // 5. Update positions with temperature clamping
    nodes.forEach((n) => {
      const vDist = Math.hypot(n.vx, n.vy) || 1.0;
      const limitedDist = Math.min(vDist, temperature);

      n.x += (n.vx / vDist) * limitedDist;
      n.y += (n.vy / vDist) * limitedDist;
    });

    temperature *= cooling;
  }

  // 6. Hard AABB Collision Separation & Spacing Pass
  for (let pass = 0; pass < 20; pass++) {
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];

        const minSeparationX = (a.width + b.width) / 2 + paddingX + 5;
        const minSeparationY = (a.height + b.height) / 2 + paddingY + 5;

        const dx = a.x - b.x;
        const dy = a.y - b.y;

        const overlapX = minSeparationX - Math.abs(dx);
        const overlapY = minSeparationY - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          if (overlapX < overlapY) {
            const shift = (overlapX + 10) / 2;
            const sign = dx >= 0 ? 1 : -1;
            a.x += shift * sign;
            b.x -= shift * sign;
          } else {
            const shift = (overlapY + 10) / 2;
            const sign = dy >= 0 ? 1 : -1;
            a.y += shift * sign;
            b.y -= shift * sign;
          }
        }
      }
    }
  }

  // 7. Normalize coordinates so the graph is centered with positive margin
  let minX = Infinity;
  let minY = Infinity;
  nodes.forEach((n) => {
    minX = Math.min(minX, n.x - n.width / 2);
    minY = Math.min(minY, n.y - n.height / 2);
  });

  const targetMarginX = 80;
  const targetMarginY = 100;
  const shiftX = targetMarginX - minX;
  const shiftY = targetMarginY - minY;

  const initialPositions = {};
  nodes.forEach((n) => {
    initialPositions[n.id] = {
      x: Math.round(n.x - n.width / 2 + shiftX),
      y: Math.round(n.y - n.height / 2 + shiftY)
    };
  });

  // 8. Run final AABB relaxation to mathematically guarantee 0 collisions
  const { positions: resolvedPositions } = rearrangeNodes(initialPositions, rawNodesMap, null, {
    paddingX: paddingX,
    paddingY: paddingY,
    maxIterations: 45,
    pushStrength: 0.75
  });

  return {
    positions: resolvedPositions,
    hubNodeId: hubNode?.id || null,
    nodeCount: nodes.length,
    edgeCount: edgeList.length
  };
}
