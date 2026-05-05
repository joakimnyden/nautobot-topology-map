import { useMemo, useCallback, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';
import { Device, Link } from '../types';
import { isAP, formatInterfaceName } from '../utils/topology-utils';
interface UseTopologyDataProps {
  devices: Device[];
  links: Link[];
  filterType: 'all' | 'vlan' | 'protocol' | 'prefix';
  filterValue: string;
  iconMode: 'role' | 'vendor';
  iconStyle: 'simple' | 'fancy';
  lod: number;
  showInterfaces: boolean;
  selectedEdgeId: string | null;
  selectedNodeId: string | null;
  hoveredEdgeId: string | null;
  showTraffic: boolean;
  linkMetrics: Record<string, any>;
  zoom: number;
  onDeviceHover: (id: string | null, pos?: { x: number, y: number }) => void;
  apRoleName?: string;
}
export function useTopologyData({
  devices,
  links,
  filterType,
  filterValue,
  iconMode,
  iconStyle,
  lod,
  showInterfaces,
  selectedEdgeId,
  selectedNodeId,
  hoveredEdgeId,
  showTraffic,
  linkMetrics,
  zoom,
  onDeviceHover,
  apRoleName,
}: UseTopologyDataProps) {
  // 1. Pre-process datasets for efficient O(1) lookups
  const { validDevices, deviceMap, linkMap, linksByDevice } = useMemo(() => {
    const idSet = new Set<string>();
    const valid = devices.filter(d => {
      if (!d || !d.id) return false;
      if (idSet.has(d.id)) {
        console.warn(`Duplicate device ID detected: ${d.id}. Skipping.`);
        return false;
      }
      idSet.add(d.id);
      return true;
    });
    const lByD = new Map<string, Link[]>();
    links.forEach(l => {
      const s = String(l.source);
      const t = String(l.target);
      if (!lByD.has(s)) lByD.set(s, []);
      if (!lByD.has(t)) lByD.set(t, []);
      lByD.get(s)!.push(l);
      lByD.get(t)!.push(l);
    });
    return {
      validDevices: valid,
      deviceMap: new Map(valid.map(d => [d.id, d])),
      linkMap: new Map(links.map(l => [l.id, l])),
      linksByDevice: lByD
    };
  }, [devices, links]);
  // topoNodes calculation
  const topoNodes = useMemo(() => {
    const query = filterValue.toLowerCase();
    const nodes: Node[] = [];
    const apiDevices = validDevices.filter(d => !d.type || d.type === 'device');
    const apiGroups = validDevices.filter(d => d.type === 'group');

    // 1. Process Groups (Unconnected locations)
    apiGroups.forEach(group => {
      nodes.push({
        id: group.id,
        type: 'aggregate',
        style: { background: 'transparent', border: 'none' },
        data: { 
          name: group.name, 
          deviceCount: group.deviceCount || 0,
          devices: (group as any).devices || [],
          iconStyle,
          lod: lod
        },
        position: { x: 0, y: 0 },
      });
    });

    // 2. Generic Leaf Stacking Logic
    // Groups devices that only have ONE neighbor.
    const leafStackGroups = new Map<string, Device[]>();
    const unconNodes: Device[] = [];
    const mainNodesList: Device[] = [];

    apiDevices.forEach(device => {
      const isAPDevice = isAP(device.role, apRoleName);
      const linksToDevice = linksByDevice.get(device.id) || [];
      const neighbors = new Set(linksToDevice.map(l => String(l.source) === device.id ? String(l.target) : String(l.source)));
      
      // Candidate for stacking if:
      // - It is an AP with a parent.
      // - OR it has exactly ONE neighbor and site is dense (> 1000 nodes).
      const isLeaf = neighbors.size === 1;
      const shouldAttemptStack = isAPDevice || (apiDevices.length > 1000 && isLeaf);

      if (shouldAttemptStack && neighbors.size > 0) {
        const parentId = Array.from(neighbors)[0];
        if (!leafStackGroups.has(parentId)) leafStackGroups.set(parentId, []);
        leafStackGroups.get(parentId)!.push(device);
      } else if (isAPDevice && neighbors.size === 0) {
        unconNodes.push(device);
      } else {
        mainNodesList.push(device);
      }
    });

    // Create Stack Nodes
    leafStackGroups.forEach((groupNodes, parentId) => {
      const parentDevice = deviceMap.get(parentId);
      if (groupNodes.length === 1) {
        mainNodesList.push(groupNodes[0]);
      } else {
        const stackId = `stack-${parentId}`;
        nodes.push({
          id: stackId,
          type: 'apStack',
          style: { background: 'transparent', border: 'none' },
          data: { 
            count: groupNodes.length, 
            parentName: parentDevice?.name, 
            devices: groupNodes,
            iconStyle,
            lod: lod
          },
          position: { x: 0, y: 0 },
        });
      }
    });

    // Create Unconnected Stack
    if (unconNodes.length > 0) {
      nodes.push({
        id: 'stack-unconnected',
        type: 'cluster',
        style: { background: 'transparent', border: 'none' },
        data: { count: unconNodes.length, parentName: undefined, devices: unconNodes, iconStyle, lod },
        position: { x: 0, y: 0 },
      });
    }

    // Create Individual Device Nodes
    mainNodesList.forEach(device => {
      let isHighlighted = false;
      if (filterValue) {
        const q = filterValue.toLowerCase();
        if (filterType === 'vlan') isHighlighted = device.vlans?.some(v => v.toString() === q) || false;
        if (filterType === 'protocol') isHighlighted = device.protocols?.some(p => p.toLowerCase().includes(q)) || false;
        if (filterType === 'prefix') isHighlighted = device.prefixes?.some(p => p.includes(q)) || false;
        if (filterType === 'all') {
          isHighlighted = device.name.toLowerCase().includes(q) ||
            device.vlans?.some(v => v.toString() === q) ||
            device.protocols?.some(p => p.toLowerCase().includes(q)) || false;
        }
      }
      nodes.push({
        id: device.id,
        type: 'device',
        data: { device, isHighlighted, hasQuery: !!filterValue, iconMode, iconStyle, lod: lod, onHover: onDeviceHover },
        position: { x: 0, y: 0 },
      });
    });

    return nodes;
  }, [validDevices, devices, links, filterType, filterValue, iconMode, iconStyle, lod, deviceMap, linksByDevice, onDeviceHover, apRoleName]);

  // topoEdges calculation
  const topoEdges = useMemo(() => {
    const query = filterValue.toLowerCase();
    const edges: Edge[] = [];
    
    // 1. Identify which nodes are in stacks to redirect edges
    const nodeToStackMap = new Map<string, string>();
    const stackCounts = new Map<string, number>();

    const apiDevices = validDevices.filter(d => !d.type || d.type === 'device');
    apiDevices.forEach(device => {
      const isAPDevice = isAP(device.role, apRoleName);
      const linksToDevice = linksByDevice.get(device.id) || [];
      const neighbors = new Set(linksToDevice.map(l => String(l.source) === device.id ? String(l.target) : String(l.source)));
      const isLeaf = neighbors.size === 1;
      const shouldAttemptStack = isAPDevice || (apiDevices.length > 1000 && isLeaf);

      if (shouldAttemptStack && neighbors.size > 0) {
        const parentId = Array.from(neighbors)[0];
        nodeToStackMap.set(device.id, `stack-${parentId}`);
      }
    });

    nodeToStackMap.forEach((stackId) => {
      stackCounts.set(stackId, (stackCounts.get(stackId) || 0) + 1);
    });

    // Create edges for stacks
    stackCounts.forEach((count, stackId) => {
      if (count > 1) {
        const parentId = stackId.replace('stack-', '');
        edges.push({
          id: `edge-${stackId}`,
          source: parentId,
          target: stackId,
          type: 'smoothstep',
          label: `${count} Devices`,
          style: { stroke: '#10b981', strokeWidth: 3, opacity: 0.8 },
          labelStyle: { fill: '#10b981', fontSize: 10, fontWeight: 700 },
          labelBgStyle: { fill: '#0f172a', fillOpacity: 0.95, rx: 4 },
        });
      }
    });

    // 2. Group links by node pairs to handle multi-links and aggregation
    const linkGroups = new Map<string, Link[]>();
    links.forEach(link => {
      let s = String(link.source);
      let t = String(link.target);
      
      const sStack = nodeToStackMap.get(s);
      if (sStack && (stackCounts.get(sStack) || 0) > 1) return;
      const tStack = nodeToStackMap.get(t);
      if (tStack && (stackCounts.get(tStack) || 0) > 1) return;

      const key = [s, t].sort().join('--');
      if (!linkGroups.has(key)) linkGroups.set(key, []);
      linkGroups.get(key)!.push(link);
    });

    // 3. Process remaining link groups and create edges
    linkGroups.forEach((group, pairKey) => {
      const [sId, tId] = pairKey.split('--');
      const sourceDev = deviceMap.get(sId);
      const targetDev = deviceMap.get(tId);
      
      if (!sourceDev || !targetDev) return;

      const shouldAggregate = (links.length > 200 && group.length > 1) || (lod < 2 && group.length > 1);

      if (shouldAggregate) {
        const isSelected = group.some(l => l.id === selectedEdgeId);
        const hasHovered = group.some(l => l.id === hoveredEdgeId);
        const hasLogical = group.some(l => l.type === 'logical');
        const hasLAG = group.some(l => l.isPortChannel);

        edges.push({
          id: `agg-${pairKey}`,
          source: sId,
          target: tId,
          type: (links.length > 300 || lod < 2) ? 'straight' : 'smoothstep',
          hidden: zoom < 0.1 && links.length > 500,
          label: zoom > 0.4 ? `x${group.length} Cables` : undefined,
          data: { curvature: 0 },
          labelStyle: {
            fill: (hasHovered || isSelected) ? '#fbbf24' : '#94a3b8',
            fontSize: 10,
            fontWeight: 800,
            fontFamily: 'var(--font-mono)'
          },
          labelBgStyle: { fill: '#0f172a', fillOpacity: 0.95, rx: 4 },
          style: {
            stroke: (hasHovered || isSelected) ? '#fbbf24' : (hasLAG ? '#818cf8' : '#475569'),
            strokeWidth: 3 + Math.min(group.length, 5),
            opacity: (filterValue || selectedEdgeId || selectedNodeId) && !hasHovered && !isSelected ? 0.3 : 0.8,
            strokeDasharray: hasLogical && !hasLAG ? '8,4' : 'none',
            // Disable expensive filters for aggregated edges unless hovered/selected OR in fancy mode at high zoom
            filter: (hasHovered || isSelected) 
              ? `drop-shadow(0 0 8px ${hasHovered ? '#fbbf24' : '#fbbf24'})` 
              : (hasLAG && iconStyle === 'fancy' && zoom > 0.5 && links.length < 500)
                ? `drop-shadow(0 0 6px #818cf866)`
                : 'none',
          },
        });
      } else {
        group.forEach((link, edgeIndex) => {
          let isEdgeHighlighted = link.id === hoveredEdgeId;
          if (filterValue) {
            if (filterType === 'vlan') isEdgeHighlighted = isEdgeHighlighted || (link.vlan?.toString() === query);
            if (filterType === 'protocol') isEdgeHighlighted = isEdgeHighlighted || (link.protocol?.toLowerCase().includes(query));
          }
          
          const isSelected = link.id === selectedEdgeId;
          const isLogical = link.type === 'logical';
          
          let label = link.protocol;
          if (showInterfaces || isSelected) {
            const sourcePort = link.isPortChannel && link.lagMembers
              ? `${formatInterfaceName(link.sourceInterface || '')} [${link.lagMembers.map(m => formatInterfaceName(m.sourceInterface)).join(', ')}]`
              : formatInterfaceName(link.sourceInterface || '');
            const targetPort = link.isPortChannel && link.lagMembers
              ? `${formatInterfaceName(link.targetInterface || '')} [${link.lagMembers.map(m => formatInterfaceName(m.targetInterface)).join(', ')}]`
              : formatInterfaceName(link.targetInterface || '');
            label = isSelected
              ? `${sourcePort} ↔ ${targetPort}${link.nautobotUrl ? ' 🔗' : ''}`
              : `${formatInterfaceName(link.sourceInterface || '')} ↔ ${formatInterfaceName(link.targetInterface || '')}`;
          }

          const isRelatedToSelection = sId === selectedNodeId || tId === selectedNodeId;
          
          const sourceRole = sourceDev.role.toLowerCase();
          const targetRole = targetDev.role.toLowerCase();
          const isSpineLeafOrCoreDist = (
            (sourceRole.includes('spine') && targetRole.includes('leaf')) ||
            (sourceRole.includes('leaf') && targetRole.includes('spine')) ||
            (sourceRole.includes('core') && (targetRole.includes('dist') || targetRole.includes('distribution'))) ||
            (targetRole.includes('core') && (sourceRole.includes('dist') || sourceRole.includes('distribution'))) ||
            (sourceRole.includes('core') && targetRole.includes('core'))
          );

          const forceStraight = link.isPortChannel || (link.type === 'physical' && isSpineLeafOrCoreDist);
          const edgeType = isLogical || (group.length > 1) ? 'bezier' : (forceStraight ? 'straight' : (links.length > 300 || lod < 2 ? 'straight' : 'smoothstep'));

          edges.push({
            id: link.id,
            source: sId,
            target: tId,
            type: edgeType,
            hidden: (links.length > 2000 && zoom < 0.1) || (links.length > 500 && zoom < 0.05),
            animated: (link.id === hoveredEdgeId || isSelected || isRelatedToSelection) && !link.isPortChannel && (link.type !== 'physical' || isRelatedToSelection || isSelected) && links.length < 1000,
            label: (links.length > 1000 || lod < 2) && !isSelected && !isRelatedToSelection ? undefined : label,
            data: { curvature: isLogical ? (edgeIndex % 2 === 0 ? 0.35 : -0.35) : (edgeIndex === 0 || forceStraight ? 0 : (edgeIndex % 2 === 0 ? 0.2 : -0.2)) },
            labelStyle: {
              fill: isEdgeHighlighted ? '#fbbf24' : (isSelected || isRelatedToSelection ? '#38bdf8' : (link.type === 'physical' ? '#94a3b8' : (link.type === 'port-channel' ? '#a5b4fc' : '#10b981'))),
              fontSize: (showInterfaces || isSelected) ? 8 : 10,
              fontWeight: 800,
              fontFamily: 'var(--font-mono)'
            },
            labelBgStyle: { fill: '#0f172a', fillOpacity: 0.95, rx: 4 },
            style: {
              stroke: (showTraffic && linkMetrics[link.id]) 
                ? (linkMetrics[link.id].utilization < 50 ? '#10b981' : (linkMetrics[link.id].utilization < 80 ? '#fbbf24' : '#ef4444'))
                : (isEdgeHighlighted ? '#fbbf24' : (isSelected || isRelatedToSelection ? '#38bdf8' : (link.type === 'physical' ? '#475569' : (link.type === 'port-channel' ? '#818cf8' : '#10b981')))),
              strokeWidth: link.isPortChannel ? 5 : (isEdgeHighlighted ? 5 : (isSelected || isRelatedToSelection ? 4 : (link.type === 'physical' ? 2 : 1.5))),
              opacity: (filterValue || selectedEdgeId || selectedNodeId) && !isEdgeHighlighted && !isSelected && !isRelatedToSelection ? 0.2 : 1,
              strokeDasharray: isLogical ? '8,4' : 'none',
              // Use a much faster filter only for selection/hover
              filter: (isEdgeHighlighted || isSelected) 
                ? `drop-shadow(0 0 8px ${isEdgeHighlighted ? '#fbbf24' : '#38bdf8'})`
                : 'none',
              // For port-channels, we use a distinct color and width instead of an expensive glow filter
              // unless specifically hovered or selected.
            },
          });
        });
      }
    });

    return edges;
  }, [validDevices, devices, deviceMap, links, linksByDevice, filterType, filterValue, showInterfaces, selectedEdgeId, selectedNodeId, hoveredEdgeId, showTraffic, linkMetrics, lod, zoom, apRoleName]);
  return { validDevices, deviceMap, linkMap, linksByDevice, topoNodes, topoEdges };
}
