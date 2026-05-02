import React, { useState, useEffect } from 'react';
import { 
  Search, 
  RefreshCcw, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  ArrowRight, 
  Database, 
  Layout, 
  Activity,
  ChevronRight,
  ChevronDown,
  Import,
  Loader2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Site } from '../types';

declare global {
  interface Window {
    NAUTOBOT_PAGE: string;
    NAUTOBOT_SIMULATOR_ENABLED: boolean;
  }
}

interface CableDiscoveryProps {
  site?: Site;
  onClose?: () => void;
  isStandalone?: boolean;
}

export default function CableDiscovery({ site, onClose, isStandalone }: CableDiscoveryProps) {
  const [selectedSiteId, setSelectedSiteId] = useState<string>(site?.id || '');
  const [sites, setSites] = useState<Site[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDiscoveringAll, setIsDiscoveringAll] = useState(false);
  const [discoveryProgress, setDiscoveryProgress] = useState({ current: 0, total: 0 });
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDevicesLoading, setIsDevicesLoading] = useState(false);
  const [cableType, setCableType] = useState('cat6a');
  const [siteSearch, setSiteSearch] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [resultSearch, setResultSearch] = useState('');
  const [showSiteDropdown, setShowSiteDropdown] = useState(false);
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  
  // Refs for click outside
  const siteRef = React.useRef<HTMLDivElement>(null);
  const deviceRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
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
  }, []);

  // Fetch sites for standalone mode
  useEffect(() => {
    if (isStandalone) {
      // Use our filtered topology API instead of core DCIM locations
      // This ensures we only see locations that have devices (based on our new filter)
      fetch('/api/plugins/nautobot_topology/topology/')
        .then(res => res.json())
        .then(response => {
          if (response.status === 'success' && response.data.nodes) {
            setSites(response.data.nodes);
          }
        })
        .catch(err => console.error('Failed to fetch filtered sites:', err));
    }
  }, [isStandalone]);

  // Fetch devices when site selection changes
  useEffect(() => {
    console.log('Fetching devices for site:', selectedSiteId);
    
    if (!selectedSiteId && isStandalone) {
      setDevices([]);
      return;
    }
    
    // Test Simulator device should always be available
    const testDevice = {
      id: 'simulator',
      name: '✨ Discovery Simulator',
      display: '✨ Discovery Simulator',
      device_type: { model: 'Virtual-Simulation-Node' },
      primary_ip: '127.0.0.1'
    };

    const url = selectedSiteId 
      ? `/api/dcim/devices/?location=${selectedSiteId}&limit=1000`
      : `/api/dcim/devices/?limit=1000`;

    setIsDevicesLoading(true);
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log(`Discovery: Fetched ${data?.results?.length || 0} devices from ${url}`);
        if (data && data.results) {
          // Robust filter for devices with IPs
          const filtered = data.results.filter((d: any) => {
            const hasIp = !!(
              d.primary_ip || 
              d.primary_ip4 || 
              d.primary_ip6 || 
              d.primary_ip_address || 
              (d.primary_ip4 && d.primary_ip4.display) ||
              (d.primary_ip6 && d.primary_ip6.display)
            );
            return hasIp;
          });
          
          console.log(`Discovery: ${filtered.length} devices remained after IP filtering`);
          if (data.results.length > 0 && filtered.length === 0) {
            console.warn('Discovery: Devices found but NONE had primary IPs. Sample device:', data.results[0]);
          }

          if (window.NAUTOBOT_SIMULATOR_ENABLED) {
            setDevices([testDevice, ...filtered]);
          } else {
            setDevices(filtered);
          }
        } else {
          setDevices(window.NAUTOBOT_SIMULATOR_ENABLED ? [testDevice] : []);
        }
      })
      .catch(err => {
        console.error('Failed to fetch devices:', err);
        setError(`Failed to fetch devices: ${err.message}`);
        setDevices(window.NAUTOBOT_SIMULATOR_ENABLED ? [testDevice] : []);
      })
      .finally(() => {
        setIsDevicesLoading(false);
      });
  }, [selectedSiteId, isStandalone]);

  const handleDiscover = async (deviceId?: string) => {
    const targetId = deviceId || selectedDevice;
    if (!targetId) return;
    
    if (!deviceId) {
      setIsLoading(true);
      setError(null);
      setMessage('Connecting to device...');
      setResults([]);
    }

    // Handle Simulator
    if (targetId === 'simulator') {
      await new Promise(resolve => setTimeout(resolve, 1200));
      const mockData = [
        {
          local_interface: 'GigabitEthernet1/0/1',
          local_interface_type: 'Interface',
          local_interface_id: '11111111-1111-4111-a111-111111111111',
          remote_device: 'core-switch-01',
          remote_device_id: '22222222-2222-4222-a222-222222222222',
          remote_interface: 'TenGigabitEthernet1/1',
          remote_interface_id: '33333333-3333-4333-a333-333333333333',
          remote_interface_type: 'Interface',
          protocol: 'lldp',
          is_matched: true,
          cable_exists: false
        },
        {
          local_interface: 'GigabitEthernet1/0/2',
          local_interface_type: 'Interface',
          local_interface_id: '44444444-4444-4444-a444-444444444444',
          remote_device: 'unknown-switch',
          remote_device_id: null,
          remote_interface: 'eth0',
          remote_interface_id: null,
          remote_interface_type: 'Interface',
          protocol: 'cdp',
          is_matched: false,
          cable_exists: false
        },
        {
          local_interface: 'GigabitEthernet1/0/3',
          local_interface_type: 'Interface',
          local_interface_id: '55555555-5555-4555-a555-555555555555',
          remote_device: 'distribution-02',
          remote_device_id: '66666666-6666-4666-a666-666666666666',
          remote_interface: 'GigabitEthernet2/0/1',
          remote_interface_id: '77777777-7777-4777-a777-777777777777',
          remote_interface_type: 'Interface',
          protocol: 'lldp',
          is_matched: true,
          cable_exists: true
        },
        {
          local_interface: 'Port 1',
          local_interface_type: 'FrontPort',
          local_interface_id: 'aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa',
          remote_device: 'patch-panel-01',
          remote_device_id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
          remote_interface: 'Port 24',
          remote_interface_id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
          remote_interface_type: 'RearPort',
          protocol: 'lldp',
          is_matched: true,
          cable_exists: false
        },
        {
          local_interface: 'TenGigabitEthernet1/1/1',
          local_interface_type: 'Interface',
          local_interface_id: 'dddddddd-dddd-4ddd-addd-dddddddddddd',
          local_lag: 'Port-channel10',
          remote_device: 'leaf-02',
          remote_device_id: 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee',
          remote_interface: 'eth1/1',
          remote_interface_id: 'ffffffff-ffff-4fff-afff-ffffffffffff',
          remote_interface_type: 'Interface',
          remote_lag: 'ae1',
          protocol: 'lldp',
          is_matched: true,
          cable_exists: false
        }
      ];

      if (deviceId) {
        setResults(prev => [...prev, ...mockData]);
        return mockData;
      } else {
        setResults(mockData);
        setMessage(`SIMULATION: Discovered ${mockData.length} mock connections.`);
        setIsLoading(false);
        return;
      }
    }
    
    try {
      const res = await fetch(`/api/plugins/nautobot_topology/topology/${targetId}/discover_cables/`);
      const data = await res.json();
      
      if (data.status === 'success') {
        const enrichedData = data.data.map((r: any) => ({ ...r, type: cableType }));
        if (deviceId) {
          setResults(prev => [...prev, ...enrichedData]);
          return enrichedData;
        } else {
          setResults(enrichedData);
          setMessage(`Discovered ${enrichedData.length} neighbors.`);
        }
      } else {
        if (!deviceId) setError(data.message);
      }
    } catch (err: any) {
      if (!deviceId) setError(err.message);
    } finally {
      if (!deviceId) setIsLoading(false);
    }
  };

  const handleDiscoverAll = async () => {
    if (!selectedSiteId && !site?.id) return;
    
    setIsLoading(true);
    setIsDiscoveringAll(true);
    setError(null);
    setResults([]);
    setDiscoveryProgress({ current: 0, total: devices.length });

    let totalDiscovered = 0;
    const allResults: any[] = [];
    for (let i = 0; i < devices.length; i++) {
      const device = devices[i];
      setDiscoveryProgress({ current: i + 1, total: devices.length });
      setMessage(`[${i + 1}/${devices.length}] Scanning ${device.name}...`);
      
      const discovered = await handleDiscover(device.id);
      if (discovered) {
        totalDiscovered += discovered.length;
        // handleDiscover already updates results state, but we return it for total count
      }
    }

    setIsLoading(false);
    setIsDiscoveringAll(false);
    setMessage(`Scan complete. Found ${totalDiscovered} connections across ${devices.length} devices.`);
  };

  const handleImport = () => {
    const validCables = results.filter(r => r.is_matched && !r.cable_exists);
    if (validCables.length === 0) return;

    setImporting(true);
    setError(null);
    setMessage(`Importing ${validCables.length} cables...`);
    
    fetch('/api/plugins/nautobot_topology/topology/import_cables/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1] || ''
      },
      body: JSON.stringify({ 
        cables: validCables.map(c => ({ 
          ...c, 
          type: c.type || cableType 
        })) 
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setMessage(`Successfully imported ${data.created} cables.`);
          setResults(results.map(r => r.is_matched ? { ...r, cable_exists: true } : r));
        } else {
          setError(`Import partial. ${data.created} created. Errors: ${data.errors.join(', ')}`);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setImporting(false));
  };

  return (
    <div className="w-full flex flex-col h-screen max-h-[calc(100vh-120px)] bg-transparent text-slate-200 relative z-10 overflow-hidden px-1">
      {/* Central Loading Overlay for initial device fetch */}
      {isDevicesLoading && devices.length === 0 && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm rounded-3xl">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
            <Loader2 className="w-8 h-8 text-cyan-400 animate-pulse absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-4 text-cyan-400 font-medium animate-pulse uppercase tracking-widest text-xs">Loading devices...</p>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-widest mb-2">
            <Layout className="w-3 h-3" />
            <span>Plugin</span>
            <ChevronRight className="w-3 h-3" />
            <span>Topology</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-cyan-400">Cable Discovery</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Discovery Engine
          </h1>
          <p className="text-slate-400 mt-1 max-w-2xl">
            Audit physical connectivity using LLDP/CDP protocols. Map your network directly from switch logic to Nautobot.
          </p>
        </div>
        
        {!isStandalone && onClose && (
          <button 
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium border border-slate-700/50 transition-all active:scale-95"
          >
            Exit Discovery
          </button>
        )}
      </div>

      {/* Control Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 relative z-50">
        {/* Site & Device Selection Card */}
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
                        {sites.filter(s => s.name.toLowerCase().includes(siteSearch.toLowerCase())).length === 0 && (
                          <div className="px-4 py-8 text-center text-xs text-slate-600 italic">
                            No locations matching "{siteSearch}"
                          </div>
                        )}
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
                    // Don't reset selectedDevice immediately unless searching
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
                        .map(d => {
                          const label = d.display || d.name || 'Unknown Device';
                          const model = d.device_type?.model || d.device_type?.name || '';
                          const isSim = d.id === 'simulator';
                          
                          return (
                            <div 
                              key={d.id} 
                              onClick={() => { 
                                setSelectedDevice(d.id); 
                                setDeviceSearch(label); 
                                setShowDeviceDropdown(false); 
                              }} 
                              className={`px-4 py-3 text-sm cursor-pointer transition-all flex flex-col group/item ${selectedDevice === d.id ? 'bg-cyan-500/10 text-cyan-300 border-l-2 border-cyan-500' : 'text-slate-400 hover:bg-slate-800'}`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${isSim ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.5)]' : selectedDevice === d.id ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]' : 'bg-slate-700 group-hover/item:bg-slate-500'}`} />
                                <span className={selectedDevice === d.id ? 'font-bold' : 'font-medium'}>{label}</span>
                              </div>
                              {model && (
                                <span className={`text-[10px] ml-3.5 uppercase tracking-tight ${selectedDevice === d.id ? 'text-cyan-500/60' : 'text-slate-600'}`}>
                                  {model}
                                </span>
                              )}
                            </div>
                          );
                        })
                      }
                      {devices.filter(d => {
                        const label = (d.display || d.name || '').toLowerCase();
                        const model = (d.device_type?.model || d.device_type?.name || '').toLowerCase();
                        return label.includes(deviceSearch.toLowerCase()) || model.includes(deviceSearch.toLowerCase());
                      }).length === 0 && (
                        <div className="px-4 py-8 text-center text-xs text-slate-600 italic">
                          No devices found matching "{deviceSearch}"
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex gap-3 w-full md:w-auto relative z-40">
              <button 
                onClick={() => { console.log('Scan Device clicked'); handleDiscover(); }}
                disabled={!selectedDevice || isLoading}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 pointer-events-auto ${
                  !selectedDevice || isLoading 
                    ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-700/50' 
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/40 hover:shadow-cyan-400/20'
                }`}
              >
                {isLoading && !isDiscoveringAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                <span>Scan Device</span>
              </button>

              <button 
                onClick={() => { console.log('Scan Site clicked'); handleDiscoverAll(); }}
                disabled={(!selectedSiteId && !site?.id) || isLoading || devices.length === 0}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 pointer-events-auto ${
                  (!selectedSiteId && !site?.id) || isLoading || devices.length === 0
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

        {/* Status & Summary Card */}
        <div className="bg-slate-800/20 backdrop-blur-sm border border-slate-700/50 rounded-3xl p-6 flex flex-col justify-between relative">
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-400">
              <Activity className="w-5 h-5" />
              Engine Log
            </h3>
            {error ? (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            ) : message ? (
              <div className="flex items-start gap-3 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl text-cyan-300 text-sm">
                <Loader2 className={`w-5 h-5 flex-shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
                <p>{message}</p>
              </div>
            ) : (
              <div className="text-slate-500 text-sm italic py-4">
                Waiting for scan initialization...
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Total Results</span>
                <span className="font-bold text-white">{results.length}</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-2">
                <span className="text-slate-500">Ready to Import</span>
                <span className="font-bold text-emerald-400">{results.filter(r => r.is_matched && !r.cable_exists).length}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      {results.length > 0 && (
        <div className="flex-1 min-h-0 bg-slate-800/30 rounded-3xl border border-slate-700/50 overflow-hidden flex flex-col shadow-inner mb-4">
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10 border-b border-slate-700/50">
                <tr className="bg-slate-900/80">
                  <th colSpan={6} className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                          type="text"
                          placeholder="Filter discovery results by interface, device, or protocol..."
                          className="w-full bg-slate-950/60 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all placeholder:text-slate-600"
                          value={resultSearch}
                          onChange={(e) => setResultSearch(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-auto">
                        <Activity className="w-3 h-3 text-cyan-500/50" />
                        <span>Live Filter Active</span>
                      </div>
                    </div>
                  </th>
                </tr>
                <tr>
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-tighter text-xs">Local Interface</th>
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-tighter text-xs">Connection Path</th>
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-tighter text-xs">Remote Interface</th>
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-tighter text-xs">Protocol</th>
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-tighter text-xs">Media Type</th>
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-tighter text-xs text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {results
                  .filter(r => {
                    const search = resultSearch.toLowerCase();
                    return (
                      r.local_interface.toLowerCase().includes(search) ||
                      r.remote_device.toLowerCase().includes(search) ||
                      r.remote_interface.toLowerCase().includes(search) ||
                      (r.protocol || '').toLowerCase().includes(search)
                    );
                  })
                  .map((r, i) => (
                    <tr key={i} className={`hover:bg-white/5 transition-colors group ${r.cable_exists ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-100">{r.local_interface}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 opacity-60 uppercase font-bold tracking-widest">{r.local_interface_type || 'interface'}</span>
                          {r.local_lag && (
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 font-bold">
                              {r.local_lag}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono mt-1">{r.local_interface_id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-500 transition-colors" />
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-300">{r.remote_device}</span>
                          <span className="text-[10px] text-slate-500">Peer Hardware</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                       <span className="font-mono text-cyan-400/80 bg-cyan-500/5 px-2 py-1 rounded-md border border-cyan-500/10">{r.remote_interface}</span>
                       <div className="flex items-center gap-2 mt-1">
                         <div className="text-[10px] text-slate-400 opacity-60 uppercase font-bold tracking-widest">{r.remote_interface_type || 'interface'}</div>
                         {r.remote_lag && (
                           <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 font-bold">
                             {r.remote_lag}
                           </span>
                         )}
                       </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-[10px] px-2 py-1 rounded-md bg-slate-900 text-slate-500 font-bold border border-slate-700">
                        {r.protocol}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <select 
                        value={r.type || cableType}
                        disabled={r.cable_exists}
                        onChange={(e) => {
                          const newResults = [...results];
                          newResults[i] = { ...newResults[i], type: e.target.value };
                          setResults(newResults);
                        }}
                        className={`bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-300 outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all ${r.cable_exists ? 'cursor-not-allowed' : 'cursor-pointer hover:border-slate-500'}`}
                      >
                        <option value="cat6">Cat6</option>
                        <option value="cat6a">Cat6a</option>
                        <option value="fiber-lc">Fiber (LC)</option>
                        <option value="fiber-sc">Fiber (SC)</option>
                        <option value="dac">DAC (Twinax)</option>
                        <option value="aoc">AOC</option>
                        <option value="power">Power</option>
                      </select>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {!r.is_matched ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[11px] font-bold">
                          <AlertCircle className="w-3 h-3" />
                          UNMATCHED
                        </div>
                      ) : r.cable_exists ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-700/50 text-slate-400 border border-slate-600/30 text-[11px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          ALREADY EXISTS
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
                          <Zap className="w-3 h-3 animate-pulse" />
                          READY TO IMPORT
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-6 bg-slate-900/80 backdrop-blur-md border-t border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="text-sm text-slate-400 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-500" />
                <span>Found <span className="text-emerald-400 font-bold underline underline-offset-4 decoration-emerald-500/30">{results.filter(r => r.is_matched && !r.cable_exists).length}</span> missing physical links.</span>
              </div>
              
              <div className="flex items-center gap-3 bg-slate-950/50 p-1.5 rounded-2xl border border-slate-700/50">
                <span className="text-[10px] font-bold text-slate-500 uppercase ml-2">Global Default</span>
                <select 
                  value={cableType}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setCableType(newType);
                    // Optionally update all non-modified rows? Let's just set the default for future scans.
                  }}
                  className="bg-slate-800 border-none rounded-xl px-3 py-1.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all cursor-pointer"
                >
                  <option value="cat6">Cat6</option>
                  <option value="cat6a">Cat6a</option>
                  <option value="fiber-lc">Fiber (LC)</option>
                  <option value="fiber-sc">Fiber (SC)</option>
                  <option value="dac">DAC (Twinax)</option>
                  <option value="aoc">AOC</option>
                  <option value="power">Power</option>
                </select>
                <button 
                  onClick={() => {
                    setResults(results.map(r => r.cable_exists ? r : { ...r, type: cableType }));
                  }}
                  className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 px-2 transition-colors"
                >
                  Apply to All
                </button>
              </div>
            </div>
            <button
              onClick={handleImport}
              disabled={importing || results.filter(r => r.is_matched && !r.cable_exists).length === 0}
              className={`flex items-center gap-3 px-8 py-3 rounded-2xl text-sm font-bold transition-all shadow-xl active:scale-95 ${
                importing || results.filter(r => r.is_matched && !r.cable_exists).length === 0
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-emerald-900/20 hover:shadow-emerald-900/40'
              }`}
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Import className="w-4 h-4" />}
              <span>{importing ? 'Syncing with Nautobot...' : 'Commit to Database'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-60">
          <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-6">
            <Activity className="w-10 h-10 text-slate-600" />
          </div>
          <h4 className="text-xl font-bold text-slate-400 mb-2">No Active Results</h4>
          <p className="text-slate-500 max-w-sm">
            Target a device or site to begin SSH discovery. Ensure SSH credentials and SecretsGroups are configured.
          </p>
        </div>
      )}
    </div>
  );
}
