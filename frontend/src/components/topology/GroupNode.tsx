import React, { useState } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';
import { Box, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Device } from '../../types';
interface GroupNodeProps {
  data: {
    name: string,
    deviceCount: number,
    devices?: Device[],
    iconStyle: 'simple' | 'fancy',
    lod: number
  };
}
export const GroupNode = React.memo(({ data }: GroupNodeProps) => {
  const { name, deviceCount, devices, iconStyle, lod } = data;
  const isFancy = iconStyle === 'fancy';
  const [expanded, setExpanded] = useState(false);
  if (lod === 0) {
    return (
      <div 
        className="w-5 h-5 rounded-full border border-blue-500/40 bg-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.2)] cursor-pointer transition-all duration-300 hover:scale-150 hover:bg-blue-400"
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
  const zoom = useStore((s: any) => s.transform[2]);

  return (
    <div className="relative flex flex-col items-center gap-2 group w-[140px]">
      <div 
        onClick={() => setExpanded(!expanded)}
        className={`${lod === 1 ? 'w-10 h-10 rounded-xl' : 'w-14 h-14 rounded-2xl'} border transition-all duration-500 flex items-center justify-center p-3 relative cursor-pointer ${isFancy
          ? 'bg-slate-900/40 backdrop-blur-xl shadow-2xl ring-1 ring-white/20 border-white/5'
          : 'bg-slate-900 shadow-sm border-slate-700/40'
        } hover:border-blue-500/50 hover:bg-slate-800/80 transition-shadow`}>
        
        <Handle type="target" position={Position.Top} id="t-t" className="!opacity-0 !w-0 !h-0" />
        <Handle type="target" position={Position.Bottom} id="t-b" className="!opacity-0 !w-0 !h-0" />
        <Handle type="target" position={Position.Left} id="t-l" className="!opacity-0 !w-0 !h-0" />
        <Handle type="target" position={Position.Right} id="t-r" className="!opacity-0 !w-0 !h-0" />
        
        <div className="relative flex items-center justify-center">
          <Box className={`${lod === 1 ? 'w-5 h-5' : 'w-7 h-7'} ${isFancy ? 'text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.6)]' : 'text-blue-400'}`} />
          {lod >= 2 && (
            <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-lg shadow-lg">
              {deviceCount}
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
          {name}
        </p>
      )}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 / zoom }}
            animate={{ opacity: 1, y: 0, scale: 1 / zoom }}
            exit={{ opacity: 0, y: 10, scale: 0.95 / zoom }}
            className={`absolute top-full mt-3 z-[1000] w-80 border rounded-2xl overflow-hidden shadow-2xl pointer-events-auto origin-top ${isFancy ? 'bg-slate-900/95 backdrop-blur-2xl border-slate-700/50' : 'bg-slate-900 border-slate-700'}`}
            style={{ 
              transformOrigin: 'top center'
            }}
          >
            <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
               <span className="text-sm font-bold text-white tracking-tight truncate mr-2">{name}</span>
               <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg font-mono shrink-0 border border-slate-700/50">{deviceCount} items</span>
            </div>
            <div className="max-h-64 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2 pointer-events-auto nowheel nodrag">
              {devices && devices.length > 0 ? devices.slice(0, 100).map((dev, i) => (
                <a 
                  key={dev.id || i} 
                  href={dev.nautobotUrl || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="block p-3 bg-slate-800/40 hover:bg-slate-700/80 rounded-xl transition-all cursor-pointer border border-transparent hover:border-blue-500/50 group/item !no-underline !text-inherit shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold !text-slate-200 group-hover/item:!text-white transition-colors">{dev.name}</span>
                    {dev.nautobotUrl && (
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover/item:text-slate-300 transition-colors" />
                    )}
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{dev.role || 'Device'}</span>
                    <span className="text-[10px] font-mono text-blue-400 font-bold">{dev.primaryIp || ''}</span>
                  </div>
                </a>
              )) : (
                <p className="text-xs text-slate-500 italic p-4 text-center">No precise device details available.</p>
              )}
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
GroupNode.displayName = 'GroupNode';
