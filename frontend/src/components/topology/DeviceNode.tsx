import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Device } from '../../types';
import { getRoleConfig, getVendorLogo } from '../../config/topologyConfig';
interface DeviceNodeProps {
  data: {
    device: Device;
    isHighlighted: boolean;
    hasQuery: boolean;
    iconMode: 'role' | 'vendor';
    iconStyle: 'simple' | 'fancy';
    lod: number;
    onHover: (id: string | null, pos?: { x: number, y: number }) => void;
  };
}
export const DeviceNode = React.memo(({ data }: DeviceNodeProps) => {
  const { device, isHighlighted, hasQuery, iconMode, iconStyle, lod, onHover } = data;
  const [isHovered, setIsHovered] = useState(false);
  const handleMouseEnter = (e: React.MouseEvent) => {
    setIsHovered(true);
    const rect = e.currentTarget.getBoundingClientRect();
    onHover(device.id, { x: rect.right, y: rect.top + rect.height / 2 });
  };
  
  const handleMouseLeave = () => {
    setIsHovered(false);
    onHover(null);
  };
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
        color={(isFancy && lod >= 2) ? '#22d3ee' : undefined}
        className={`${size} ${(isFancy && lod >= 2) ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : roleConfig.color}`}
      />
    );
  };

  if (lod === 0) {
    return (
      <div 
        className={`w-4 h-4 rounded-full border border-white/20 shadow-lg ${roleConfig.bgColor.replace('bg-', 'bg-opacity-80 bg-')} cursor-pointer transition-all duration-300 hover:scale-150 hover:bg-white`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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
    <div
      className="relative flex flex-col items-center gap-2 group w-[120px]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`${lod === 1 ? 'w-10 h-10 rounded-xl' : 'w-14 h-14 rounded-2xl'} border transition-all duration-500 flex items-center justify-center p-3 relative overflow-hidden ${hasQuery && !isHighlighted ? 'opacity-20 scale-90 blur-[0.5px]' : 'opacity-100 scale-100'
        } ${(iconStyle === 'fancy' && lod >= 2)
          ? 'bg-slate-900/40 backdrop-blur-xl shadow-2xl ring-1 ring-white/20 border-white/5'
          : 'bg-slate-900 shadow-sm border-slate-700/40'
        } ${isHighlighted ? 'border-blue-500/80 ring-2 ring-blue-500/30' : ''
        } hover:border-white/40 hover:bg-slate-800/80 transition-shadow`}>
        
        {(iconStyle === 'fancy' && lod >= 2) && (
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
        )}
        
        {/* Connection Handles - 4 on each side for both source and target */}
        <Handle type="target" position={Position.Top} id="t-t" className="!opacity-0 !w-0 !h-0" />
        <Handle type="target" position={Position.Bottom} id="t-b" className="!opacity-0 !w-0 !h-0" />
        <Handle type="target" position={Position.Left} id="t-l" className="!opacity-0 !w-0 !h-0" />
        <Handle type="target" position={Position.Right} id="t-r" className="!opacity-0 !w-0 !h-0" />
        
        <div className={`transition-all duration-500 group-hover:scale-110 ${lod >= 2 ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]' : ''}`}>
          {getIcon(lod === 1 ? "w-5 h-5" : "w-7 h-7")}
        </div>

        <Handle type="source" position={Position.Top} id="s-t" className="!opacity-0 !w-0 !h-0" />
        <Handle type="source" position={Position.Bottom} id="s-b" className="!opacity-0 !w-0 !h-0" />
        <Handle type="source" position={Position.Left} id="s-l" className="!opacity-0 !w-0 !h-0" />
        <Handle type="source" position={Position.Right} id="s-r" className="!opacity-0 !w-0 !h-0" />
      </div>
      {lod >= 2 && (
        <div className="flex flex-col items-center -gap-0.5">
          <p className="text-[11px] font-bold text-slate-300 tracking-tight text-center truncate max-w-[100px] group-hover:text-white transition-colors">
            {device.name}
          </p>
          {lod === 3 && (
            <p className="text-[8px] text-slate-500 font-medium uppercase tracking-tighter opacity-70">
              {device.role}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
DeviceNode.displayName = 'DeviceNode';
