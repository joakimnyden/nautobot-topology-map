import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Layers, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Device } from '../../types';
interface APStackNodeProps {
  data: {
    count: number,
    parentName?: string,
    devices: Device[],
    iconStyle: 'simple' | 'fancy',
    lod: number
  };
}
export const APStackNode = React.memo(({ data }: APStackNodeProps) => {
  const { count, parentName, devices, iconStyle, lod } = data;
  const isFancy = iconStyle === 'fancy';
  const [expanded, setExpanded] = useState(false);
  if (lod === 0) {
    return (
      <div 
        className="w-5 h-5 rounded-full border border-emerald-500/40 bg-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)] cursor-pointer transition-all duration-300 hover:scale-150 hover:bg-emerald-400"
        onClick={() => setExpanded(!expanded)}
      >
        <Handle type="target" position={Position.Top} id="t-t" className="!opacity-0 !w-0 !h-0" />
        <Handle type="target" position={Position.Bottom} id="t-b" className="!opacity-0 !w-0 !h-0" />
        <Handle type="target" position={Position.Left} id="t-l" className="!opacity-0 !w-0 !h-0" />
        <Handle type="target" position={Position.Right} id="t-r" className="!opacity-0 !w-0 !h-0" />
        <Handle type="source" position={Position.Top} id="s-t" className="!opacity-0 !w-0 !h-0" />
        <Handle type="source" position={Position.Bottom} id="s-b" className="!opacity-0 !w-0 !h-0" />
        <Handle type="source" position={Position.Left} id="s-l" className="!opacity-0 !w-0 !h-0" />
        <Handle type="source" position={Position.Right} id="s-r" className="!opacity-0 !w-0 !h-0" />
      </div>
    );
  }
  return (
    <div className="relative flex flex-col items-center gap-2 group w-[120px]">
      <div 
        onClick={() => setExpanded(!expanded)}
        className={`${lod === 1 ? 'w-10 h-10 rounded-xl' : 'w-14 h-14 rounded-2xl'} border transition-all duration-500 flex items-center justify-center p-3 relative cursor-pointer ${isFancy
          ? 'bg-slate-900/40 backdrop-blur-xl shadow-2xl ring-1 ring-white/20 border-white/5'
          : 'bg-slate-900 shadow-sm border-slate-700/40'
        } hover:border-emerald-500/50 hover:bg-slate-800/80 transition-shadow`}>
        
        <Handle type="target" position={Position.Top} id="t-t" className="!opacity-0 !w-0 !h-0" />
        <Handle type="target" position={Position.Bottom} id="t-b" className="!opacity-0 !w-0 !h-0" />
        <Handle type="target" position={Position.Left} id="t-l" className="!opacity-0 !w-0 !h-0" />
        <Handle type="target" position={Position.Right} id="t-r" className="!opacity-0 !w-0 !h-0" />
        
        <div className="relative flex items-center justify-center">
          <Layers className={`${lod === 1 ? 'w-5 h-5' : 'w-7 h-7'} ${isFancy ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.6)]' : 'text-emerald-400'}`} />
          {lod >= 2 && (
            <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-lg shadow-lg">
              x{count}
            </div>
          )}
        </div>
        <Handle type="source" position={Position.Top} id="s-t" className="!opacity-0 !w-0 !h-0" />
        <Handle type="source" position={Position.Bottom} id="s-b" className="!opacity-0 !w-0 !h-0" />
        <Handle type="source" position={Position.Left} id="s-l" className="!opacity-0 !w-0 !h-0" />
        <Handle type="source" position={Position.Right} id="s-r" className="!opacity-0 !w-0 !h-0" />
      </div>
      {lod >= 2 && (
        <p className="text-[10px] font-bold text-slate-400 tracking-tight text-center truncate max-w-[120px] group-hover:text-white transition-colors">
          {parentName ? `APs on ${parentName}` : `Unconnected APs`}
        </p>
      )}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`absolute top-full mt-2 z-[1000] w-64 border rounded-xl overflow-hidden shadow-2xl pointer-events-auto ${isFancy ? 'bg-slate-900/95 backdrop-blur-xl border-slate-700/50' : 'bg-slate-900 border-slate-700'}`}
          >
            <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
               <span className="text-xs font-bold text-white tracking-wider">{parentName ? `APs on ${parentName}` : 'Unconnected APs'}</span>
               <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-md font-mono">{count} items</span>
            </div>
            <div className="max-h-48 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1 pointer-events-auto nowheel nodrag">
              {devices?.slice(0, 100).map((dev, i) => (
                <a 
                  key={dev.id || i} 
                  href={dev.nautobotUrl || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="block p-2 bg-slate-800/40 hover:bg-slate-700/80 rounded-lg transition-all cursor-pointer border border-transparent hover:border-blue-500/50 group/item !no-underline !text-inherit"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold !text-slate-200 group-hover/item:!text-white transition-colors">{dev.name}</span>
                    {dev.nautobotUrl && (
                      <ExternalLink className="w-3 h-3 text-slate-500 group-hover/item:text-slate-300 transition-colors" />
                    )}
                  </div>
                  <div className="flex justify-between items-center mt-1.5">
                    <span className="text-[9px] text-slate-500 uppercase font-bold">{dev.role || 'Access Point'}</span>
                    <span className="text-[9px] font-mono text-emerald-400">{dev.primaryIp || ''}</span>
                  </div>
                </a>
              ))}
              {devices && devices.length > 100 && (
                <div className="p-2 text-center text-[9px] text-slate-500 italic bg-slate-800/20 rounded-lg mt-1 border border-dashed border-slate-700/50">
                  Showing first 100 of {devices.length} devices
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
APStackNode.displayName = 'APStackNode';
