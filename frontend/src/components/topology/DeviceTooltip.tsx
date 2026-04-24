import React from 'react';
import { motion } from 'motion/react';
import { ExternalLink, Server } from 'lucide-react';
import { Device, DeviceStatus } from '../../types';
import { getRoleConfig, ROLE_ICON_MAPPING } from '../../config/topologyConfig';

interface DeviceTooltipProps {
  hoveredDeviceId: string;
  hoveredDevicePos: { x: number; y: number };
  deviceMap: Map<string, Device>;
  iconStyle: 'simple' | 'fancy';
  setHoveredDeviceId: (val: any) => void;
  tooltipTimeout: React.MutableRefObject<any>;
}
export const DeviceTooltip = ({
  hoveredDeviceId,
  hoveredDevicePos,
  deviceMap,
  iconStyle,
  setHoveredDeviceId,
  tooltipTimeout
}: DeviceTooltipProps) => {
  const device = deviceMap.get(hoveredDeviceId);
  if (!device) return null;
  const roleConfig = getRoleConfig(device.role);
  const RoleIcon = ROLE_ICON_MAPPING[device.role]?.icon || Server;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className={`fixed z-[1000] min-w-[240px] border border-slate-700/50 rounded-2xl p-4 shadow-2xl pointer-events-auto cursor-default ${iconStyle === 'fancy' ? 'bg-slate-900/95 backdrop-blur-2xl' : 'bg-slate-950'}`}
      style={{ 
        left: Math.min(window.innerWidth - 300, hoveredDevicePos.x + 20), 
        top: Math.min(window.innerHeight - 400, hoveredDevicePos.y - 20) 
      }}
      onMouseEnter={() => {
        if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
      }}
      onMouseLeave={() => {
        tooltipTimeout.current = setTimeout(() => {
          setHoveredDeviceId(null);
        }, 300);
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            {device.nautobotUrl ? (
              <a 
                href={device.nautobotUrl} 
                target="_blank" 
                className="text-sm font-bold text-white hover:text-blue-400 transition-colors flex items-center gap-2 no-underline group/link"
              >
                {device.name}
                <ExternalLink className="w-3 h-3 text-slate-500 group-hover/link:text-blue-400 transition-colors" />
              </a>
            ) : (
              <h3 className="text-sm font-bold text-white">{device.name}</h3>
            )}
            <div className={`w-2 h-2 rounded-full ${device.status === DeviceStatus.ACTIVE ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-500'}`} />
          </div>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">{device.role}</p>
        </div>
        <div className={`p-1.5 rounded-lg ${roleConfig.bgColor} border ${roleConfig.borderColor}`}>
          <RoleIcon className="w-4 h-4" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Primary IP</span>
          <span className="text-xs font-mono text-blue-400">{device.primaryIp || 'No IP Assigned'}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Device Type</span>
          <span className="text-xs text-slate-200 font-semibold">{device.deviceType}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Platform</span>
          <span className="text-xs text-slate-300">{device.platform || 'N/A'}</span>
        </div>
        {device.vendor && (
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Manufacturer</span>
            <span className="text-xs text-slate-200">{device.vendor}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};
