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
export const isAP = (role: string) => {
  const r = role.toLowerCase();
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
export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB', force = false) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 150,
    ranksep: 200,
    marginx: 100,
    marginy: 100,
  });
  nodes.forEach((node) => {
    const dims = NODE_DIMENSIONS[node.type || 'device'] || { width: 120, height: 100 };
    dagreGraph.setNode(node.id, { width: dims.width, height: dims.height });
  });
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });
  dagre.layout(dagreGraph);
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
