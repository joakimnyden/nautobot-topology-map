import { useState, useEffect, useCallback, useRef } from 'react';
import { Node, Edge, useReactFlow } from '@xyflow/react';
import { getLayoutedElements, getRoleRank, getPartnerBaseName } from '../utils/topology-utils';

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
      if (layoutInfo === null) return; 
      
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
          // Structured Rank Grid Layout for high-density maps
          const groupNodes = topoNodes.filter(n => n.type === 'aggregate' || n.type === 'apStack');
          const standardNodes = [...topoNodes.filter(n => n.type !== 'aggregate' && n.type !== 'apStack')];
          
          // Group standard nodes by rank
          const nodesByRank = new Map<number, Node[]>();
          standardNodes.forEach(node => {
            const rank = getRoleRank(node.data?.device?.role || '', node.type);
            if (!nodesByRank.has(rank)) nodesByRank.set(rank, []);
            nodesByRank.get(rank)!.push(node);
          });

          const sortedRanks = Array.from(nodesByRank.keys()).sort((a, b) => a - b);
          const spacing = 500;
          let currentY = 0;
          const mappedStandard: Node[] = [];

          sortedRanks.forEach(rank => {
            const rankNodes = nodesByRank.get(rank)!;
            // Layout nodes in this rank in rows. 
            const rankCols = Math.max(8, Math.ceil(Math.sqrt(rankNodes.length * 2))); 
            
            // Detect and group partners within this rank
            const processedIds = new Set<string>();
            const rowNodes: Node[] = [];

            rankNodes.forEach(node => {
                if (processedIds.has(node.id)) return;
                
                const baseName = getPartnerBaseName(node.data?.device?.name || '');
                const partner = baseName ? rankNodes.find(n => n.id !== node.id && !processedIds.has(n.id) && getPartnerBaseName(n.data?.device?.name || '') === baseName) : null;
                
                if (partner) {
                    rowNodes.push(node, partner);
                    processedIds.add(node.id);
                    processedIds.add(partner.id);
                } else {
                    rowNodes.push(node);
                    processedIds.add(node.id);
                }
            });

            rowNodes.forEach((node, i) => {
              mappedStandard.push({
                ...node,
                position: {
                  x: ((i % rankCols) - rankCols / 2) * spacing,
                  y: currentY + Math.floor(i / rankCols) * spacing
                }
              });
            });
            
            // Advance Y for the next rank
            const rowsInRank = Math.ceil(rowNodes.length / rankCols);
            currentY += rowsInRank * spacing + 800; // Extra padding between ranks
          });
          
          const maxX = mappedStandard.length > 0 ? Math.max(...mappedStandard.map(n => n.position.x)) : 1000;

          const mappedGroups = groupNodes.map((node, i) => ({
            ...node,
            position: {
              x: maxX + 1000,
              y: (i - Math.floor(groupNodes.length / 2)) * 800
            }
          }));
          
          finalNodes = [...mappedStandard, ...mappedGroups];
        } else {
          const { nodes: layoutedNodes } = getLayoutedElements(topoNodes, topoEdges, 'TB');
          
          // Better handling of unconnected nodes: place them based on their rank
          const connectedIds = new Set(topoEdges.flatMap(e => [e.source, e.target]));
          const unconnectedNodes = layoutedNodes.filter(n => !connectedIds.has(n.id));
          const connectedNodes = layoutedNodes.filter(n => connectedIds.has(n.id));

          const maxX = Math.max(...connectedNodes.map(n => n.position.x), 800);
          const maxY = Math.max(...connectedNodes.map(n => n.position.y), 800);
          
          // Group unconnected nodes by rank and place them neatly
          const unconnectedByRank = new Map<number, Node[]>();
          unconnectedNodes.forEach(node => {
            const rank = getRoleRank(node.data?.device?.role || node.data?.name || '', node.type);
            if (!unconnectedByRank.has(rank)) unconnectedByRank.set(rank, []);
            unconnectedByRank.get(rank)!.push(node);
          });

          const sortedRanks = Array.from(unconnectedByRank.keys()).sort((a, b) => a - b);
          let currentY = 0;
          const groupStartX = maxX + 800;

          const positionedUnconnected: Node[] = [];
          sortedRanks.forEach(rank => {
            const nodesInRank = unconnectedByRank.get(rank)!;
            nodesInRank.forEach((node, i) => {
              positionedUnconnected.push({
                ...node,
                position: { x: groupStartX + (i % 3) * 400, y: currentY + Math.floor(i / 3) * 400 }
              });
            });
            currentY += Math.ceil(nodesInRank.length / 3) * 400 + 200;
          });

          finalNodes = [...connectedNodes, ...positionedUnconnected];
        }
      }

      const positionedNodes = finalNodes;
      const nodesMap = new Map(positionedNodes.map(n => [n.id, n]));

      const updatedEdges = topoEdges.map(edge => {
        const sourceNode = nodesMap.get(edge.source);
        const targetNode = nodesMap.get(edge.target);
        
        if (!sourceNode || !targetNode) return edge;

        const sx = sourceNode.position.x;
        const sy = sourceNode.position.y;
        const tx = targetNode.position.x;
        const ty = targetNode.position.y;

        const dx = tx - sx;
        const dy = ty - sy;

        let sourceHandle = 's-b';
        let targetHandle = 't-t';

        if (Math.abs(dx) > Math.abs(dy) * 1.5) {
          // Primarily horizontal
          if (dx > 0) {
            sourceHandle = 's-r';
            targetHandle = 't-l';
          } else {
            sourceHandle = 's-l';
            targetHandle = 't-r';
          }
        } else {
          // Primarily vertical
          if (dy > 0) {
            sourceHandle = 's-b';
            targetHandle = 't-t';
          } else {
            sourceHandle = 's-t';
            targetHandle = 't-b';
          }
        }

        return {
          ...edge,
          sourceHandle,
          targetHandle
        };
      });

      setNodes(positionedNodes);
      setEdges(updatedEdges);
      setIsLayoutApplied(true);
    } else {
      // Periodic data updates (keep positions as is, update data only)
      const nodesMap = new Map(nodes.map(n => [n.id, n]));
      const updatedEdges = topoEdges.map(edge => {
        const sourceNode = nodesMap.get(edge.source);
        const targetNode = nodesMap.get(edge.target);
        if (!sourceNode || !targetNode) return edge;
        
        const dx = targetNode.position.x - sourceNode.position.x;
        const dy = targetNode.position.y - sourceNode.position.y;
        
        let sourceHandle = 's-b';
        let targetHandle = 't-t';
        if (Math.abs(dx) > Math.abs(dy) * 1.5) {
          if (dx > 0) { sourceHandle = 's-r'; targetHandle = 't-l'; }
          else { sourceHandle = 's-l'; targetHandle = 't-r'; }
        } else {
          if (dy > 0) { sourceHandle = 's-b'; targetHandle = 't-t'; }
          else { sourceHandle = 's-t'; targetHandle = 't-b'; }
        }
        return { ...edge, sourceHandle, targetHandle };
      });
      
      setEdges(updatedEdges);
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
      setNotification({ text: 'Automatic layout disabled for > 500 nodes.', type: 'error' });
      setTimeout(() => setNotification(null), 5000);
      return;
    }
    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, 'TB', true);
    
    const nodesMap = new Map(layoutedNodes.map(n => [n.id, n]));
    const updatedEdges = edges.map(edge => {
      const sourceNode = nodesMap.get(edge.source);
      const targetNode = nodesMap.get(edge.target);
      if (!sourceNode || !targetNode) return edge;
      
      const dx = targetNode.position.x - sourceNode.position.x;
      const dy = targetNode.position.y - sourceNode.position.y;
      
      let sourceHandle = 's-b';
      let targetHandle = 't-t';
      if (Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0) { sourceHandle = 's-r'; targetHandle = 't-l'; }
        else { sourceHandle = 's-l'; targetHandle = 't-r'; }
      } else {
        if (dy > 0) { sourceHandle = 's-b'; targetHandle = 't-t'; }
        else { sourceHandle = 's-t'; targetHandle = 't-b'; }
      }
      return { ...edge, sourceHandle, targetHandle };
    });

    setNodes([...layoutedNodes]);
    setEdges(updatedEdges);
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
