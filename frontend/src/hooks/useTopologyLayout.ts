import { useState, useEffect, useCallback, useRef } from 'react';
import { Node, Edge, useReactFlow } from '@xyflow/react';
import { getLayoutedElements } from '../utils/topology-utils';
interface UseTopologyLayoutProps {
  siteId: string;
  topoNodes: Node[];
  topoEdges: Edge[];
}
export function useTopologyLayout({ siteId, topoNodes, topoEdges }: UseTopologyLayoutProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [nodesBeforeUnlock, setNodesBeforeUnlock] = useState<Node[] | null>(null);
  const [layoutInfo, setLayoutInfo] = useState<any>(null);
  
  const { fitView } = useReactFlow();
  const hasAppliedInitialLayout = useRef(false);
  const lastSiteId = useRef(siteId);
  // Reset layout flag when site changes
  if (lastSiteId.current !== siteId) {
    hasAppliedInitialLayout.current = false;
    lastSiteId.current = siteId;
    if (isLayoutApplied) setIsLayoutApplied(false);
  }
  // Fetch layout once on mount or site change
  useEffect(() => {
    fetch(`/api/plugins/nautobot_topology/topology/${siteId}/layout/`)
      .then(res => res.json())
      .then(data => setLayoutInfo(data.data || data))
      .catch(err => console.error('Failed to load layout:', err));
  }, [siteId]);
  const [isLayoutApplied, setIsLayoutApplied] = useState(false);

  // Layout synchronization logic
  useEffect(() => {
    if (topoNodes.length === 0) return;
    
    // Only apply saved/computed layout once per site change, 
    // but wait until we have layoutInfo (or it's confirmed empty)
    if (!isLayoutApplied) {
      if (layoutInfo === null) return; // Still waiting for fetch

      console.log(`[Layout] Applying initial layout for ${topoNodes.length} nodes...`);
      let finalNodes = topoNodes;
      
      const hasSavedPositions = layoutInfo && Object.keys(layoutInfo).length > 0 && !layoutInfo.nodes;
      const hasSavedArray = layoutInfo?.nodes && layoutInfo.nodes.length > 0;

      if (hasSavedPositions) {
        // Flat object format: { node_id: { x, y } }
        finalNodes = topoNodes.map(node => {
          const saved = layoutInfo[node.id];
          if (saved) return { ...node, position: saved };
          return node;
        });
      } else if (hasSavedArray) {
        // Legacy array format
        finalNodes = topoNodes.map(node => {
          const saved = layoutInfo.nodes.find((n: any) => n.id === node.id);
          if (saved) return { ...node, position: saved.position };
          return node;
        });
      } else {
        // No saved layout, compute new one
        if (topoNodes.length > 500) {
          // High-density Grid Layout implementation
          const groupNodes = topoNodes.filter(n => n.type === 'aggregate' || n.type === 'apStack');
          const standardNodes = topoNodes.filter(n => n.type !== 'aggregate' && n.type !== 'apStack');
          const cols = Math.ceil(Math.sqrt(standardNodes.length || 1));
          const spacing = 500;
          
          const mappedStandard = standardNodes.map((node, i) => ({
            ...node,
            position: {
              x: ((i % cols) - cols / 2) * spacing,
              y: (Math.floor(i / cols) - cols / 2) * spacing
            }
          }));
          
          const mappedGroups = groupNodes.map((node, i) => ({
            ...node,
            position: {
              x: (cols / 2 + 2) * spacing,
              y: (i - Math.floor(groupNodes.length / 2)) * 800
            }
          }));
          
          finalNodes = [...mappedStandard, ...mappedGroups];
        } else {
          const { nodes: layoutedNodes } = getLayoutedElements(topoNodes, topoEdges, 'TB');
          const maxX = Math.max(...layoutedNodes.filter(n => topoEdges.some(e => e.source === n.id || e.target === n.id)).map(n => n.position.x), 0);
          const groupStartX = Math.max(800, maxX + 800);
          let groupIdx = 0;
          
          finalNodes = layoutedNodes.map(node => {
            if ((node.type === 'aggregate' || node.type === 'apStack') && !topoEdges.some(e => e.source === node.id || e.target === node.id)) {
              return { ...node, position: { x: groupStartX, y: (groupIdx++) * 800 } };
            }
            return node;
          });
        }
      }
      setNodes(finalNodes);
      setEdges(topoEdges);
      setIsLayoutApplied(true);
    } else {
      // Periodic data updates (keep positions as is, update data only)
      setEdges(topoEdges);
      setNodes(currentNodes => {
        const dataMap = new Map(topoNodes.map(n => [n.id, n.data]));
        let hasChanges = false;
        const nextNodes = currentNodes.map(node => {
          const freshData = dataMap.get(node.id);
          if (freshData && JSON.stringify(freshData) !== JSON.stringify(node.data)) {
            hasChanges = true;
            return { ...node, data: freshData };
          }
          return node;
        });
        return hasChanges ? nextNodes : currentNodes;
      });
    }
  }, [topoNodes, topoEdges, layoutInfo, isLayoutApplied, siteId]);
  // fitView trigger
  useEffect(() => {
    if (nodes.length > 0 && hasAppliedInitialLayout.current) {
        const timer = setTimeout(() => {
            fitView({ padding: 0.2, duration: 800 });
        }, nodes.length > 500 ? 500 : 100);
        return () => clearTimeout(timer);
    }
  }, [nodes.length, fitView]);
  const [notification, setNotification] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const saveLayout = async () => {
    setIsSaving(true);
    setNotification(null);
    try {
      const layoutData: Record<string, { x: number; y: number }> = {};
      nodes.forEach(node => {
        layoutData[node.id] = { x: node.position.x, y: node.position.y };
      });
      const response = await fetch(`/api/plugins/nautobot_topology/topology/${siteId}/layout/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': (document.getElementsByName('csrfmiddlewaretoken')[0] as HTMLInputElement)?.value || 
                         document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1] || '',
        },
        body: JSON.stringify(layoutData),
      });
      if (!response.ok) throw new Error('Failed to save layout');
      setHasUnsavedChanges(false);
      setNotification({ text: 'Layout saved successfully!', type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Failed to save layout:', error);
      setNotification({ text: 'Failed to save layout.', type: 'error' });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };
  const recalculateLayout = useCallback(() => {
    if (nodes.length > 500) {
      alert('Automatic layout is disabled for datasets > 500 nodes to prevent browser hanging.');
      return;
    }
    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, 'TB', true);
    setNodes([...layoutedNodes]);
  }, [nodes, edges]);
  const toggleLock = async () => {
    if (!isLocked) {
      if (hasUnsavedChanges) {
        const result = window.confirm('You have unsaved layout changes. Click OK to SAVE them, or Cancel to DISCARD them before locking.');
        if (result) {
          await saveLayout();
        } else {
          if (nodesBeforeUnlock) setNodes(nodesBeforeUnlock);
          setHasUnsavedChanges(false);
        }
      }
      setIsLocked(true);
      setNodesBeforeUnlock(null);
    } else {
      setNodesBeforeUnlock([...nodes]);
      setIsLocked(false);
    }
  };
  const discardChanges = () => {
    if (nodesBeforeUnlock) setNodes(nodesBeforeUnlock);
    setHasUnsavedChanges(false);
    setIsLocked(true);
    setNodesBeforeUnlock(null);
  };
  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    isSaving,
    isLocked,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    toggleLock,
    saveLayout,
    recalculateLayout,
    discardChanges,
    notification
  };
}
