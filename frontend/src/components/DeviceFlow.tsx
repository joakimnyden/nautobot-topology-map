// @ts-ignore
import React, { useMemo, useState, useCallback, useEffect } from 'react';
// @ts-ignore
import { useReactFlow, ReactFlow, Background, ConnectionLineType, MarkerType, Edge, Node, Handle, Position, applyNodeChanges, OnNodesChange } from '@xyflow/react';
// @ts-ignore
import { motion, AnimatePresence } from 'motion/react';
// @ts-ignore
import '@xyflow/react/dist/style.css';
// @ts-ignore
import dagre from 'dagre';
// @ts-ignore
import * as d3 from 'd3';
// @ts-ignore
import { Device, Link, DeviceStatus } from '../types';
// @ts-ignore
import { Server, Cpu, Network, Shield, Save, Filter, X, Layout, ExternalLink, Lock, Unlock, Search, GitPullRequest, Box, Plus, Minus, RotateCcw } from 'lucide-react';
// @ts-ignore
import { getRoleConfig, getVendorLogo } from '../config/topologyConfig';

const nodeWidth = 80;
const nodeHeight = 80;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 150,
    ranksep: 200,
  });

  nodes.forEach((node) => {
    if (node.type === 'device') {
      dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    }
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.filter(n => n.type === 'device').map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    return {
      ...node,
      targetPosition: direction === 'LR' ? Position.Left : Position.Top,
      sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

const DeviceNode = React.memo(({ data }: { data: { device: Device; isHighlighted: boolean; hasQuery: boolean; iconMode: 'role' | 'vendor'; iconStyle: 'simple' | 'fancy' } }) => {
  const { device, isHighlighted, hasQuery, iconMode, iconStyle } = data;
  const [isHovered, setIsHovered] = useState(false);

  const roleConfig = getRoleConfig(device.role);

  const getIcon = (size = "w-6 h-6") => {
    const IconComponent = roleConfig.icon;
    const isFancy = iconStyle === 'fancy';

    if (iconMode === 'vendor' && device.vendor) {
      const logoUrl = getVendorLogo(device.vendor);
      if (logoUrl) {
        return (
          <div className={`${size} flex items-center justify-center overflow-hidden`}>
            <img
              src={logoUrl}
              alt={device.vendor}
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        );
      }
    }

    return (
      <IconComponent
        color={isFancy ? '#22d3ee' : undefined}
        className={`${size} ${isFancy ? 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]' : roleConfig.color}`}
      />
    );
  };

  return (
    <div
      className="relative flex flex-col items-center gap-2 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`w-14 h-14 rounded-2xl border transition-all duration-500 flex items-center justify-center p-3 relative overflow-hidden ${hasQuery && !isHighlighted ? 'opacity-20 scale-90 blur-[0.5px]' : 'opacity-100 scale-100'
        } ${iconStyle === 'fancy'
          ? 'bg-slate-900/40 backdrop-blur-xl shadow-2xl ring-1 ring-white/20 border-white/5'
          : 'bg-slate-900 shadow-sm border-slate-700/40'
        } ${isHighlighted ? 'border-blue-500/80 ring-2 ring-blue-500/30' : ''
        } hover:border-white/40 hover:bg-slate-800/80 transition-shadow`}>
        {/* Glass Highlight Overlay - Part of the Plate System */}
        {iconStyle === 'fancy' && (
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
        )}
        
        <Handle type="target" position={Position.Top} className="!opacity-0 !w-0 !h-0" />
        
        <div className={`transition-all duration-500 group-hover:scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]`}>
          {getIcon("w-7 h-7")}
        </div>

        <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0" />
      </div>

      <p className="text-[11px] font-bold text-slate-300 tracking-tight text-center truncate max-w-[100px] group-hover:text-white transition-colors">
        {device.name}
      </p>

      {/* Detail Tooltip */}
      <AnimatePresence>
        {isHovered && (
          <>
            {/* Hover Bridge - Ensures tooltip stays open while moving mouse */}
            <div className="absolute left-full top-0 w-8 h-20 -translate-y-4 z-[90]" />
            
            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.95 }}
              animate={{ opacity: 1, x: 20, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.95 }}
              className={`absolute left-full top-0 ml-4 z-[100] min-w-[240px] border border-slate-700/50 rounded-2xl p-4 shadow-2xl pointer-events-auto ${iconStyle === 'fancy' ? 'bg-slate-900/95 backdrop-blur-2xl' : 'bg-slate-950'}`}
            >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  {device.name}
                  <div className={`w-2 h-2 rounded-full ${device.status === DeviceStatus.ACTIVE ? `bg-emerald-500 ${iconStyle === 'fancy' ? 'shadow-[0_0_8px_rgba(16,185,129,0.4)]' : ''}` : 'bg-rose-500'}`} />
                </h3>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">{device.role}</p>
              </div>
              <div className={`p-1.5 rounded-lg ${roleConfig.bgColor} border ${roleConfig.borderColor}`}>
                {getIcon("w-4 h-4")}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Primary IP</span>
                <span className="text-xs font-mono text-blue-400">{device.primaryIp || 'No IP Assigned'}</span>
              </div>

              {device.vendor && (
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Manufacturer</span>
                  <span className="text-xs text-slate-200">{device.vendor}</span>
                </div>
              )}

              {(device.vlans?.length ?? 0) > 0 && (
                <div className="flex flex-col gap-1 select-none">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">VLANs ({device.vlans?.length})</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {device.vlans?.slice(0, 5).map(v => (
                      <span key={v} className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20 text-[9px] font-mono">
                        {v.split(' - ')[0]}
                      </span>
                    ))}
                    {(device.vlans?.length ?? 0) > 5 && <span className="text-[9px] text-slate-500">+{device.vlans!.length - 5} more</span>}
                  </div>
                </div>
              )}

              {device.nautobotUrl && (
                <div className="pt-2 mt-2 border-t border-slate-800/50">
                  <a 
                    href={device.nautobotUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[9px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-2.5 h-2.5" /> View in Nautobot
                  </a>
                </div>
              )}
            </div>
            
            {/* Subtle Tooltip Arrow */}
            <div className="absolute left-[-4px] top-8 w-2 h-2 bg-slate-900 border-l border-b border-slate-700/50 rotate-45" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  </div>
)});

const nodeTypes = {
  device: DeviceNode,
};

interface DeviceFlowProps {
  devices: Device[];
  links: Link[];
  siteId: string;
  availableVlans: string[];
  availablePrefixes: string[];
  prometheusEnabled?: boolean;
}

export default function DeviceFlow({ devices, links, siteId, availableVlans, availablePrefixes, prometheusEnabled = false }: DeviceFlowProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'vlan' | 'protocol' | 'prefix'>('all');
  const [filterValue, setFilterValue] = useState('');
  const [showInterfaces, setShowInterfaces] = useState(false);
  const [iconMode, setIconMode] = useState<'role' | 'vendor'>('role');
  const [iconStyle, setIconStyle] = useState<'simple' | 'fancy'>(
    (localStorage.getItem('nautobot-topology-style') as 'simple' | 'fancy') || 'fancy'
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [nodesBeforeUnlock, setNodesBeforeUnlock] = useState<Node[] | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ id: string; x: number; y: number } | null>(null);
  const { zoomIn, zoomOut, setViewport, getViewport, fitView } = useReactFlow();

  const handleResetZoom = () => {
    fitView({ duration: 800, padding: 0.2 });
  };

  // Extract unique values for filters
  const availableProtocols = useMemo(() => Array.from(new Set(devices.flatMap(d => d.protocols || []))).sort(), [devices]);

  const filteredAvailableValues = useMemo(() => {
    const values = filterType === 'vlan' ? availableVlans : filterType === 'protocol' ? availableProtocols : availablePrefixes;
    if (!filterSearchQuery) return values;
    return values.filter(v => v.toString().toLowerCase().includes(filterSearchQuery.toLowerCase()));
  }, [filterType, filterSearchQuery, availableVlans, availableProtocols, availablePrefixes]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      const hasPositionChange = changes.some(c => c.type === 'position');
      if (hasPositionChange && !isLocked) {
        setHasUnsavedChanges(true);
      }
    },
    [isLocked]
  );
  // Traffic toggle and metrics state
  const [showTraffic, setShowTraffic] = useState(false);
  const [linkMetrics, setLinkMetrics] = useState<Record<string, { tx: number; rx: number; utilization: number }>>({});

  // Fetch metrics when showTraffic is enabled with polling
  useEffect(() => {
    if (!showTraffic) {
      setLinkMetrics({});
      return;
    }

    const fetchMetrics = () => {
      fetch(`/api/plugins/nautobot_topology/topology/${siteId}/metrics/`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            setLinkMetrics(data.data.metrics || {});
          }
        })
        .catch(err => console.error('Error fetching metrics:', err));
    };

    fetchMetrics(); // Initial fetch
    const interval = setInterval(fetchMetrics, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [showTraffic, siteId]);

  // Updated onEdgeClick to show metrics if available
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id === selectedEdgeId ? null : edge.id);
  }, [selectedEdgeId]);

  const onEdgeMouseEnter = useCallback((event: React.MouseEvent, edge: Edge) => {
    setHoveredEdge({ id: edge.id, x: event.clientX, y: event.clientY });
  }, []);

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdge(null);
  }, []);

  const formatThroughput = (bps: number) => {
    if (bps === 0) return '0 bps';
    const k = 1000;
    const sizes = ['bps', 'kbps', 'Mbps', 'Gbps'];
    const i = Math.floor(Math.log(bps) / Math.log(k));
    return parseFloat((bps / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Adjust edge styling based on utilization
  const getEdgeColor = (link: Link) => {
    if (!showTraffic) return undefined;
    const metrics = linkMetrics[link.id];
    if (!metrics) return undefined;
    const util = metrics.utilization;
    if (util < 50) return '#10b981'; // green
    if (util < 80) return '#fbbf24'; // yellow
    return '#ef4444'; // red
  };

  // In edge creation, replace stroke logic with utilization color when applicable
  // (see lines around 322-324)


  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    const device = node.data.device as Device;
    if (device.nautobotUrl) {
      window.open(device.nautobotUrl, '_blank');
    }
  }, []);

  const onEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    const link = links.find(l => l.id === edge.id);
    if (link?.nautobotUrl) {
      window.open(link.nautobotUrl, '_blank');
    }
  }, [links]);

  const saveLayout = async () => {
    setIsSaving(true);
    try {
      // In a real app, this would be a real API call
      // await fetch(`/api/plugins/nexus/topology/${siteId}/layout`, { ... });

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));

      setHasUnsavedChanges(false);
      alert('Layout saved successfully!');
    } catch (error) {
      console.error('Failed to save layout:', error);
      alert('Failed to save layout.');
    } finally {
      setIsSaving(false);
    }
  };

  const recalculateLayout = useCallback(() => {
    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges);
    setNodes([...layoutedNodes]);
  }, [nodes, edges]);

  const toggleLock = async () => {
    if (!isLocked) {
      if (hasUnsavedChanges) {
        const result = window.confirm('You have unsaved layout changes. Click OK to SAVE them, or Cancel to DISCARD them before locking.');
        if (result) {
          await saveLayout();
        } else {
          // Revert to initial nodes if they exist
          if (nodesBeforeUnlock) {
            setNodes(nodesBeforeUnlock);
          }
          setHasUnsavedChanges(false);
        }
      }
      setIsLocked(true);
      setNodesBeforeUnlock(null);
    } else {
      // Capture current state before unlocking
      setNodesBeforeUnlock([...nodes]);
      setIsLocked(false);
    }
  };

  const discardChanges = () => {
    if (nodesBeforeUnlock) {
      setNodes(nodesBeforeUnlock);
    }
    setHasUnsavedChanges(false);
    setIsLocked(true);
    setNodesBeforeUnlock(null);
  };

  // 1. Memoize raw nodes and edges creation from devices/links
  const [layoutInfo, setLayoutInfo] = useState<any>(null);

  // Fetch layout once on mount or site change
  useEffect(() => {
    fetch(`/api/plugins/nautobot_topology/${siteId}/layout`)
      .then(res => res.json())
      .then(data => setLayoutInfo(data.data || data))
      .catch(err => console.error('Failed to load layout:', err));
  }, [siteId]);

  const { initialNodes, initialEdges } = useMemo(() => {
    const query = filterValue.toLowerCase();

    const nodes: Node[] = devices.map((device) => {
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

      return {
        id: device.id,
        type: 'device',
        data: { device, isHighlighted, hasQuery: !!filterValue, iconMode, iconStyle },
        position: { x: 0, y: 0 },
      };
    });

    const edges: Edge[] = links.map((link) => {
      let isHighlighted = false;
      if (filterValue) {
        if (filterType === 'vlan') isHighlighted = link.vlan?.toString() === query || false;
        if (filterType === 'protocol') isHighlighted = link.protocol?.toLowerCase().includes(query) || false;
      }

      const isSelected = link.id === selectedEdgeId;

      let label = link.protocol;
      if (showInterfaces || isSelected) {
        const sourcePort = link.isPortChannel
          ? `${link.sourceInterface} (${link.portChannelMembers?.join(', ')})`
          : link.sourceInterface;
        const targetPort = link.isPortChannel
          ? `${link.targetInterface} (${link.portChannelMembers?.join(', ')})`
          : link.targetInterface;

        label = isSelected
          ? `${sourcePort} ↔ ${targetPort}${link.nautobotUrl ? ' 🔗' : ''}`
          : `${link.sourceInterface || ''} ↔ ${link.targetInterface || ''}`;
      }

      return {
        id: link.id,
        source: link.source as string,
        target: link.target as string,
        type: 'smoothstep',
        animated: (isHighlighted || isSelected) && !link.isPortChannel,
        label: label,
        labelStyle: {
          fill: isSelected ? '#3b82f6' : (isHighlighted ? '#fbbf24' : (link.type === 'physical' ? '#94a3b8' : '#10b981')),
          fontSize: (showInterfaces || isSelected) ? 8 : 10,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)'
        },
        labelBgStyle: { fill: '#0f172a', fillOpacity: 0.95, rx: 4 },
        style: {
          stroke: getEdgeColor(link) ?? (isSelected ? '#3b82f6' : (isHighlighted ? '#fbbf24' : (link.type === 'physical' ? '#475569' : '#10b981'))),
          strokeWidth: link.isPortChannel ? 5 : (isSelected ? 4 : (isHighlighted ? 3 : (link.type === 'physical' ? 2 : 1.5))),
          opacity: (filterValue || selectedEdgeId) && !isHighlighted && !isSelected ? 0.2 : 1,
          strokeDasharray: link.type === 'logical' ? '5,5' : 'none',
        },
      };
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [devices, links, filterType, filterValue, showInterfaces, iconMode, iconStyle, selectedEdgeId, showTraffic, linkMetrics]);

  // Apply layout (either from saved state or dagre)
  useEffect(() => {
    if (initialNodes.length === 0) return;

    let finalNodes = initialNodes;
    if (layoutInfo?.nodes && layoutInfo.nodes.length > 0) {
      finalNodes = initialNodes.map(node => {
        const saved = layoutInfo.nodes.find((n: any) => n.id === node.id);
        if (saved) return { ...node, position: saved.position };
        return node;
      });
    } else {
      const { nodes: layoutedNodes } = getLayoutedElements(initialNodes, initialEdges);
      finalNodes = layoutedNodes;
    }

    setNodes(finalNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, layoutInfo]);

  return (
    <div className="w-full h-full bg-[#0f172a] relative rounded-3xl overflow-hidden">
      {/* Control Panel - Top Right (Offset from Site Header) */}
      <div className="absolute top-28 right-8 z-20 flex flex-col gap-3 items-end">
        {/* Filter Type Selector */}
        <div className="flex gap-2">
          {['all', 'vlan', 'protocol', 'prefix'].map(type => (
            <button
              key={type}
              onClick={() => { setFilterType(type as any); setFilterValue(''); }}
              className={`px-3 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 border ${filterType === type ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800/80 backdrop-blur-md border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80 shadow-xl'}`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Filter Value Selector - Scrollable for many networks */}
        {filterType !== 'all' && (
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-700/50 rounded-[2rem] p-4 shadow-2xl flex flex-col gap-3 w-[340px] max-h-[450px] animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Box className="w-3 h-3" /> Available {filterType}s
              </span>
              {filterValue && (
                <button onClick={() => setFilterValue('')} className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            {/* Search Input for values */}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
              <input
                type="text"
                placeholder={`Filter ${filterType}s...`}
                value={filterSearchQuery}
                onChange={(e) => setFilterSearchQuery(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl pl-9 pr-4 py-2 text-[11px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 overflow-y-auto pr-1 custom-scrollbar max-h-[300px]">
              {filteredAvailableValues.map(val => (
                <button
                  key={val}
                  onClick={() => setFilterValue(val.toString())}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-mono transition-all border duration-200 ${filterValue === val.toString()
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800/40 border-slate-700/30 text-slate-400 hover:bg-slate-700/50 hover:border-slate-600 hover:text-slate-200'}`}
                >
                  {val}
                </button>
              ))}
              {filteredAvailableValues.length === 0 && (
                <div className="w-full py-8 text-center">
                  <p className="text-[11px] text-slate-500 italic">No matching {filterType}s found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Visibility & Icon Toggles */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowInterfaces(!showInterfaces)}
            className={`flex items-center justify-center gap-3 px-4 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 border ${showInterfaces ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 text-shadow-sm' : 'bg-slate-800/80 backdrop-blur-md border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80 shadow-xl'}`}
          >
            <Filter className={`w-3.5 h-3.5 transition-transform duration-300 ${showInterfaces ? 'rotate-180' : ''}`} /> {showInterfaces ? 'Hide Ports' : 'Show Ports'}
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={() => setIconMode('role')}
              className={`flex-1 px-3 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 border ${iconMode === 'role' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800/80 backdrop-blur-md border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80 shadow-xl'}`}
            >
              Role
            </button>
            <button
              onClick={() => setIconMode('vendor')}
              className={`flex-1 px-3 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 border ${iconMode === 'vendor' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800/80 backdrop-blur-md border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80 shadow-xl'}`}
            >
              Vendor
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons - Bottom Right (Offset from zoom controls) */}
      <div className="absolute bottom-8 right-24 z-20 flex gap-2">
        <button
          onClick={toggleLock}
          className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-xs shadow-2xl transition-all duration-300 border ${isLocked
            ? 'bg-slate-800/80 backdrop-blur-md text-slate-400 border-slate-700/50 hover:bg-slate-700/80 hover:text-slate-200'
            : 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20 hover:bg-emerald-500 scale-105'
            }`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isLocked ? 'locked' : 'unlocked'}
              initial={{ scale: 0.8, opacity: 0, rotate: -45 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.8, opacity: 0, rotate: 45 }}
              transition={{ duration: 0.2 }}
            >
              {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </motion.div>
          </AnimatePresence>
          <span className="tracking-widest uppercase">{isLocked ? 'Topology Locked' : 'Layout Mode'}</span>
        </button>

        {!isLocked && (
          <div className="flex items-center gap-3 animate-in slide-in-from-right-8 duration-500">
            <button
              onClick={discardChanges}
              className="flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl font-bold text-xs transition-all border border-red-500/20 hover:border-red-500/40 shadow-xl"
            >
              <X className="w-4 h-4" /> Discard
            </button>
            <button
              onClick={recalculateLayout}
              className="flex items-center gap-2 px-6 py-3 bg-slate-800/80 hover:bg-slate-700/80 backdrop-blur-md text-slate-300 rounded-2xl font-bold text-xs transition-all border border-slate-700/50 shadow-xl"
            >
              <Layout className="w-4 h-4" /> Layout
            </button>
            <button
              onClick={saveLayout}
              disabled={isSaving}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-bold text-xs shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgeClick={onEdgeClick}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        minZoom={0.05}
        maxZoom={1.5}
        colorMode="dark"
        nodesDraggable={!isLocked}
        nodesConnectable={false}
        elementsSelectable={true}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={20} />
      </ReactFlow>

      {/* Edge Metrics Tooltip */}
      {hoveredEdge && (
        <div
          className="fixed pointer-events-none z-[100] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-3 shadow-2xl flex flex-col gap-2 min-w-[200px]"
          style={{ left: hoveredEdge.x + 20, top: hoveredEdge.y - 20 }}
        >
          {(() => {
            const link = links.find(l => l.id === hoveredEdge.id);
            const metrics = linkMetrics[hoveredEdge.id];
            if (!link) return null;

            return (
              <>
                <div className="flex justify-between items-center border-b border-slate-700/50 pb-2 mb-1">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1">
                    <Network className="w-3 h-3" /> {link.type} Link
                  </span>
                  {prometheusEnabled && metrics && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${metrics.utilization < 50 ? 'bg-emerald-500/10 text-emerald-400' :
                      metrics.utilization < 80 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                      {metrics.utilization.toFixed(1)}% Load
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[9px] text-slate-500 uppercase tracking-tighter truncate max-w-[80px]">{link.sourceInterface}</span>
                    <div className="h-px flex-1 bg-slate-700/30 relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] text-slate-600">↔</div>
                    </div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-tighter truncate max-w-[80px]">{link.targetInterface}</span>
                  </div>

                  {prometheusEnabled && (
                    metrics ? (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="bg-slate-800/50 p-1.5 rounded border border-slate-700/30">
                          <p className="text-[8px] text-slate-500 uppercase font-bold">TX Rate</p>
                          <p className="text-[10px] font-mono text-emerald-400">{formatThroughput(metrics.tx)}</p>
                        </div>
                        <div className="bg-slate-800/50 p-1.5 rounded border border-slate-700/30">
                          <p className="text-[8px] text-slate-500 uppercase font-bold">RX Rate</p>
                          <p className="text-[10px] font-mono text-blue-400">{formatThroughput(metrics.rx)}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 italic py-1 text-center">No traffic data available</p>
                    )
                  )}

                  {link.isPortChannel && (
                    <div className="mt-1 pt-2 border-t border-slate-700/50">
                      <div className="flex items-center justify-between text-[8px] text-amber-400 font-bold uppercase mb-1">
                        <span className="flex items-center gap-1"><GitPullRequest className="w-2.5 h-2.5" /> Port-Channel</span>
                        <span>{link.portChannelMembers?.length || 0} Members</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {link.portChannelMembers?.map(m => (
                          <span key={m} className="text-[7px] px-1 bg-slate-800 text-slate-400 rounded border border-slate-700">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Custom Zoom Controls - Bottom Left */}
      <div className="absolute bottom-8 left-8 z-20 flex flex-col gap-2">
        <button
          onClick={() => zoomIn({ duration: 300 })}
          className="p-3 bg-slate-800/80 backdrop-blur-md hover:bg-slate-700/80 text-slate-300 rounded-2xl border border-slate-700/50 shadow-xl transition-all"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => zoomOut({ duration: 300 })}
          className="p-3 bg-slate-800/80 backdrop-blur-md hover:bg-slate-700/80 text-slate-300 rounded-2xl border border-slate-700/50 shadow-xl transition-all"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetZoom}
          className="p-3 bg-slate-800/80 backdrop-blur-md hover:bg-slate-700/80 text-slate-300 rounded-2xl border border-slate-700/50 shadow-xl transition-all"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
