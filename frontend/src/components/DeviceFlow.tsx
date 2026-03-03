import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useReactFlow, ReactFlow, Background, ConnectionLineType, MarkerType, Edge, Node, Handle, Position, applyNodeChanges, OnNodesChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import * as d3 from 'd3';
import { Device, Link, DeviceStatus } from '../types';
import { Server, Cpu, Network, Shield, Save, Filter, X, Layout, ExternalLink, Lock, Unlock, Search, GitPullRequest, Box, Plus, Minus, RotateCcw } from 'lucide-react';
import { getRoleConfig, getVendorLogo } from '../config/topologyConfig';

const nodeWidth = 220;
const nodeHeight = 100;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: 150,
    ranksep: 200,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
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

  return { nodes: layoutedNodes, edges };
};

const DeviceNode = ({ data }: { data: { device: Device; isHighlighted: boolean; hasQuery: boolean; iconMode: 'role' | 'vendor' } }) => {
  const { device, isHighlighted, hasQuery, iconMode } = data;
  
  const getIcon = () => {
    const roleConfig = getRoleConfig(device.role);
    const IconComponent = roleConfig.icon;
    
    if (iconMode === 'vendor' && device.vendor) {
      const logoUrl = getVendorLogo(device.vendor);
      if (logoUrl) {
        return (
          <div className="w-5 h-5 flex items-center justify-center overflow-hidden">
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

    return <IconComponent className={`w-5 h-5 ${roleConfig.color}`} />;
  };

  return (
    <div className={`px-4 py-3 rounded-lg border bg-[#1e293b] shadow-lg min-w-[200px] transition-all group ${
      hasQuery && !isHighlighted ? 'opacity-20 scale-95' : 'opacity-100 scale-100'
    } ${
      isHighlighted ? 'border-amber-500 ring-2 ring-amber-500/20' : (device.status === DeviceStatus.ACTIVE ? 'border-slate-700' : 'border-red-500/50')
    } hover:border-blue-500/50`}>
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-2 !h-2 !border-none" />
      
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-800 rounded border border-slate-700 group-hover:bg-blue-500/10 transition-colors">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-100 truncate">{device.name}</p>
            {device.nautobotUrl && (
              <a 
                href={device.nautobotUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-blue-400 transition-colors ml-1"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest truncate">{device.role}</p>
            {device.vendor && (
              <span className="text-[8px] px-1 bg-slate-800 text-slate-500 rounded border border-slate-700">{device.vendor}</span>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <span className="text-[9px] font-mono text-slate-500">{device.primaryIp}</span>
          <div className={`w-1.5 h-1.5 rounded-full ${
            device.status === DeviceStatus.ACTIVE ? 'bg-emerald-500' : 'bg-red-500'
          }`} />
        </div>
        {(isHighlighted || !hasQuery) && (
          <div className="flex flex-wrap gap-1 mt-1">
            {device.vlans?.slice(0, 3).map(v => (
              <span key={v} className="text-[8px] px-1 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">V{v}</span>
            ))}
            {device.protocols?.slice(0, 2).map(p => (
              <span key={p} className="text-[8px] px-1 bg-slate-800 text-slate-400 rounded border border-slate-700">{p}</span>
            ))}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-2 !h-2 !border-none" />
    </div>
  );
};

const nodeTypes = {
  device: DeviceNode,
};

interface DeviceFlowProps {
  devices: Device[];
  links: Link[];
  siteId: string;
}

export default function DeviceFlow({ devices, links, siteId }: DeviceFlowProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'vlan' | 'protocol' | 'prefix'>('all');
  const [filterValue, setFilterValue] = useState('');
  const [showInterfaces, setShowInterfaces] = useState(false);
  const [iconMode, setIconMode] = useState<'role' | 'vendor'>('role');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [initialNodes, setInitialNodes] = useState<Node[] | null>(null);
  const { zoomIn, zoomOut, setViewport, getViewport, fitView } = useReactFlow();

  const handleResetZoom = () => {
    fitView({ duration: 800, padding: 0.2 });
  };

  // Extract unique values for filters
  const availableVlans = useMemo(() => Array.from(new Set(devices.flatMap(d => d.vlans || []))).sort((a, b) => a - b), [devices]);
  const availableProtocols = useMemo(() => Array.from(new Set(devices.flatMap(d => d.protocols || []))).sort(), [devices]);
  const availablePrefixes = useMemo(() => Array.from(new Set(devices.flatMap(d => d.prefixes || []))).sort(), [devices]);

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

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id === selectedEdgeId ? null : edge.id);
  }, [selectedEdgeId]);

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
          if (initialNodes) {
            setNodes(initialNodes);
          }
          setHasUnsavedChanges(false);
        }
      }
      setIsLocked(true);
      setInitialNodes(null);
    } else {
      // Capture current state before unlocking
      setInitialNodes([...nodes]);
      setIsLocked(false);
    }
  };

  const discardChanges = () => {
    if (initialNodes) {
      setNodes(initialNodes);
    }
    setHasUnsavedChanges(false);
    setIsLocked(true);
    setInitialNodes(null);
  };

  useEffect(() => {
    const loadLayout = async () => {
      const query = filterValue.toLowerCase();
      
      const initialNodes: Node[] = devices.map((device) => {
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
          data: { device, isHighlighted, hasQuery: !!filterValue, iconMode },
          position: { x: 0, y: 0 },
        };
      });

      const initialEdges: Edge[] = links.map((link) => {
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
          // Only animate if highlighted or selected
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
            stroke: isSelected ? '#3b82f6' : (isHighlighted ? '#fbbf24' : (link.type === 'physical' ? '#475569' : '#10b981')), 
            strokeWidth: link.isPortChannel ? 5 : (isSelected ? 4 : (isHighlighted ? 3 : (link.type === 'physical' ? 2 : 1.5))),
            opacity: (filterValue || selectedEdgeId) && !isHighlighted && !isSelected ? 0.2 : 1,
            strokeDasharray: link.type === 'logical' ? '5,5' : 'none',
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isSelected ? '#3b82f6' : (isHighlighted ? '#fbbf24' : (link.type === 'physical' ? '#475569' : '#10b981')),
          },
        };
      });

      try {
        const response = await fetch(`/api/plugins/nexus/topology/${siteId}/layout`);
        const savedLayout = await response.json();
        
        if (savedLayout.nodes && savedLayout.nodes.length > 0) {
          const nodesWithSavedPos = initialNodes.map(node => {
            const saved = savedLayout.nodes.find((n: any) => n.id === node.id);
            if (saved) return { ...node, position: saved.position };
            return node;
          });
          setNodes(nodesWithSavedPos);
        } else {
          const { nodes: layoutedNodes } = getLayoutedElements(initialNodes, initialEdges);
          setNodes(layoutedNodes);
        }
        setEdges(initialEdges);
      } catch (error) {
        const { nodes: layoutedNodes } = getLayoutedElements(initialNodes, initialEdges);
        setNodes(layoutedNodes);
        setEdges(initialEdges);
      }
    };

    loadLayout();
  }, [devices, links, siteId, filterType, filterValue, showInterfaces, iconMode, selectedEdgeId]);

  return (
    <div className="w-full h-full bg-[#0f172a] relative">
      {/* Control Panel - Top Right (Offset from Site Header) */}
      <div className="absolute top-28 right-8 z-20 flex flex-col gap-3 items-end">
        {/* Filter Type Selector */}
        <div className="flex bg-[#1e293b] border border-slate-700 rounded-xl p-1 shadow-2xl">
          {['all', 'vlan', 'protocol', 'prefix'].map(type => (
            <button 
              key={type}
              onClick={() => { setFilterType(type as any); setFilterValue(''); }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filterType === type ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Filter Value Selector - Scrollable for many networks */}
        {filterType !== 'all' && (
          <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-3 shadow-2xl flex flex-col gap-2 w-[320px] max-h-[400px]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Available {filterType}s</span>
              {filterValue && (
                <button onClick={() => setFilterValue('')} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            
            {/* Search Input for values */}
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
              <input 
                type="text"
                placeholder={`Search ${filterType}s...`}
                value={filterSearchQuery}
                onChange={(e) => setFilterSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-[10px] text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="flex flex-wrap gap-1 overflow-y-auto pr-1 custom-scrollbar">
              {filteredAvailableValues.map(val => (
                <button
                  key={val}
                  onClick={() => setFilterValue(val.toString())}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-all border ${filterValue === val.toString() ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                >
                  {val}
                </button>
              ))}
              {filteredAvailableValues.length === 0 && (
                <p className="text-[10px] text-slate-500 italic py-2">No matches found</p>
              )}
            </div>
          </div>
        )}

        {/* Visibility & Icon Toggles */}
        <div className="flex flex-col gap-2 bg-[#1e293b] border border-slate-700 rounded-xl p-1 shadow-2xl">
          <button 
            onClick={() => setShowInterfaces(!showInterfaces)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${showInterfaces ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Filter className="w-3 h-3" /> {showInterfaces ? 'Hide Ports' : 'Show Ports'}
          </button>
          <div className="h-px bg-slate-700 mx-2" />
          <div className="flex p-0.5">
            <button 
              onClick={() => setIconMode('role')}
              className={`flex-1 px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest transition-all ${iconMode === 'role' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Role Icons
            </button>
            <button 
              onClick={() => setIconMode('vendor')}
              className={`flex-1 px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest transition-all ${iconMode === 'vendor' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Vendor Icons
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons - Bottom Right (Offset from zoom controls) */}
      <div className="absolute bottom-8 right-24 z-20 flex gap-2">
        <button 
          onClick={toggleLock}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs shadow-xl transition-all border ${
            isLocked ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-emerald-600 text-white border-emerald-500'
          }`}
        >
          {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          {isLocked ? 'Press Unlock' : 'Lock'}
        </button>

        {!isLocked && (
          <>
            <button 
              onClick={discardChanges}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-red-900/40 text-red-400 rounded-xl font-bold text-xs shadow-xl transition-all border border-slate-700 hover:border-red-500/50"
            >
              <X className="w-4 h-4" /> Discard
            </button>
            <button 
              onClick={recalculateLayout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs shadow-xl transition-all border border-slate-700"
            >
              <Layout className="w-4 h-4" /> Auto Layout
            </button>
            <button 
              onClick={saveLayout}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-xl transition-all"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Layout'}
            </button>
          </>
        )}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgeClick={onEdgeClick}
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
      >
        <Background color="#1e293b" gap={20} />
      </ReactFlow>

      {/* Custom Zoom Controls - Bottom Left */}
      <div className="absolute bottom-8 left-8 z-20 flex flex-col gap-2">
        <button 
          onClick={() => zoomIn({ duration: 300 })}
          className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 shadow-xl transition-all"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button 
          onClick={() => zoomOut({ duration: 300 })}
          className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 shadow-xl transition-all"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button 
          onClick={handleResetZoom}
          className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 shadow-xl transition-all"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
