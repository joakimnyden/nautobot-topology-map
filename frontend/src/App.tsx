import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import TopologyMap from './components/TopologyMap';
import SiteTopology from './components/SiteTopology';
import { Site } from './types';

export default function App() {
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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

  return (
    <div className="w-full relative bg-[#050505] text-white font-sans overflow-hidden" style={{ minHeight: 'calc(100vh - 160px)', borderRadius: '12px' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedSite?.id || 'global'}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 w-full h-full"
        >
          {selectedSite ? (
            <SiteTopology site={selectedSite} onBack={() => setSelectedSite(null)} />
          ) : (
            <TopologyMap sites={sites} onSiteSelect={setSelectedSite} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
