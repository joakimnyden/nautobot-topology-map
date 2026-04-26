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
  Import,
  Loader2
} from 'lucide-react';
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

  // Fetch sites for standalone mode
  useEffect(() => {
    if (isStandalone) {
      fetch('/api/plugins/nautobot_topology/topology/')
        .then(res => res.json())
        .then(response => {
          if (response.status === 'success') {
            setSites(response.data.nodes || []);
          }
        })
        .catch(err => console.error('Failed to fetch sites:', err));
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
      ? `/api/plugins/nautobot_topology/topology/${selectedSiteId}/devices/`
      : `/api/dcim/devices/?limit=1000`;

    setIsDevicesLoading(true);
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data && data.results) {
          // Permanently filter for scannable devices only
          const scannable = data.results.filter((d: any) => {
            const hasIp = !!(d.primary_ip || d.primary_ip4?.address || d.primary_ip4?.display);
            return d.id === 'simulator' || hasIp;
          });
          
          console.log(`Discovery: ${scannable.length} scannable devices found (from ${data.results.length} total)`);

          if (window.NAUTOBOT_SIMULATOR_ENABLED) {
            setDevices([testDevice, ...scannable]);
          } else {
            setDevices(scannable);
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
    for (let i = 0; i < devices.length; i++) {
      const device = devices[i];
      setDiscoveryProgress({ current: i + 1, total: devices.length });
      setMessage(`[${i + 1}/${devices.length}] Scanning ${device.name}...`);
      
      const discovered = await handleDiscover(device.id);
      if (discovered) {
        totalDiscovered += discovered.length;
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
    <div className="w-full flex flex-col h-full bg-transparent text-ctp-text relative z-10">
      {/* Central Loading Overlay for initial device fetch */}
      {isDevicesLoading && devices.length === 0 && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-ctp-crust/60 backdrop-blur-sm rounded-3xl">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-ctp-sky/20 border-t-ctp-sky rounded-full animate-spin"></div>
            <Loader2 className="w-8 h-8 text-ctp-sky animate-pulse absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-4 text-ctp-sky font-medium animate-pulse uppercase tracking-widest text-xs">Loading devices...</p>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-ctp-subtext0 text-xs uppercase tracking-widest mb-2">
            <Layout className="w-3 h-3" />
            <span>Plugin</span>
            <ChevronRight className="w-3 h-3" />
            <span>Topology</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-ctp-sky">Cable Discovery</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-ctp-subtext1 bg-clip-text text-transparent">
            Discovery Engine
          </h1>
          <p className="text-ctp-subtext1 mt-1 max-w-2xl">
            Audit physical connectivity using LLDP/CDP protocols. Map your network directly from switch logic to Nautobot.
          </p>
        </div>
        
        {!isStandalone && onClose && (
          <button 
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-ctp-mantle hover:bg-ctp-surface0 rounded-xl text-sm font-medium border border-ctp-surface1/50 transition-all active:scale-95"
          >
            Exit Discovery
          </button>
        )}
      </div>

      {/* Control Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Site & Device Selection Card */}
        <div className="lg:col-span-2 bg-ctp-mantle/40 backdrop-blur-md border border-ctp-surface1/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Database className="w-24 h-24" />
          </div>
          
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Search className="w-5 h-5 text-ctp-sky" />
            Target Selection
          </h3>

          <div className="flex flex-col md:flex-row gap-4 items-end">
            {isStandalone && (
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-ctp-subtext0 mb-2 uppercase ml-1">Location</label>
                <select 
                  className="w-full bg-ctp-crust border border-ctp-surface1 rounded-xl px-4 py-3 text-ctp-text outline-none focus:ring-2 focus:ring-ctp-sky/20 focus:border-ctp-sky transition-all cursor-pointer relative z-30"
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                >
                  <option value="">All Locations</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            
            <div className="flex-1 w-full">
              <div className="flex justify-between items-center mb-2 px-1">
                <label className="block text-xs font-medium text-ctp-subtext0 uppercase">Device</label>
                  <span className="text-[10px] font-bold text-ctp-overlay1 bg-ctp-crust/50 px-2 py-0.5 rounded-full border border-ctp-surface1/50">
                    {devices.filter(d => d.id !== 'simulator').length} FOUND
                  </span>
              </div>
              <div className="relative">
                <select 
                  className={`w-full bg-ctp-crust border border-ctp-surface1 rounded-xl px-4 py-3 text-ctp-text outline-none focus:ring-2 focus:ring-ctp-sky/20 focus:border-ctp-sky transition-all cursor-pointer relative z-30 ${isDevicesLoading ? 'opacity-50' : ''}`}
                  value={selectedDevice || ''}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  disabled={isDevicesLoading}
                >
                  <option value="">{isDevicesLoading ? 'Loading devices...' : '-- Choose target --'}</option>
                  {devices.map(d => {
                    const label = d.display || d.name || 'Unknown Device';
                    const model = d.device_type?.model || d.device_type?.name || '';
                    const ip = d.primary_ip || d.primary_ip4?.address || d.primary_ip4?.display || '';
                    return (
                      <option key={d.id} value={d.id}>
                        {label}{model ? ` (${model})` : ''}{ip ? ` - ${ip}` : ''}
                      </option>
                    );
                  })}
                </select>
                {isDevicesLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 z-40 pointer-events-none">
                    <Loader2 className="w-4 h-4 animate-spin text-ctp-sky" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 w-full md:w-auto relative z-40">
              <button 
                onClick={() => { console.log('Scan Device clicked'); handleDiscover(); }}
                disabled={!selectedDevice || isLoading}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 pointer-events-auto ${
                  !selectedDevice || isLoading 
                    ? 'bg-ctp-surface1/50 text-ctp-subtext0 cursor-not-allowed border border-ctp-surface1/50' 
                    : 'bg-ctp-blue hover:bg-ctp-sapphire text-white shadow-ctp-blue/40 hover:shadow-ctp-blue/20'
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
                    ? 'bg-ctp-surface1/50 text-ctp-subtext0 cursor-not-allowed border border-ctp-surface1/50' 
                    : 'bg-ctp-green hover:bg-ctp-teal text-white shadow-ctp-green/40 hover:shadow-ctp-green/20'
                }`}
              >
                {isDiscoveringAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                <span>Scan Site</span>
              </button>
            </div>
          </div>

          {isDiscoveringAll && (
            <div className="mt-8">
              <div className="flex justify-between text-xs font-medium text-ctp-subtext0 mb-2">
                <span>Discovery Progress</span>
                <span>{Math.round((discoveryProgress.current / discoveryProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-ctp-crust h-2.5 rounded-full overflow-hidden border border-ctp-surface1/50">
                <div 
                  className="h-full bg-gradient-to-r from-ctp-green to-ctp-teal transition-all duration-500 ease-out shadow-[0_0_10px_rgba(166,218,149,0.3)]"
                  style={{ width: `${(discoveryProgress.current / discoveryProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Status & Summary Card */}
        <div className="bg-ctp-mantle/20 backdrop-blur-sm border border-ctp-surface1/50 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-ctp-subtext1">
              <Activity className="w-5 h-5" />
              Engine Log
            </h3>
            {error ? (
              <div className="flex items-start gap-3 p-4 bg-ctp-red/10 border border-ctp-red/20 rounded-2xl text-ctp-red text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            ) : message ? (
              <div className="flex items-start gap-3 p-4 bg-ctp-sky/10 border border-ctp-sky/20 rounded-2xl text-ctp-sky text-sm">
                <Loader2 className={`w-5 h-5 flex-shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
                <p>{message}</p>
              </div>
            ) : (
              <div className="text-ctp-overlay1 text-sm italic py-4">
                Waiting for scan initialization...
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div className="mt-4 pt-4 border-t border-ctp-surface1/50">
              <div className="flex justify-between items-center text-sm">
                <span className="text-ctp-subtext0">Total Results</span>
                <span className="font-bold text-ctp-text">{results.length}</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-2">
                <span className="text-ctp-subtext0">Ready to Import</span>
                <span className="font-bold text-ctp-green">{results.filter(r => r.is_matched && !r.cable_exists).length}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      {results.length > 0 && (
        <div className="flex-1 min-h-0 bg-ctp-mantle/30 rounded-3xl border border-ctp-surface1/50 overflow-hidden flex flex-col shadow-inner">
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-ctp-crust/50 backdrop-blur-xl sticky top-0 z-10 border-b border-ctp-surface1/50">
                <tr>
                  <th className="px-6 py-4 font-bold text-ctp-subtext0 uppercase tracking-tighter text-xs">Local Interface</th>
                  <th className="px-6 py-4 font-bold text-ctp-subtext0 uppercase tracking-tighter text-xs">Connection Path</th>
                  <th className="px-6 py-4 font-bold text-ctp-subtext0 uppercase tracking-tighter text-xs">Remote Interface</th>
                  <th className="px-6 py-4 font-bold text-ctp-subtext0 uppercase tracking-tighter text-xs">Protocol</th>
                  <th className="px-6 py-4 font-bold text-ctp-subtext0 uppercase tracking-tighter text-xs">Media Type</th>
                  <th className="px-6 py-4 font-bold text-ctp-subtext0 uppercase tracking-tighter text-xs text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ctp-surface1/30">
                {results.map((r, i) => (
                  <tr key={i} className={`hover:bg-ctp-surface0/30 transition-colors group ${r.cable_exists ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-ctp-text">{r.local_interface}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-ctp-subtext1 opacity-60 uppercase font-bold tracking-widest">{r.local_interface_type || 'interface'}</span>
                          {r.local_lag && (
                            <span className="text-[10px] bg-ctp-lavender/10 text-ctp-lavender px-1.5 py-0.5 rounded border border-ctp-lavender/20 font-bold">
                              {r.local_lag}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-ctp-subtext0 font-mono mt-1">{r.local_interface_id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <ArrowRight className="w-4 h-4 text-ctp-overlay1 group-hover:text-ctp-sky transition-colors" />
                        <div className="flex flex-col">
                          <span className="font-bold text-ctp-subtext1">{r.remote_device}</span>
                          <span className="text-[10px] text-ctp-subtext0">Peer Hardware</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                       <span className="font-mono text-ctp-sky/80 bg-ctp-sky/5 px-2 py-1 rounded-md border border-ctp-sky/10">{r.remote_interface}</span>
                       <div className="flex items-center gap-2 mt-1">
                         <div className="text-[10px] text-ctp-subtext1 opacity-60 uppercase font-bold tracking-widest">{r.remote_interface_type || 'interface'}</div>
                         {r.remote_lag && (
                           <span className="text-[10px] bg-ctp-lavender/10 text-ctp-lavender px-1.5 py-0.5 rounded border border-ctp-lavender/20 font-bold">
                             {r.remote_lag}
                           </span>
                         )}
                       </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-[10px] px-2 py-1 rounded-md bg-ctp-crust text-ctp-subtext0 font-bold border border-ctp-surface1">
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
                        className={`bg-ctp-crust/50 border border-ctp-surface1 rounded-lg px-2 py-1 text-[11px] text-ctp-subtext1 outline-none focus:ring-1 focus:ring-ctp-sky/50 transition-all ${r.cable_exists ? 'cursor-not-allowed' : 'cursor-pointer hover:border-ctp-overlay0'}`}
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
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ctp-peach/10 text-ctp-peach border border-ctp-peach/20 text-[11px] font-bold">
                          <AlertCircle className="w-3 h-3" />
                          UNMATCHED
                        </div>
                      ) : r.cable_exists ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ctp-surface1/50 text-ctp-subtext0 border border-ctp-surface2/30 text-[11px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          ALREADY EXISTS
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ctp-green/10 text-ctp-green border border-ctp-green/20 text-[11px] font-bold">
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
          
          <div className="p-6 bg-ctp-crust/80 backdrop-blur-md border-t border-ctp-surface1 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="text-sm text-ctp-subtext1 flex items-center gap-2">
                <Database className="w-4 h-4 text-ctp-green" />
                <span>Found <span className="text-ctp-green font-bold underline underline-offset-4 decoration-ctp-green/30">{results.filter(r => r.is_matched && !r.cable_exists).length}</span> missing physical links.</span>
              </div>
              
              <div className="flex items-center gap-3 bg-ctp-crust/50 p-1.5 rounded-2xl border border-ctp-surface1/50">
                <span className="text-[10px] font-bold text-ctp-overlay1 uppercase ml-2">Global Default</span>
                <select 
                  value={cableType}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setCableType(newType);
                    // Optionally update all non-modified rows? Let's just set the default for future scans.
                  }}
                  className="bg-ctp-mantle border-none rounded-xl px-3 py-1.5 text-xs text-ctp-text outline-none focus:ring-1 focus:ring-ctp-green/50 transition-all cursor-pointer"
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
                  className="text-[10px] font-bold text-ctp-sky hover:text-ctp-sky/80 px-2 transition-colors"
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
                  ? 'bg-ctp-mantle text-ctp-overlay1 cursor-not-allowed border border-ctp-surface1'
                  : 'bg-gradient-to-r from-ctp-green to-ctp-teal text-white shadow-ctp-green/20 hover:shadow-ctp-green/40'
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
          <div className="w-20 h-20 bg-ctp-mantle/50 rounded-full flex items-center justify-center mb-6">
            <Activity className="w-10 h-10 text-ctp-overlay0" />
          </div>
          <h4 className="text-xl font-bold text-ctp-subtext0 mb-2">No Active Results</h4>
          <p className="text-ctp-overlay1 max-w-sm">
            Target a device or site to begin SSH discovery. Ensure SSH credentials and SecretsGroups are configured.
          </p>
        </div>
      )}
    </div>
  );
}
