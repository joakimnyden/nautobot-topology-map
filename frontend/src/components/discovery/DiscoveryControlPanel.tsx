import React from 'react';
import { Search, Activity, Database, ChevronDown, RefreshCcw, Zap, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Site } from '../../types';

interface DiscoveryControlPanelProps {
  isStandalone?: boolean;
  selectedSiteId: string;
  setSelectedSiteId: (id: string) => void;
  siteSearch: string;
  setSiteSearch: (val: string) => void;
  showSiteDropdown: boolean;
  setShowSiteDropdown: (val: boolean) => void;
  sites: Site[];
  deviceSearch: string;
  setDeviceSearch: (val: string) => void;
  selectedDevice: string | null;
  setSelectedDevice: (id: string | null) => void;
  showDeviceDropdown: boolean;
  setShowDeviceDropdown: (val: boolean) => void;
  devices: any[];
  isDevicesLoading: boolean;
  isLoading: boolean;
  isDiscoveringAll: boolean;
  discoveryProgress: { current: number; total: number };
  onDiscover: () => void;
  onDiscoverAll: () => void;
}

export const DiscoveryControlPanel: React.FC<DiscoveryControlPanelProps> = ({
  isStandalone,
  selectedSiteId,
  setSelectedSiteId,
  siteSearch,
  setSiteSearch,
  showSiteDropdown,
  setShowSiteDropdown,
  sites,
  deviceSearch,
  setDeviceSearch,
  selectedDevice,
  setSelectedDevice,
  showDeviceDropdown,
  setShowDeviceDropdown,
  devices,
  isDevicesLoading,
  isLoading,
  isDiscoveringAll,
  discoveryProgress,
  onDiscover,
  onDiscoverAll,
}) => {
  const siteRef = React.useRef<HTMLDivElement>(null);
  const deviceRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (siteRef.current && !siteRef.current.contains(event.target as Node)) {
        setShowSiteDropdown(false);
      }
      if (deviceRef.current && !deviceRef.current.contains(event.target as Node)) {
        setShowDeviceDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setShowSiteDropdown, setShowDeviceDropdown]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 relative z-50">
      <div className="lg:col-span-2 bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 shadow-2xl relative">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Database className="w-24 h-24" />
        </div>
        
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Search className="w-5 h-5 text-cyan-400" />
          Target Selection
        </h3>

        <div className="flex flex-col md:flex-row gap-4">
          {isStandalone && (
            <div className="flex-1 w-full group flex flex-col gap-2 relative" ref={siteRef}>
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-[0.2em]">Location</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <input 
                  type="text"
                  placeholder="Search locations..."
                  className={`w-full bg-slate-950/40 border border-slate-700/30 pl-9 pr-10 py-3 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all placeholder:text-slate-600 ${showSiteDropdown ? 'rounded-t-2xl border-b-cyan-500/30' : 'rounded-2xl'}`}
                  value={siteSearch}
                  onChange={(e) => {
                    setSiteSearch(e.target.value);
                    setShowSiteDropdown(true);
                    if (e.target.value === '') setSelectedSiteId('');
                  }}
                  onFocus={() => setShowSiteDropdown(true)}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {siteSearch && (
                    <button onClick={() => { setSiteSearch(''); setSelectedSiteId(''); }} className="p-1 hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-300">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform duration-300 ${showSiteDropdown ? 'rotate-180 text-cyan-400' : ''}`} />
                </div>
              </div>

              <AnimatePresence>
                {showSiteDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-[calc(100%-8px)] left-0 w-full bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-b-2xl shadow-2xl z-[200] max-h-[300px] overflow-hidden flex flex-col"
                  >
                    <div className="overflow-auto py-2 custom-scrollbar flex-1">
                      <div 
                        className={`px-4 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer transition-colors ${!selectedSiteId ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:bg-slate-800'}`}
                        onClick={() => { setSelectedSiteId(''); setSiteSearch(''); setShowSiteDropdown(false); }}
                      >
                        All Locations
                      </div>
                      <div className="h-px bg-slate-800 mx-2 my-1" />
                      {sites
                        .filter(s => s.name.toLowerCase().includes(siteSearch.toLowerCase()))
                        .map(s => (
                          <div 
                            key={s.id} 
                            onClick={() => { 
                              setSelectedSiteId(s.id); 
                              setSiteSearch(s.name); 
                              setShowSiteDropdown(false); 
                            }} 
                            className={`px-4 py-2.5 text-sm cursor-pointer transition-all flex items-center gap-2 group/item ${selectedSiteId === s.id ? 'bg-cyan-500/10 text-cyan-300 border-l-2 border-cyan-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full transition-all ${selectedSiteId === s.id ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]' : 'bg-slate-700 group-hover/item:bg-slate-500'}`} />
                            {s.name}
                          </div>
                        ))
                      }
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          
          <div className="flex-1 w-full group flex flex-col gap-2 relative" ref={deviceRef}>
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Device</label>
              {devices.length > 0 && (
                <span className="text-[9px] font-black text-cyan-400/70 bg-cyan-500/5 px-2 py-0.5 rounded-md border border-cyan-500/10 uppercase tracking-tighter">
                  {devices.filter(d => d.id !== 'simulator').length} Found
                </span>
              )}
            </div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <input 
                type="text"
                placeholder={isDevicesLoading ? "Loading inventory..." : "Select target device..."}
                className={`w-full bg-slate-950/40 border border-slate-700/30 pl-9 pr-10 py-3 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all placeholder:text-slate-600 ${showDeviceDropdown ? 'rounded-t-2xl border-b-cyan-500/30' : 'rounded-2xl'} ${isDevicesLoading ? 'opacity-50 cursor-wait' : ''}`}
                value={deviceSearch}
                onChange={(e) => {
                  setDeviceSearch(e.target.value);
                  setShowDeviceDropdown(true);
                }}
                onFocus={() => setShowDeviceDropdown(true)}
                disabled={isDevicesLoading}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {isDevicesLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-500/50" />
                ) : (
                  <>
                    {deviceSearch && (
                      <button onClick={() => { setDeviceSearch(''); setSelectedDevice(null); }} className="p-1 hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-300">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform duration-300 ${showDeviceDropdown ? 'rotate-180 text-cyan-400' : ''}`} />
                  </>
                )}
              </div>
            </div>

            <AnimatePresence>
              {showDeviceDropdown && !isDevicesLoading && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-[calc(100%-8px)] left-0 w-full bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-b-2xl shadow-2xl z-[200] max-h-[350px] overflow-hidden flex flex-col"
                >
                  <div className="overflow-auto py-2 custom-scrollbar flex-1">
                    {devices
                      .filter(d => {
                        const label = (d.display || d.name || '').toLowerCase();
                        const model = (d.device_type?.model || d.device_type?.name || '').toLowerCase();
                        const search = deviceSearch.toLowerCase();
                        return label.includes(search) || model.includes(search);
                      })
                      .map(d => (
                        <div 
                          key={d.id} 
                          onClick={() => { 
                            setSelectedDevice(d.id); 
                            setDeviceSearch(d.display || d.name || ''); 
                            setShowDeviceDropdown(false); 
                          }} 
                          className={`px-4 py-3 text-sm cursor-pointer transition-all flex flex-col group/item ${selectedDevice === d.id ? 'bg-cyan-500/10 text-cyan-300 border-l-2 border-cyan-500' : 'text-slate-400 hover:bg-slate-800'}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${d.id === 'simulator' ? 'bg-amber-400 animate-pulse' : selectedDevice === d.id ? 'bg-cyan-500' : 'bg-slate-700'}`} />
                            <span className="font-medium">{d.display || d.name}</span>
                          </div>
                          {d.device_type?.model && (
                            <span className="text-[10px] ml-3.5 text-slate-600">{d.device_type.model}</span>
                          )}
                        </div>
                      ))
                    }
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex gap-3 w-full md:w-auto relative z-40">
            <button 
              onClick={onDiscover}
              disabled={!selectedDevice || isLoading}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 ${
                !selectedDevice || isLoading 
                  ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-700/50' 
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/40 hover:shadow-cyan-400/20'
              }`}
            >
              {isLoading && !isDiscoveringAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
              <span>Scan Device</span>
            </button>

            <button 
              onClick={onDiscoverAll}
              disabled={(!selectedSiteId && !isStandalone) || isLoading || devices.length === 0}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 ${
                (!selectedSiteId && !isStandalone) || isLoading || devices.length === 0
                  ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-700/50' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 hover:shadow-emerald-400/20'
              }`}
            >
              {isDiscoveringAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              <span>Scan Site</span>
            </button>
          </div>
        </div>

        {isDiscoveringAll && (
          <div className="mt-8">
            <div className="flex justify-between text-xs font-medium text-slate-500 mb-2">
              <span>Discovery Progress</span>
              <span>{Math.round((discoveryProgress.current / discoveryProgress.total) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-700/50">
              <div 
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                style={{ width: `${(discoveryProgress.current / discoveryProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
