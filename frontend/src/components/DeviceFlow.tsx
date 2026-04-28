import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { 
  ReactFlow, 
  Background, 
  ConnectionLineType, 
  useReactFlow, 
  useStore, 
  OnNodesChange, 
  applyNodeChanges 
} from '@xyflow/react';
import { motion, AnimatePresence } from 'motion/react';
import '@xyflow/react/dist/style.css';

// Types and Config
import { Device, Link } from '../types';

// Custom Hooks
import { useTopologyData } from '../hooks/useTopologyData';
import { useTopologyLayout } from '../hooks/useTopologyLayout';
import { useTopologyMetrics } from '../hooks/useTopologyMetrics';

// Sub-components
import { DeviceNode } from './topology/DeviceNode';
import { ClusterNode } from './topology/ClusterNode';
import { GroupNode } from './topology/GroupNode';
import { TopologyEdge } from './topology/TopologyEdge';
import { EdgeTooltip } from './topology/EdgeTooltip';
import { DeviceTooltip } from './topology/DeviceTooltip';
import { ControlPanel } from './topology/ControlPanel';
import { ActionButtons } from './topology/ActionButtons';
import { ZoomControls } from './topology/ZoomControls';
import { PerformanceHUD } from './topology/PerformanceHUD';
import { CheckCircle2, AlertCircle } from 'lucide-react';

// Utils
import { getLODLevel } from '../utils/topology-utils';

const nodeTypes = {
  device: DeviceNode,
  cluster: ClusterNode,
  aggregate: GroupNode,
};

const edgeTypes = {
  topology: TopologyEdge,
  bezier: TopologyEdge,
  smoothstep: TopologyEdge,
  straight: TopologyEdge,
};


interface DeviceFlowProps {
  devices: Device[];
  links: Link[];
  siteId: string;
  availableVlans: string[];
  availablePrefixes: string[];
  prometheusEnabled?: boolean;
  debugEnabled?: boolean;
  apRoleName?: string;
}

export default function DeviceFlow({ 
  devices, 
  links, 
  siteId, 
  availableVlans, 
  availablePrefixes, 
  prometheusEnabled = false, 
  debugEnabled = false,
  apRoleName 
}: DeviceFlowProps) {
  // 1. Preferences & Selection State
  const [iconMode, setIconMode] = useState<'role' | 'vendor'>('role');
  const [iconStyle, setIconStyle] = useState<'simple' | 'fancy'>(
    (localStorage.getItem('nautobot-topology-style') as 'simple' | 'fancy') || 'fancy'
  );
  const [showInterfaces, setShowInterfaces] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'vlan' | 'protocol' | 'prefix'>('all');
  const [filterValue, setFilterValue] = useState('');
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pinnedEdgeId, setPinnedEdgeId] = useState<string | null>(null);
 
  const [hoveredEdge, setHoveredEdge] = useState<{ id: string; x: number; y: number } | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [hoveredDeviceId, setHoveredDeviceId] = useState<string | null>(null);
  const [hoveredDevicePos, setHoveredDevicePos] = useState<{ x: number, y: number } | null>(null);
  
  const tooltipTimeout = useRef<any>(null);
  
  // 2. React Flow Store Values
  const zoom = useStore((s: any) => s.transform[2]);
  const [lod, setLod] = useState(1);
  const [renderTime, setRenderTime] = useState<number>(0);
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  
  // 3. Custom Hooks for Logic
  const onDeviceHover = useCallback((id: string | null, pos?: { x: number, y: number }) => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    if (id) {
      setHoveredEdge(null);
      setHoveredEdgeId(null);
      setHoveredDeviceId(id);
      if (pos) setHoveredDevicePos(pos);
    } else {
      tooltipTimeout.current = setTimeout(() => setHoveredDeviceId(null), 300);
    }
  }, []);

  const { showTraffic } = useMemo(() => ({ showTraffic: prometheusEnabled }), [prometheusEnabled]); // Placeholder or actual state if needed
  // Note: Original code had a [showTraffic, setShowTraffic] state, but it wasn't clear if it was an external prop.
  // Actually, I'll add the showTraffic toggle back if it's missing.
  const [trafficEnabled, setTrafficEnabled] = useState(false);
  
  const { linkMetrics } = useTopologyMetrics({ showTraffic: trafficEnabled, siteId });

  const { topoNodes, topoEdges, deviceMap, linkMap } = useTopologyData({
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
    showTraffic: trafficEnabled,
    linkMetrics,
    zoom,
    onDeviceHover,
    apRoleName
  });

  const {
    nodes,
    setNodes,
    edges,
    isSaving,
    isLocked,
    hasUnsavedChanges,
    toggleLock,
    saveLayout,
    recalculateLayout,
    discardChanges,
    notification
  } = useTopologyLayout({ siteId, topoNodes, topoEdges });

  // 4. Effects
  useEffect(() => {
    const nextLod = getLODLevel(zoom);
    if (nextLod !== lod) {
      setLod(nextLod);
    }
  }, [zoom, lod]);

  useEffect(() => {
    localStorage.setItem('nautobot-topology-style', iconStyle);
  }, [iconStyle]);

  // Performance monitoring
  useEffect(() => {
    if (debugEnabled) {
      const start = performance.now();
      const timer = setTimeout(() => {
        setRenderTime(performance.now() - start);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [nodes, edges, debugEnabled]);

  // 5. Callbacks
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );

  const onEdgeMouseEnter = useCallback((event: React.MouseEvent, edge: any) => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    setHoveredDeviceId(null);
    setHoveredEdge({ id: edge.id, x: event.clientX, y: event.clientY });
    setHoveredEdgeId(edge.id);
  }, []);

  const onEdgeMouseLeave = useCallback(() => {
    tooltipTimeout.current = setTimeout(() => {
      setHoveredEdge(null);
      setHoveredEdgeId(null);
    }, 300);
  }, []);

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: any) => {
    const nextId = edge.id === pinnedEdgeId ? null : edge.id;
    setPinnedEdgeId(nextId);
    setSelectedEdgeId(nextId);
    if (!nextId) {
       setHoveredEdge(null);
       setHoveredEdgeId(null);
    }
  }, [pinnedEdgeId]);

  const onEdgeDoubleClick = useCallback((_event: React.MouseEvent, edge: any) => {
    const link = linkMap.get(edge.id);
    if (link?.nautobotUrl) {
      window.open(link.nautobotUrl, '_blank');
    }
  }, [linkMap]);

  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: any) => {
    const device = deviceMap.get(node.id);
    if (device?.nautobotUrl) {
      window.open(device.nautobotUrl, '_blank');
    }
  }, [deviceMap]);

  const onPaneClick = useCallback(() => {
    setHoveredEdge(null);
    setHoveredEdgeId(null);
    setSelectedEdgeId(null);
    setSelectedNodeId(null);
    setPinnedEdgeId(null);
  }, []);

  const handleResetZoom = () => fitView({ duration: 800, padding: 0.2 });

  // Filter Values
  const availableProtocols = useMemo(() => Array.from(new Set(devices.flatMap(d => d.protocols || []))).sort(), [devices]);
  const filteredAvailableValues = useMemo(() => {
    const values = filterType === 'vlan' ? availableVlans : filterType === 'protocol' ? availableProtocols : availablePrefixes;
    if (!filterSearchQuery) return values;
    return values.filter(v => v.toString().toLowerCase().includes(filterSearchQuery.toLowerCase()));
  }, [filterType, filterSearchQuery, availableVlans, availableProtocols, availablePrefixes]);

  return (
    <div className="w-full h-full bg-[#0f172a] relative rounded-3xl overflow-hidden">
      {debugEnabled && (
        <PerformanceHUD 
          renderTime={renderTime} 
          zoom={zoom} 
          nodesCount={nodes.length} 
          edgesCount={edges.length} 
          lodLevel={lod} 
        />
      )}

      <ControlPanel 
        filterType={filterType}
        setFilterType={setFilterType}
        filterValue={filterValue}
        setFilterValue={setFilterValue}
        filterSearchQuery={filterSearchQuery}
        setFilterSearchQuery={setFilterSearchQuery}
        filteredAvailableValues={filteredAvailableValues}
        iconMode={iconMode}
        setIconMode={setIconMode}
      />

      <ActionButtons 
        isLocked={isLocked}
        toggleLock={toggleLock}
        discardChanges={discardChanges}
        recalculateLayout={recalculateLayout}
        saveLayout={saveLayout}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {/* Save Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-12 left-1/2 z-[1100] px-6 py-3 rounded-2xl backdrop-blur-xl border flex items-center gap-3 shadow-2xl ${
              notification.type === 'success' 
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                : 'bg-rose-500/20 border-rose-500/30 text-rose-400'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-rose-400" />}
            <span className="text-xs font-bold uppercase tracking-widest">{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onPaneClick={onPaneClick}
        onNodeClick={(_evt, node) => setSelectedNodeId(node.id)}
        onNodeDoubleClick={onNodeDoubleClick}
        onInit={(instance) => {
          setTimeout(() => instance.fitView({ padding: 0.2, minZoom: 0.001 }), 300);
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}

        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.001 }}
        minZoom={0.001}
        maxZoom={2}
        colorMode="dark"
        nodesDraggable={!isLocked}
        nodesConnectable={false}
        onlyRenderVisibleElements={true}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={20} />
      </ReactFlow>

      <AnimatePresence>
        {hoveredEdge && (
          <EdgeTooltip 
            hoveredEdge={hoveredEdge}
            linkMap={linkMap}
            deviceMap={deviceMap}
            linkMetrics={linkMetrics}
            prometheusEnabled={prometheusEnabled}
            pinnedEdgeId={pinnedEdgeId}
            setHoveredEdge={setHoveredEdge}
            setHoveredEdgeId={setHoveredEdgeId}
            tooltipTimeout={tooltipTimeout}
          />
        )}
        {hoveredDeviceId && hoveredDevicePos && (
          <DeviceTooltip 
            hoveredDeviceId={hoveredDeviceId}
            hoveredDevicePos={hoveredDevicePos}
            deviceMap={deviceMap}
            iconStyle={iconStyle}
            setHoveredDeviceId={setHoveredDeviceId}
            tooltipTimeout={tooltipTimeout}
          />
        )}
      </AnimatePresence>

      <ZoomControls 
        zoomIn={zoomIn} 
        zoomOut={zoomOut} 
        handleResetZoom={handleResetZoom} 
      />
    </div>
  );
}