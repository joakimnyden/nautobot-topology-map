import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import DottedMap from 'dotted-map';
import { MOCK_SITES, MOCK_INTER_SITE_LINKS } from '../mockData';
import { Site } from '../types';
import { Info, Network, Globe, Search, ChevronLeft } from 'lucide-react';

// Helper to normalize country names for matching
const normalizeCountryName = (name: string | undefined) => {
  if (!name) return "";
  const n = name.toLowerCase().trim();
  const mapping: Record<string, string> = {
    "united states of america": "united states",
    "united states": "united states",
    "usa": "united states",
    "uk": "united kingdom",
    "great britain": "united kingdom",
    "britain": "united kingdom"
  };
  return mapping[n] || n;
};

interface TopologyMapProps {
  onSiteSelect: (site: Site) => void;
}

export default function TopologyMap({ onSiteSelect }: TopologyMapProps) {
  const [hoveredSite, setHoveredSite] = useState<Site | null>(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchInfo, setShowArchInfo] = useState(false);
  const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generate dotted map data with dynamic density layers
  const { layers, mapWidth, mapHeight, mapInstance } = useMemo(() => {
    const map = new DottedMap({ height: 220, grid: 'vertical' });
    const points = map.getPoints();
    
    const maxX = Math.max(...points.map(p => p.x));
    const minX = Math.min(...points.map(p => p.x));
    const maxY = Math.max(...points.map(p => p.y));
    const minY = Math.min(...points.map(p => p.y));
    
    const xVals = Array.from(new Set(points.map(p => p.x))).sort((a, b) => a - b);
    const yVals = Array.from(new Set(points.map(p => p.y))).sort((a, b) => a - b);
    
    const xIndexMap = new Map(xVals.map((x, i) => [x, i]));
    const yIndexMap = new Map(yVals.map((y, i) => [y, i]));
    
    const layers = [[], [], [], []] as {x: number, y: number, id: number}[][];
    
    let idCounter = 0;
    points.forEach(p => {
      const gridX = xIndexMap.get(p.x)!;
      const gridY = yIndexMap.get(p.y)!;
      
      const isMod4 = gridX % 4 === 0 && gridY % 4 === 0;
      const isMod2 = gridX % 2 === 0 && gridY % 2 === 0;
      
      const point = { x: p.x, y: p.y, id: idCounter++ };
      
      if (isMod4) {
        layers[0].push(point);
      } else if (isMod2) {
        layers[1].push(point);
      } else if ((gridX + gridY) % 2 === 0) {
        layers[2].push(point);
      } else {
        layers[3].push(point);
      }
    });

    return { 
      layers,
      mapWidth: maxX + minX,
      mapHeight: maxY + minY,
      mapInstance: map
    };
  }, []);

  // Projection helper: maps [lng, lat] to [x, y] in the dotted map space
  const project = (coords: [number, number]): [number, number] => {
    const [lng, lat] = coords;
    const pin = mapInstance.getPin({ lat, lng });
    if (pin) {
      return [pin.x, pin.y];
    }
    // Fallback if getPin fails
    const x = (lng + 180) * (mapWidth / 360);
    const y = (90 - lat) * (mapHeight / 180);
    return [x, y];
  };

  const handleMouseEnter = (site: Site, e: React.MouseEvent) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setHoveredSite(site);
    setPopupPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredSite(null);
    }, 1000);
  };

  const filteredSites = MOCK_SITES.filter(s => {
    const matchesCountry = !selectedCountry || normalizeCountryName(s.country) === normalizeCountryName(selectedCountry);
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         s.country.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCountry && matchesSearch;
  });

  return (
    <div className="relative w-full h-full bg-[#020617] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Top Navigation & Search */}
      <div className="absolute top-8 left-8 right-8 z-30 flex justify-between items-start pointer-events-none">
        <div className="flex items-center gap-3">
          <Globe className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-4xl font-bold text-slate-100 tracking-tight">
              {selectedCountry ? `${selectedCountry} Infrastructure` : 'Global Infrastructure'}
            </h2>
            <p className="text-sm font-mono text-blue-400 mt-1 uppercase tracking-widest">
              Nautobot Nexus • {filteredSites.length} Sites Discovered
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 items-end pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
              <input 
                type="text"
                placeholder="Search sites or regions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 w-64 transition-all"
              />
            </div>
            <button 
              onClick={() => setShowArchInfo(!showArchInfo)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-xl border border-slate-700 transition-all"
              title="Architecture Info"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {selectedCountry && (
              <button 
                onClick={() => setSelectedCountry(null)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs shadow-xl transition-all border border-slate-700"
              >
                <ChevronLeft className="w-4 h-4" /> Reset View
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Architecture Info Panel */}
      <AnimatePresence>
        {showArchInfo && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-24 right-8 z-40 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700 p-6 rounded-2xl shadow-2xl"
          >
            <div className="flex items-center gap-2 mb-4 text-blue-400">
              <Network className="w-5 h-5" />
              <h3 className="font-bold text-sm uppercase tracking-wider">Nautobot Plugin Efficiency</h3>
            </div>
            <div className="space-y-4 text-xs text-slate-400 leading-relaxed">
              <p>
                <strong className="text-slate-200">1. GraphQL API:</strong> Instead of REST, use GraphQL to fetch only <code className="text-blue-400">name</code>, <code className="text-blue-400">coordinates</code>, and <code className="text-blue-400">status</code>. This reduces payload size by ~90%.
              </p>
              <p>
                <strong className="text-slate-200">2. Server-Side Filtering:</strong> The search bar above would trigger a debounced query to Nautobot's <code className="text-blue-400">/api/dcim/sites/?q=...</code> rather than filtering in memory.
              </p>
              <p>
                <strong className="text-slate-200">3. Geo-Clustering:</strong> For 1000+ sites, use a clustering algorithm (like Supercluster) to group markers at low zoom levels, only expanding as you "dive" in.
              </p>
              <p>
                <strong className="text-slate-200">4. Selective Hydration:</strong> Load site metadata only when a marker is hovered or clicked, keeping the initial map load extremely lightweight.
              </p>
            </div>
            <button 
              onClick={() => setShowArchInfo(false)}
              className="mt-6 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full h-full cursor-grab active:cursor-grabbing">
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={20}
          centerOnInit={true}
          onZoom={(ref) => setViewState({ scale: ref.state.scale, x: ref.state.positionX, y: ref.state.positionY })}
          onPanning={(ref) => setViewState({ scale: ref.state.scale, x: ref.state.positionX, y: ref.state.positionY })}
          onTransformed={(ref) => setViewState({ scale: ref.state.scale, x: ref.state.positionX, y: ref.state.positionY })}
        >
          {({ zoomIn, zoomOut, resetTransform, ...rest }) => {
            const wrapper = rest.instance.wrapperComponent;
            const W = wrapper ? wrapper.clientWidth : 0;
            const H = wrapper ? wrapper.clientHeight : 0;

            const S_svg = W && H ? Math.min(W / mapWidth, H / mapHeight) : 1;
            const O_x = W && H ? (W - mapWidth * S_svg) / 2 : 0;
            const O_y = W && H ? (H - mapHeight * S_svg) / 2 : 0;

            // Use the React state to guarantee re-renders during interaction
            const scale = viewState.scale || rest.instance.transformState.scale;
            const positionX = viewState.x || rest.instance.transformState.positionX;
            const positionY = viewState.y || rest.instance.transformState.positionY;

            const minVisibleX = W && H ? (-positionX / scale - O_x) / S_svg : -Infinity;
            const maxVisibleX = W && H ? ((W - positionX) / scale - O_x) / S_svg : Infinity;
            const minVisibleY = W && H ? (-positionY / scale - O_y) / S_svg : -Infinity;
            const maxVisibleY = W && H ? ((H - positionY) / scale - O_y) / S_svg : Infinity;

            const paddingX = W && H ? (maxVisibleX - minVisibleX) * 0.2 : 0;
            const paddingY = W && H ? (maxVisibleY - minVisibleY) * 0.2 : 0;

            const viewBounds = {
              minX: minVisibleX - paddingX,
              maxX: maxVisibleX + paddingX,
              minY: minVisibleY - paddingY,
              maxY: maxVisibleY + paddingY,
            };

            const isVisible = (p: {x: number, y: number}) => 
              p.x >= viewBounds.minX && p.x <= viewBounds.maxX && 
              p.y >= viewBounds.minY && p.y <= viewBounds.maxY;

            return (
            <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
              <svg 
                viewBox={`0 0 ${mapWidth} ${mapHeight}`} 
                className="w-full h-full"
                style={{ background: '#020617' }}
              >
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                {/* Layer 0: Always visible (Base density) */}
                <g opacity="0.4">
                  {layers[0].filter(isVisible).map((point) => (
                    <circle key={`l0-${point.id}`} cx={point.x} cy={point.y} r="0.4" fill="#cbd5e1" />
                  ))}
                </g>

                {/* Layer 1: Fades in at scale > 1.5 */}
                <g opacity={Math.min(0.4, Math.max(0, (scale - 1.5) * 0.4))}>
                  {scale > 1.0 && layers[1].filter(isVisible).map((point) => (
                    <circle key={`l1-${point.id}`} cx={point.x} cy={point.y} r="0.4" fill="#cbd5e1" />
                  ))}
                </g>

                {/* Layer 2: Fades in at scale > 3 */}
                <g opacity={Math.min(0.4, Math.max(0, (scale - 3) * 0.4))}>
                  {scale > 2.5 && layers[2].filter(isVisible).map((point) => (
                    <circle key={`l2-${point.id}`} cx={point.x} cy={point.y} r="0.4" fill="#cbd5e1" />
                  ))}
                </g>

                {/* Layer 3: Fades in at scale > 6 */}
                <g opacity={Math.min(0.4, Math.max(0, (scale - 6) * 0.4))}>
                  {scale > 5.5 && layers[3].filter(isVisible).map((point) => (
                    <circle key={`l3-${point.id}`} cx={point.x} cy={point.y} r="0.4" fill="#cbd5e1" />
                  ))}
                </g>

                {/* Inter-site Connections */}
                {MOCK_INTER_SITE_LINKS.map((link) => {
                  const fromSite = MOCK_SITES.find(s => s.id === link.from);
                  const toSite = MOCK_SITES.find(s => s.id === link.to);
                  if (!fromSite || !toSite) return null;
                  
                  const [x1, y1] = project(fromSite.coordinates);
                  const [x2, y2] = project(toSite.coordinates);
                  
                  return (
                    <line
                      key={link.id}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={link.status === 'active' ? "#10b981" : link.status === 'degraded' ? "#f59e0b" : "#ef4444"}
                      strokeWidth="0.2"
                      strokeLinecap="round"
                      opacity="0.2"
                    />
                  );
                })}

                {/* Site Markers (Lighted Dots) */}
                {filteredSites.map((site) => {
                  const [x, y] = project(site.coordinates);
                  const color = site.status === 'Active' ? "#3b82f6" : site.status === 'Degraded' ? "#f59e0b" : "#ef4444";
                  
                  // Dynamic scaling based on zoom level
                  const currentScale = scale;
                  // We want the dots to "expand" (stay visible and grow slightly) but not exponentially
                  const outerRadius = 2.6 / Math.sqrt(currentScale);
                  const innerRadius = 0.8 / Math.sqrt(currentScale);
                  const strokeWidth = 0.16 / Math.sqrt(currentScale);

                  return (
                    <g 
                      key={site.id}
                      onMouseEnter={(e) => handleMouseEnter(site, e)}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => onSiteSelect(site)}
                      className="cursor-pointer"
                    >
                      {/* Outer Glow */}
                      <circle
                        cx={x}
                        cy={y}
                        r={outerRadius}
                        fill={color}
                        opacity="0.3"
                        filter="url(#glow)"
                      />
                      {/* Inner Core */}
                      <circle
                        cx={x}
                        cy={y}
                        r={innerRadius}
                        fill={color}
                        stroke="#fff"
                        strokeWidth={strokeWidth}
                      />
                    </g>
                  );
                })}
              </svg>
            </TransformComponent>
            );
          }}
        </TransformWrapper>
      </div>

      <AnimatePresence>
        {hoveredSite && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="fixed z-50 pointer-events-none"
            style={{
              left: popupPos.x + 20,
              top: popupPos.y - 120,
            }}
          >
            <div className="bg-[#1e293b] border border-slate-700 p-6 rounded-2xl shadow-2xl min-w-[280px] backdrop-blur-xl pointer-events-auto cursor-pointer"
                 onClick={() => onSiteSelect(hoveredSite)}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-100 tracking-tight">{hoveredSite.name}</h3>
                  <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mt-1">{hoveredSite.region} • {hoveredSite.country}</p>
                </div>
                <div className={`px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest border ${
                  hoveredSite.status === 'Active' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {hoveredSite.status}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Devices</p>
                  <p className="text-lg font-bold text-slate-100">{hoveredSite.deviceCount}</p>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Links</p>
                  <p className="text-lg font-bold text-slate-100">{hoveredSite.linkCount}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                <Network className="w-4 h-4" />
                <span>View Topology</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-8 left-8 flex flex-col gap-4">
        <div className="bg-[#1e293b] border border-slate-700 p-4 rounded-2xl shadow-xl">
          <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Map Legend</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              <span className="text-xs text-slate-300">Operational Site</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
              <span className="text-xs text-slate-300">Degraded Performance</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              <span className="text-xs text-slate-300">Site Offline</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
