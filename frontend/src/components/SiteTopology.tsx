import React, { useState, useEffect, useRef } from 'react';
import { Site, Device, Link } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Share2, Download, Settings, Plus, Minus, RotateCcw, Loader2 } from 'lucide-react';
import { ROLE_ICON_MAPPING } from '../config/topologyConfig';
import { ReactFlowProvider } from '@xyflow/react';
import DeviceFlow from './DeviceFlow';

import { toPng } from 'html-to-image';
interface SiteTopologyProps {
  site: Site;
  onBack: () => void;
}

export default function SiteTopology({ site, onBack }: SiteTopologyProps) {
  const [viewMode, setViewMode] = useState<'topology' | 'image'>('topology');
  const [devices, setDevices] = useState<Device[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [availableVlans, setAvailableVlans] = useState<string[]>([]);
  const [availablePrefixes, setAvailablePrefixes] = useState<string[]>([]);
  const [prometheusEnabled, setPrometheusEnabled] = useState(false);
  const [apRoleName, setApRoleName] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const topologyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/plugins/nautobot_topology/topology/${site.id}/`)
      .then(res => res.json())
      .then(response => {
        if (response.status === 'success') {
          setDevices(response.data.nodes || []);
          setLinks(response.data.links || []);
          setAvailableVlans(response.data.availableVlans || []);
          setAvailablePrefixes(response.data.availablePrefixes || []);
          setPrometheusEnabled(response.data.config?.prometheus_enabled || false);
          setApRoleName(response.data.config?.ap_role_name);
        } else {
          setError(response.message || 'Failed to fetch topology');
        }
      })
      .catch(err => {
        console.error('Error fetching topology:', err);
        setError('Network error or server unavailable');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [site.id]);

  return (
    <div ref={topologyRef} className="relative w-full h-full bg-[#0f172a] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Export Status Toast */}
      <AnimatePresence>
        {isExporting && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[1200] px-6 py-3 bg-blue-600/20 backdrop-blur-xl border border-blue-500/30 rounded-2xl flex items-center gap-3 shadow-2xl"
          >
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Generating Snapshot...</span>
          </motion.div>
        )}
      </AnimatePresence>

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
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">{site.region || 'Unknown Region'} {site.country ? `> ${site.country}` : ''}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-4 pointer-events-auto">
          <div className="flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('URL copied to clipboard! Share this link.');
              }}
              className="p-3 bg-slate-800/80 backdrop-blur-md hover:bg-slate-700/80 rounded-2xl border border-slate-700/50 shadow-xl transition-all"
              title="Share"
            >
              <Share2 className="w-4 h-4 text-slate-400 hover:text-slate-200" />
            </button>

            <button
              disabled={isExporting}
              onClick={() => {
                if (!topologyRef.current || isExporting) return;
                setIsExporting(true);
                
                toPng(topologyRef.current, { 
                  backgroundColor: '#0f172a',
                  cacheBust: true,
                })
                .then(dataUrl => {
                  const cleanName = (site.name || 'topology').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                  const a = document.createElement('a');
                  a.href = dataUrl;
                  a.download = `${cleanName}.png`;
                  a.click();
                })
                .catch(err => {
                  console.error('Export error:', err);
                  alert('Export failed. This usually happens with very large maps or security restrictions on icons.');
                })
                .finally(() => setIsExporting(false));
              }}
              className="p-3 bg-slate-800/80 backdrop-blur-md hover:bg-slate-700/80 rounded-2xl border border-slate-700/50 shadow-xl transition-all disabled:opacity-50"
              title="Download as PNG"
            >
              <Download className="w-4 h-4 text-slate-400 hover:text-slate-200" />
            </button>
            <button
              onClick={() => {
                const wantsHD = window.confirm('Settings Configuration:\n\nCurrently no settings are required. Do you want to enable High Contrast Mode (Demo)?');
                if (wantsHD) document.body.classList.toggle('high-contrast');
              }}
              className="p-3 bg-slate-800/80 backdrop-blur-md hover:bg-slate-700/80 rounded-2xl border border-slate-700/50 shadow-xl transition-all"
              title="Config / Settings"
            >
              <Settings className="w-4 h-4 text-slate-400 hover:text-slate-200" />
            </button>
          </div>
        </div>
      </div>

      <div className="w-full h-full flex items-center justify-center">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="font-mono text-xs uppercase tracking-widest">Compiling Topology...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4 text-red-400">
            <span className="font-mono text-sm uppercase tracking-widest">Error Loading Topology</span>
            <span className="text-xs">{error}</span>
          </div>
        ) : (
          <ReactFlowProvider>
            <DeviceFlow
              devices={devices}
              links={links}
              siteId={site.id}
              availableVlans={availableVlans}
              availablePrefixes={availablePrefixes}
              prometheusEnabled={prometheusEnabled}
              apRoleName={apRoleName}
            />
          </ReactFlowProvider>
        )}
      </div>

      {/* Legend */}
      <div className="absolute top-48 left-8 bg-[#1e293b]/90 backdrop-blur border border-slate-700 p-6 rounded-3xl z-10 pointer-events-none shadow-2xl min-h-[260px] min-w-[220px]">
        <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Topology Legend</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(ROLE_ICON_MAPPING).filter(([key]) => key !== 'generic').map(([key, config]) => {
              const Icon = config.icon;
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded ${config.bgColor} border ${config.borderColor} flex items-center justify-center`}>
                    <Icon className={`w-3 h-3 ${config.color}`} color="currentColor" />
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
