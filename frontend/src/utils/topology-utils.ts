import dagre from 'dagre';
import { Node, Edge, Position } from '@xyflow/react';
export const nodeWidth = 120;
export const nodeHeight = 100;
export const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  device: { width: 120, height: 100 },
  apStack: { width: 120, height: 100 },
  aggregate: { width: 140, height: 100 },
};
// LOD Thresholds
export const LOD_HIGH = 0.8;
export const LOD_MID = 0.5;
export const LOD_LOW = 0.2;
export const getLODLevel = (zoom: number) => {
  if (zoom > LOD_HIGH) return 3; // Full detail
  if (zoom > LOD_MID) return 2;  // Standard
  if (zoom > LOD_LOW) return 1;  // Minimal
  return 0;                      // Micro (dots)
};
export const isAP = (role: string, apRoleName?: string) => {
  const r = (role || '').toLowerCase();
  if (apRoleName && r === apRoleName.toLowerCase()) return true;
  return r.includes('access') && r.includes('point');
};
export const formatInterfaceName = (name: string) => {
  if (!name) return name;
  // Add space between prefix and the first number (e.g. GigabitEthernet1 -> GigabitEthernet 1)
  return name.replace(/^([a-zA-Z]+)(\d)/, '$1 $2');
};
export const formatThroughput = (bps: number) => {
  if (bps === 0) return '0 bps';
  const k = 1000;
  const sizes = ['bps', 'kbps', 'Mbps', 'Gbps'];
  const i = Math.floor(Math.log(bps) / Math.log(k));
  return parseFloat((bps / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
export const getRoleRank = (role: string, type?: string): number => {
  if (type === 'as') return -1;
  const r = role.toLowerCase();
  if (r.includes('firewall') || r.includes('sdwan') || r.includes('cloud')) return 0;
  if (r.includes('router')) return 1;
  if (r.includes('core') || r.includes('spine')) return 2;
  if (r.includes('dist')) return 3;
  if (r.includes('access') && !r.includes('point')) return 4;
  if (r.includes('leaf')) return 4;
  if (r.includes('load') || r.includes('balancer')) return 5;
  if (r.includes('access') && r.includes('point')) return 6;
  if (r.includes('server')) return 7;
  return 8; // generic/unknown
};

/**
 * Detects if a node name implies a redundant partner (e.g. -01/-02, a/b).
 * Returns the base name if a partner pattern is found.
 */
export const getPartnerBaseName = (name: string): string | null => {
  if (!name) return null;
  // Match patterns like name-01, name-a, name-1
  const match = name.match(/^(.*?)[-_]?(0[12]|[ab]|[12])$/i);
  if (match) return match[1];
  return null;
};

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB', force = false) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 250, // Increased for better clarity
    ranksep: 300, // Increased for better vertical structure
    marginx: 150,
    marginy: 150,
    ranker: 'network-simplex', // Better for hierarchical structures
  });

  const nodeRankMap = new Map(nodes.map(n => [n.id, getRoleRank(n.data?.device?.role || '', n.type)]));

  nodes.forEach((node) => {
    const dims = NODE_DIMENSIONS[node.type || 'device'] || { width: 120, height: 100 };
    // We can't directly set 'rank' in dagre, but we can influence it 
    // by ensuring we provide consistent dimensions and hints.
    dagreGraph.setNode(node.id, { width: dims.width, height: dims.height });
  });

  edges.forEach((edge) => {
    // Influence ranking: Physical/LAG links have higher weight than BGP (logical)
    const weight = edge.id.startsWith('bgp-') ? 1 : 2;
    
    // Dagre does not support self-loop edges and will crash the application
    if (edge.source === edge.target) return;

    const sourceRank = nodeRankMap.get(edge.source) ?? 8;
    const targetRank = nodeRankMap.get(edge.target) ?? 8;

    // To ensure a consistent hierarchical flow (e.g. Core -> Access), 
    // we orient the edge in dagre from the lower-numbered rank (top) 
    // to the higher-numbered rank (bottom).
    if (targetRank < sourceRank) {
      dagreGraph.setEdge(edge.target, edge.source, { weight });
    } else {
      dagreGraph.setEdge(edge.source, edge.target, { weight });
    }
  });

  dagre.layout(dagreGraph);
  
  // Post-layout refinement: Align redundant partners (e.g. core-01 and core-02) to the same Y
  const partnerGroups = new Map<string, string[]>();
  nodes.forEach(node => {
      const baseName = getPartnerBaseName(node.data?.device?.name || node.data?.name || '');
      const rank = nodeRankMap.get(node.id) ?? 8;
      if (baseName) {
          const groupKey = `${baseName}-${rank}`; // Ensure we only group partners in the same tier
          if (!partnerGroups.has(groupKey)) partnerGroups.set(groupKey, []);
          partnerGroups.get(groupKey)!.push(node.id);
      }
  });

  partnerGroups.forEach(memberIds => {
      if (memberIds.length === 2) {
          const nodeA = dagreGraph.node(memberIds[0]);
          const nodeB = dagreGraph.node(memberIds[1]);
          if (nodeA && nodeB && Math.abs(nodeA.y - nodeB.y) < 500) { // Only align if they are already somewhat close (same rank)
              const avgY = (nodeA.y + nodeB.y) / 2;
              nodeA.y = avgY;
              nodeB.y = avgY;
          }
      }
  });

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const dims = NODE_DIMENSIONS[node.type || 'device'] || { width: 120, height: 100 };
    
    if (!nodeWithPosition) return node;

    return {
      ...node,
      targetPosition: direction === 'LR' ? Position.Left : Position.Top,
      sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
      position: !force && (node.position.x !== 0 || node.position.y !== 0) ? node.position : {
        x: nodeWithPosition.x - dims.width / 2,
        y: nodeWithPosition.y - dims.height / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

