import React, { useState } from 'react';
import { Site, Device, Link } from '../types';
import { MOCK_DEVICES, MOCK_LINKS } from '../mockData';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Share2, Download, Settings, GitGraph, Plus, Minus, RotateCcw } from 'lucide-react';
import { ROLE_ICON_MAPPING } from '../config/topologyConfig';
import { ReactFlowProvider } from '@xyflow/react';
import DeviceFlow from './DeviceFlow';

interface SiteTopologyProps {
  site: Site;
  onBack: () => void;
}

export default function SiteTopology({ site, onBack }: SiteTopologyProps) {
  const [viewMode, setViewMode] = useState<'topology' | 'image'>('topology');
  
  // Filter devices and links for this site
  const siteDevices = MOCK_DEVICES.filter(d => d.siteId === site.id);
  const deviceIds = new Set(siteDevices.map(d => d.id));
  const siteLinks = MOCK_LINKS.filter(l => deviceIds.has(l.source as string) && deviceIds.has(l.target as string));

  return (
    <div className="relative w-full h-full bg-[#0f172a] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Header */}
      <div className="absolute top-8 left-8 right-8 z-10 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4 group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs uppercase tracking-widest font-mono">Back to Global</span>
          </button>
          <h2 className="text-4xl font-bold text-slate-100 tracking-tight">{site.name}</h2>
          <div className="flex gap-4 mt-2">
            <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Site ID: {site.id}</span>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{site.region}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-4 pointer-events-auto">
          <div className="flex gap-2">
            <button 
              onClick={() => alert('Share functionality coming soon!')}
              className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
            >
              <Share2 className="w-4 h-4 text-slate-400" />
            </button>
            <button 
              onClick={() => alert('Download functionality coming soon!')}
              className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
            >
              <Download className="w-4 h-4 text-slate-400" />
            </button>
            <button 
              onClick={() => alert('Settings functionality coming soon!')}
              className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="w-full h-full">
        <ReactFlowProvider>
          <DeviceFlow 
            devices={siteDevices} 
            links={siteLinks} 
            siteId={site.id} 
          />
        </ReactFlowProvider>
      </div>

      {/* Legend */}
      <div className="absolute top-48 left-8 bg-[#1e293b]/90 backdrop-blur border border-slate-700 p-4 rounded-2xl z-10 pointer-events-none shadow-2xl">
        <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Topology Legend</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(ROLE_ICON_MAPPING).filter(([key]) => key !== 'generic').map(([key, config]) => {
              const Icon = config.icon;
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded ${config.bgColor} border ${config.borderColor} flex items-center justify-center`}>
                    <Icon className={`w-3 h-3 ${config.color}`} />
                  </div>
                  <span className="text-xs text-slate-300">{config.label}</span>
                </div>
              );
            })}
          </div>
          
          <div className="h-px bg-slate-700 my-1" />
          
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-0.5 bg-slate-500" />
              <span className="text-xs text-slate-300">Physical Link</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-1.5 bg-slate-500 rounded-full" />
              <span className="text-xs text-slate-300">Port-Channel (LAG)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-0.5 border-t border-dashed border-emerald-500" />
              <span className="text-xs text-slate-300">Logical (BGP/HSRP)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
