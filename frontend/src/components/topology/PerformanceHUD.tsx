import React from 'react';
import { Activity } from 'lucide-react';
interface PerformanceHUDProps {
  renderTime: number;
  zoom: number;
  nodesCount: number;
  edgesCount: number;
  lodLevel: number;
}
export const PerformanceHUD = ({
  renderTime,
  zoom,
  nodesCount,
  edgesCount,
  lodLevel
}: PerformanceHUDProps) => {
  return (
    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[60] group px-1">
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-950/60 backdrop-blur-2xl border border-white/10 rounded-2xl ring-1 ring-white/5 shadow-2xl transition-all duration-500 hover:bg-slate-900/80 hover:ring-white/20">
        <div className="flex flex-col gap-0.5">
           <div className="flex items-center gap-2">
              <Activity className={`w-3.5 h-3.5 ${renderTime < 16.7 ? 'text-emerald-400' : (renderTime < 33 ? 'text-amber-400' : 'text-rose-400')} animate-pulse`} />
              <span className="text-[10px] font-black font-mono text-slate-200 tracking-wider uppercase">Live Metrics</span>
              <div className={`w-1.5 h-1.5 rounded-full ${renderTime < 16.7 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} />
           </div>
           <div className="flex items-center gap-4 mt-1">
              <div className="flex flex-col">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">Latency</span>
                <span className={`text-[11px] font-mono font-bold ${renderTime < 16.7 ? 'text-emerald-400' : 'text-amber-400'}`}>{renderTime.toFixed(1)}ms</span>
              </div>
              <div className="w-px h-6 bg-white/5" />
              <div className="flex flex-col">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">Zoom</span>
                <span className="text-[11px] font-mono font-bold text-blue-400">{(zoom * 100).toFixed(0)}%</span>
              </div>
              <div className="w-px h-6 bg-white/5" />
              <div className="flex flex-col">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">Objects</span>
                <span className="text-[11px] font-mono font-bold text-indigo-400 px-1 bg-indigo-500/10 rounded">{nodesCount + edgesCount}</span>
              </div>
              <div className="w-px h-6 bg-white/5" />
              <div className="flex flex-col">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">LOD</span>
                <span className="text-[11px] font-mono font-bold text-amber-500">Lv{lodLevel}</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
