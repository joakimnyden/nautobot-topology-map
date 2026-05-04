import { useState, useEffect } from 'react';
import { Site } from '../types';
import { mockDiscoveryResults } from '../components/discovery/discoveryMocks';

export const useDiscovery = (site?: Site, isStandalone?: boolean, cableType: string = 'cat6a') => {
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

  // Fetch sites for standalone mode
  useEffect(() => {
    if (isStandalone) {
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
    if (!selectedSiteId && isStandalone) {
      setDevices([]);
      return;
    }
    
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
      .then(res => res.json())
      .then(data => {
        if (data && data.results) {
          const filtered = data.results.filter((d: any) => d.primary_ip || d.primary_ip4 || d.primary_ip6);
          // @ts-ignore
          if (window.NAUTOBOT_SIMULATOR_ENABLED) {
            setDevices([testDevice, ...filtered]);
          } else {
            setDevices(filtered);
          }
        } else {
          // @ts-ignore
          setDevices(window.NAUTOBOT_SIMULATOR_ENABLED ? [testDevice] : []);
        }
      })
      .catch(() => {
        // @ts-ignore
        setDevices(window.NAUTOBOT_SIMULATOR_ENABLED ? [testDevice] : []);
      })
      .finally(() => setIsDevicesLoading(false));
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

    if (targetId === 'simulator') {
      await new Promise(resolve => setTimeout(resolve, 1200));
      if (deviceId) {
        setResults(prev => [...prev, ...mockDiscoveryResults]);
        return mockDiscoveryResults;
      } else {
        setResults(mockDiscoveryResults);
        setMessage(`SIMULATION: Discovered ${mockDiscoveryResults.length} mock connections.`);
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
      if (discovered) totalDiscovered += discovered.length;
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
        // @ts-ignore
        'X-CSRFToken': document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1] || ''
      },
      body: JSON.stringify({ cables: validCables.map(c => ({ ...c, type: c.type || cableType })) })
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

  return {
    selectedSiteId, setSelectedSiteId,
    sites,
    devices,
    selectedDevice, setSelectedDevice,
    results, setResults,
    isLoading,
    isDiscoveringAll,
    discoveryProgress,
    importing,
    message,
    error,
    isDevicesLoading,
    handleDiscover,
    handleDiscoverAll,
    handleImport
  };
};
