import React, { useState, useEffect } from 'react';

import TopologyMap from './components/TopologyMap';
import SiteTopology from './components/SiteTopology';
import { Site } from './types';
import CableDiscovery from './components/CableDiscovery';

export default function App() {
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Handle standalone discovery page
  const isDiscoveryPage = (window as any).NAUTOBOT_PAGE === 'discovery';

  useEffect(() => {
    if (isDiscoveryPage) {
      setIsLoading(false);
      return;
    }
    fetch('/api/plugins/nautobot_topology/topology/')
      .then(res => res.json())
      .then(response => {
        if (response.status === 'success') {
          // Fallback to empty array if data nodes are missing
          setSites(response.data.nodes || []);
        }
      })
      .catch(err => console.error('Failed to fetch Nautobot data:', err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-slate-400 font-sans">
        Discovering Network Topology...
      </div>
    );
  }

  if (isDiscoveryPage) {
    return (
      <div className="w-full relative bg-[#020617] text-white font-sans p-8 z-[10] h-[calc(100vh-120px)] min-h-[800px] overflow-hidden" style={{ borderRadius: '1.5rem' }}>
        {/* Technical Background Elements - Strictly Background */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-[1.5rem]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(14,165,233,0.08)_0%,transparent_40%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.08)_0%,transparent_40%)]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        
        {/* Content Layer - Guaranteed Clickable */}
        <div className="relative z-20 w-full h-full pointer-events-auto">
          <CableDiscovery site={null as any} onClose={() => {}} isStandalone={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full relative bg-transparent text-white font-sans overflow-hidden" style={{ minHeight: 'calc(100vh - 160px)', borderRadius: '1.5rem' }}>
      <div className="absolute inset-0 w-full h-full rounded-3xl overflow-hidden">
        {selectedSite ? (
          <SiteTopology site={selectedSite} onBack={() => setSelectedSite(null)} />
        ) : (
          <TopologyMap sites={sites} onSiteSelect={setSelectedSite} />
        )}
      </div>
    </div>
  );
}
