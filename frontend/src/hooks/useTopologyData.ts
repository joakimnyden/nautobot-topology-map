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
  hoveredEdgeId: string | null;
  showTraffic: boolean;
  linkMetrics: Record<string, any>;
  zoom: number;
  onDeviceHover: (id: string | null, pos?: { x: number, y: number }) => void;
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
  hoveredEdgeId,
  showTraffic,
  linkMetrics,
  zoom,
  onDeviceHover,
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
    // Groups
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
    // AP Stacking Logic
    const apNodesList = apiDevices.filter(d => isAP(d.role));
    const nonAPNodesList = apiDevices.filter(d => !isAP(d.role));
    
    const apStackGroups = new Map<string, Device[]>();
    const unconAPs: Device[] = [];
    
    apNodesList.forEach(ap => {
      const linksToAP = linksByDevice.get(ap.id) || [];
      let parentId: string | null = null;
      for (const l of linksToAP) {
        const otherId = String(l.source) === ap.id ? String(l.target) : String(l.source);
        const otherDevice = deviceMap.get(otherId);
        if (otherDevice && !isAP(otherDevice.role)) {
          parentId = otherId;
          break;
        }
      }
      
      if (parentId) {
        if (!apStackGroups.has(parentId)) apStackGroups.set(parentId, []);
        apStackGroups.get(parentId)!.push(ap);
      } else {
        unconAPs.push(ap);
      }
    });
    // Individual Devices
    nonAPNodesList.forEach(device => {
      let isHighlighted = false;
      if (filterValue) {
        if (filterType === 'vlan') isHighlighted = device.vlans?.some(v => v.toString() === query) || false;
        if (filterType === 'protocol') isHighlighted = device.protocols?.some(p => p.toLowerCase().includes(query)) || false;
        if (filterType === 'prefix') isHighlighted = device.prefixes?.some(p => p.includes(query)) || false;
        if (filterType === 'all') {
          isHighlighted = device.name.toLowerCase().includes(query) ||
            device.vlans?.some(v => v.toString() === query) ||
            device.protocols?.some(p => p.toLowerCase().includes(query)) || false;
        }
      }
      nodes.push({
        id: device.id,
        type: 'device',
        data: { device, isHighlighted, hasQuery: !!filterValue, iconMode, iconStyle, lod: lod, onHover: onDeviceHover },
        position: { x: 0, y: 0 },
      });
    });
    // AP Stacks
    apStackGroups.forEach((groupAPs, parentId) => {
      const parentDevice = deviceMap.get(parentId);
      if (groupAPs.length === 1) {
        const device = groupAPs[0];
        nodes.push({
          id: device.id,
          type: 'device',
          data: { device, isHighlighted: false, hasQuery: !!filterValue, iconMode, iconStyle, lod: lod, onHover: onDeviceHover },
          position: { x: 0, y: 0 },
        });
      } else {
        const stackId = `stack-${parentId}`;
        nodes.push({
          id: stackId,
          type: 'apStack',
          style: { background: 'transparent', border: 'none' },
          data: { 
            count: groupAPs.length, 
            parentName: parentDevice?.name, 
            devices: groupAPs,
            iconStyle,
            lod: lod
          },
          position: { x: 0, y: 0 },
        });
      }
    });
    if (unconAPs.length > 0) {
      nodes.push({
        id: 'stack-unconnected',
        type: 'apStack',
        style: { background: 'transparent', border: 'none' },
        data: { count: unconAPs.length, parentName: undefined, devices: unconAPs, iconStyle, lod },
        position: { x: 0, y: 0 },
      });
    }
    return nodes;
  }, [validDevices, devices, links, filterType, filterValue, iconMode, iconStyle, lod, deviceMap, linksByDevice, onDeviceHover]);
  // topoEdges calculation
  const topoEdges = useMemo(() => {
    const query = filterValue.toLowerCase();
    const edges: Edge[] = [];
    const apDevices = validDevices.filter(d => !d.type || d.type === 'device').filter(d => isAP(d.role));
    const apToParentMap = new Map<string, string>();
    
    apDevices.forEach(ap => {
      const linksToAP = linksByDevice.get(ap.id) || [];
      for (const l of linksToAP) {
        const otherId = String(l.source) === ap.id ? String(l.target) : String(l.source);
        const otherDevice = deviceMap.get(otherId);
        if (otherDevice && !isAP(otherDevice.role)) {
          apToParentMap.set(ap.id, otherId);
          break;
        }
      }
    });
    const apStacksCount = new Map<string, number>();
    apToParentMap.forEach((parentId) => {
      apStacksCount.set(parentId, (apStacksCount.get(parentId) || 0) + 1);
    });
    apStacksCount.forEach((count, parentId) => {
      if (count > 1) {
        const stackId = `stack-${parentId}`;
        edges.push({
          id: `edge-${stackId}`,
          source: parentId,
          target: stackId,
          type: 'smoothstep',
          label: `${count} APs`,
          style: { stroke: '#10b981', strokeWidth: 3, opacity: 0.8 },
          labelStyle: { fill: '#10b981', fontSize: 10, fontWeight: 700 },
          labelBgStyle: { fill: '#0f172a', fillOpacity: 0.95, rx: 4 },
        });
      }
    });
    links.forEach(link => {
      const sId = String(link.source);
      const tId = String(link.target);
      const sourceDev = deviceMap.get(sId);
      const targetDev = deviceMap.get(tId);
      if (!sourceDev || !targetDev) return;
      if (isAP(sourceDev.role)) {
        const parentId = apToParentMap.get(sId);
        if (parentId && (apStacksCount.get(parentId) || 0) > 1) return;
      }
      if (isAP(targetDev.role)) {
        const parentId = apToParentMap.get(tId);
        if (parentId && (apStacksCount.get(parentId) || 0) > 1) return;
      }
      if (links.length > 5000 && edges.length > 5000) return;
      let isEdgeHighlighted = link.id === hoveredEdgeId;
      if (filterValue) {
        if (filterType === 'vlan') isEdgeHighlighted = isEdgeHighlighted || (link.vlan?.toString() === query);
        if (filterType === 'protocol') isEdgeHighlighted = isEdgeHighlighted || (link.protocol?.toLowerCase().includes(query));
      }
      const isSelected = link.id === selectedEdgeId;
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
      edges.push({
        id: link.id,
        source: link.source as string,
        target: link.target as string,
        type: link.isPortChannel ? 'straight' : (links.length > 100 ? 'straight' : 'smoothstep'),
        hidden: links.length > 8000 && zoom < 0.2,
        animated: (link.id === hoveredEdgeId || isSelected || (isEdgeHighlighted && links.length < 500)) && !link.isPortChannel,
        label: links.length > 2000 ? undefined : label,
        labelStyle: {
          fill: isEdgeHighlighted ? '#fbbf24' : (isSelected ? '#3b82f6' : (link.type === 'physical' ? '#94a3b8' : (link.type === 'port-channel' ? '#a5b4fc' : '#10b981'))),
          fontSize: (showInterfaces || isSelected) ? 8 : 10,
          fontWeight: 800,
          fontFamily: 'var(--font-mono)'
        },
        labelBgStyle: { fill: '#0f172a', fillOpacity: 0.95, rx: 4 },
        style: {
          stroke: (showTraffic && linkMetrics[link.id]) 
            ? (linkMetrics[link.id].utilization < 50 ? '#10b981' : (linkMetrics[link.id].utilization < 80 ? '#fbbf24' : '#ef4444'))
            : (isEdgeHighlighted ? '#fbbf24' : (isSelected ? '#3b82f6' : (link.type === 'physical' ? '#475569' : (link.type === 'port-channel' ? '#818cf8' : '#10b981')))),
          strokeWidth: link.isPortChannel ? 5 : (isEdgeHighlighted ? 5 : (isSelected ? 4 : (link.type === 'physical' ? 2 : 1.5))),
          opacity: (filterValue || selectedEdgeId) && !isEdgeHighlighted && !isSelected ? 0.4 : 1,
          strokeDasharray: link.type === 'logical' ? '5,5' : 'none',
          filter: (link.type === 'port-channel' || isEdgeHighlighted || isSelected) 
            ? `drop-shadow(0 0 6px ${isEdgeHighlighted ? '#fbbf24' : (isSelected ? '#3b82f6' : '#818cf8')})` 
            : 'none',
        },
      });
    });
    return edges;
  }, [validDevices, devices, deviceMap, links, linksByDevice, filterType, filterValue, showInterfaces, selectedEdgeId, hoveredEdgeId, showTraffic, linkMetrics, lod, zoom]);
  return { validDevices, deviceMap, linkMap, linksByDevice, topoNodes, topoEdges };
}
