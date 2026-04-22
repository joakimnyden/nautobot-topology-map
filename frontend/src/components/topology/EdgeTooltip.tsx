import React from 'react';
import { Layers, Network, Zap, ArrowLeftRight, Activity } from 'lucide-react';
import { Link, Device } from '../../types';
import { formatThroughput, formatInterfaceName } from '../../utils/topology-utils';
interface EdgeTooltipProps {
  hoveredEdge: { id: string; x: number; y: number };
  linkMap: Map<string, Link>;
  deviceMap: Map<string, Device>;
  linkMetrics: Record<string, any>;
  prometheusEnabled: boolean;
  pinnedEdgeId: string | null;
  setHoveredEdge: (val: any) => void;
  setHoveredEdgeId: (val: any) => void;
  tooltipTimeout: React.MutableRefObject<any>;
}
export const EdgeTooltip = ({
  hoveredEdge,
  linkMap,
  deviceMap,
  linkMetrics,
  prometheusEnabled,
  pinnedEdgeId,
  setHoveredEdge,
  setHoveredEdgeId,
  tooltipTimeout
}: EdgeTooltipProps) => {
  const link = linkMap.get(hoveredEdge.id);
  const metrics = linkMetrics[hoveredEdge.id];
  if (!link) return null;
  const sourceNode = deviceMap.get(link.source);
  const targetNode = deviceMap.get(link.target);
  const sourceName = link.sourceDeviceName || sourceNode?.name || 'Unknown';
  const targetName = link.targetDeviceName || targetNode?.name || 'Unknown';
  return (
    <div
      className="fixed pointer-events-auto z-[100] bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 min-w-[320px] animate-in fade-in zoom-in duration-200"
      style={{ 
        left: hoveredEdge.x + 20, 
        top: Math.min(window.innerHeight - 400, hoveredEdge.y - 20) 
      }}
      onMouseEnter={() => {
        if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
      }}
      onMouseLeave={() => {
        if (!pinnedEdgeId) {
          setHoveredEdge(null);
          setHoveredEdgeId(null);
        }
      }}
    >
      <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
          <div className="flex flex-col gap-0.5">
               <p className="text-[10px] font-black text-indigo-400/50 uppercase tracking-[0.2em] leading-none mb-1 ml-9">
                 {link.type === 'port-channel' ? 'Port-Channel' : link.type} Connection
               </p>
               <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${link.type === 'port-channel' ? 'bg-indigo-500/10 text-indigo-400' : (link.type === 'physical' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400')}`}>
                    {link.type === 'port-channel' ? <Layers className="w-3.5 h-3.5" /> : <Network className="w-3.5 h-3.5" />}
                  </div>
                  <p className="text-sm font-bold text-white leading-none">
                    {link.type === 'port-channel' ? 'Port-Channel' : (link.protocol || 'Ethernet')} Link
                  </p>
               </div>
          </div>
        {prometheusEnabled && metrics && (
          <div className="flex flex-col items-end">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${metrics.utilization < 50 ? 'bg-emerald-500/10 text-emerald-400' :
              metrics.utilization < 80 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
              }`}>
              {metrics.utilization.toFixed(1)}% Load
            </span>
          </div>
        )}
      </div>
      <div className="grid py-2" style={{ gridTemplateColumns: '8px 1fr auto', rowGap: '6px', columnGap: '10px' }}>
        {/* Source row */}
        <div className="flex items-center" style={{ gridColumn: '1', gridRow: '1' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
        </div>
        <div className="flex items-center min-w-0 overflow-hidden" style={{ gridColumn: '2', gridRow: '1' }}>
          <span className="text-[11px] font-bold text-slate-100 truncate leading-none">{sourceName}</span>
        </div>
        <div className="flex items-center" style={{ gridColumn: '3', gridRow: '1' }}>
          {link.sourceInterfaceUrl ? (
            <a
              href={link.sourceInterfaceUrl}
              target="_blank"
              className={`text-[10px] font-mono font-bold shrink-0 px-2.5 h-[20px] rounded-md border transition-all underline decoration-transparent hover:decoration-current leading-none flex items-center whitespace-nowrap ${
                link.type === 'port-channel' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30 hover:bg-indigo-500/30' : 'bg-white/5 text-slate-400 border-white/5 hover:text-amber-400 hover:border-amber-400/30'
              }`}
            >
              {formatInterfaceName(link.sourceInterface || '')}
            </a>
          ) : (
            <span className={`text-[10px] font-mono font-bold shrink-0 px-2.5 h-[20px] rounded-md border leading-none flex items-center whitespace-nowrap ${
              link.type === 'port-channel' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30' : 'bg-white/5 text-slate-400 border-white/5'
            }`}>
              {formatInterfaceName(link.sourceInterface || '')}
            </span>
          )}
        </div>
        {/* Divider row */}
        <div style={{ gridColumn: '1 / -1', gridRow: '2' }} className="flex items-center justify-center h-4">
          <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
          <div className="absolute z-10 bg-slate-900 px-2">
            <Zap className="w-3 h-3 text-amber-500/50" />
          </div>
        </div>
        {/* Target row */}
        <div className="flex items-center" style={{ gridColumn: '1', gridRow: '3' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
        </div>
        <div className="flex items-center min-w-0 overflow-hidden" style={{ gridColumn: '2', gridRow: '3' }}>
          <span className="text-[11px] font-bold text-slate-100 truncate leading-none">{targetName}</span>
        </div>
        <div className="flex items-center" style={{ gridColumn: '3', gridRow: '3' }}>
          {link.targetInterfaceUrl ? (
            <a
              href={link.targetInterfaceUrl}
              target="_blank"
              className={`text-[10px] font-mono font-bold shrink-0 px-2.5 h-[20px] rounded-md border transition-all underline decoration-transparent hover:decoration-current leading-none flex items-center whitespace-nowrap ${
                link.type === 'port-channel' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30 hover:bg-indigo-500/30' : 'bg-white/5 text-slate-400 border-white/5 hover:text-amber-400 hover:border-amber-400/30'
              }`}
            >
              {formatInterfaceName(link.targetInterface || '')}
            </a>
          ) : (
            <span className={`text-[10px] font-mono font-bold shrink-0 px-2.5 h-[20px] rounded-md border leading-none flex items-center whitespace-nowrap ${
              link.type === 'port-channel' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30' : 'bg-white/5 text-slate-400 border-white/5'
            }`}>
              {formatInterfaceName(link.targetInterface || '')}
            </span>
          )}
        </div>
      </div>
      {prometheusEnabled && metrics && (
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5 mt-1">
          <div className="bg-white/5 p-2 rounded-xl border border-white/5">
            <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-1">Incoming</p>
            <p className="text-[11px] font-mono font-bold text-emerald-400">{formatThroughput(metrics.tx)}</p>
          </div>
          <div className="bg-white/5 p-2 rounded-xl border border-white/5">
            <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-1">Outgoing</p>
            <p className="text-[11px] font-mono font-bold text-blue-400">{formatThroughput(metrics.rx)}</p>
          </div>
        </div>
      )}
      {link.protocol === 'BGP' && (
        <div className="mt-1 pt-3 border-t border-white/5 space-y-3">
          <div className="flex items-center justify-between">
             <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider italic">
                <Activity className="w-3 h-3" /> Peering State
             </span>
             <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
               link.status?.toLowerCase() === 'active' || link.status?.toLowerCase() === 'established'
                 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                 : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
             }`}>
               {link.status || 'Active'}
             </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 p-2 rounded-xl border border-white/5">
               <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-1">Local</p>
               <p className="text-[11px] font-mono font-bold text-blue-400">{link.localAs ? `AS${link.localAs}` : '---'}</p>
               <p className="text-[9px] font-mono text-slate-500 mt-0.5 truncate">{link.localIp || '---'}</p>
            </div>
            <div className="bg-white/5 p-2 rounded-xl border border-white/5">
               <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-1">Remote</p>
               <p className="text-[11px] font-mono font-bold text-amber-400">{link.remoteAs ? `AS${link.remoteAs}` : '---'}</p>
               <p className="text-[9px] font-mono text-slate-500 mt-0.5 truncate">{link.remoteIp || '---'}</p>
            </div>
          </div>
        </div>
      )}
      {link.isPortChannel && link.lagMembers && link.lagMembers.length > 0 && (
        <div className="mt-1 pt-3 border-t border-white/5">
          <div className="flex items-center justify-between text-[9px] text-indigo-400 font-bold uppercase mb-3 px-1">
            <span className="flex items-center gap-1.5"><Layers className="w-3 h-3" /> Interface Bundle</span>
            <span className="bg-indigo-400/10 px-1.5 py-0.5 rounded-md border border-indigo-500/20">{link.lagMembers.length} Members</span>
          </div>
          
          <div className="grid grid-cols-3 gap-0 px-3 mb-1">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Source</span>
            <div />
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest text-right">Target</span>
          </div>
          <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
            {link.lagMembers.map((m, idx) => (
              <div key={idx} className="grid gap-0 bg-white/[0.02] hover:bg-white/[0.06] px-3 rounded-lg border border-white/[0.03] transition-colors group h-[28px]" style={{ gridTemplateColumns: '1fr 28px 1fr' }}>
                <div className="flex items-center min-w-0 overflow-hidden">
                  <a href={`/dcim/interfaces/${m.sourceInterfaceId}/`} target="_blank" className="text-[11px] text-left text-indigo-400/80 font-mono font-bold truncate hover:underline leading-none">
                    {formatInterfaceName(m.sourceInterface)}
                  </a>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowLeftRight className="w-2.5 h-2.5 shrink-0 text-slate-700/50" />
                </div>
                <div className="flex items-center justify-end min-w-0 overflow-hidden">
                  <a href={`/dcim/interfaces/${m.targetInterfaceId}/`} target="_blank" className="text-[11px] text-right text-indigo-400/80 font-mono font-bold truncate hover:underline leading-none">
                    {formatInterfaceName(m.targetInterface)}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};