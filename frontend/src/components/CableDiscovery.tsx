import React, { useState, useEffect } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Site } from '../types';
import { DiscoveryHeader } from './discovery/DiscoveryHeader';
import { DiscoveryControlPanel } from './discovery/DiscoveryControlPanel';
import { DiscoveryResultsTable } from './discovery/DiscoveryResultsTable';
import { DiscoverySummary } from './discovery/DiscoverySummary';
import { mockDiscoveryResults } from './discovery/discoveryMocks';
import { useDiscovery } from '../hooks/useDiscovery';

interface CableDiscoveryProps {
  site?: Site;
  onClose?: () => void;
  isStandalone?: boolean;
}

export default function CableDiscovery({ site, onClose, isStandalone }: CableDiscoveryProps) {
  const [siteSearch, setSiteSearch] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [resultSearch, setResultSearch] = useState('');
  const [showSiteDropdown, setShowSiteDropdown] = useState(false);
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);

  const {
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
    handleImport,
    cableChoices
  } = useDiscovery(site, isStandalone);


  return (
    <div className="w-full flex flex-col h-full max-h-[calc(100vh-250px)] bg-transparent text-slate-200 relative z-10 overflow-hidden px-1">
      {isDevicesLoading && devices.length === 0 && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm rounded-3xl">
          <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-cyan-400 font-medium animate-pulse uppercase tracking-widest text-xs">Loading devices...</p>
        </div>
      )}

      <div className="flex-shrink-0">
        <DiscoveryHeader onClose={onClose} isStandalone={isStandalone} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-4 relative z-50 flex-shrink-0">
        <div className="lg:col-span-2">
          <DiscoveryControlPanel 
            isStandalone={isStandalone}
            selectedSiteId={selectedSiteId}
            setSelectedSiteId={setSelectedSiteId}
            siteSearch={siteSearch}
            setSiteSearch={setSiteSearch}
            showSiteDropdown={showSiteDropdown}
            setShowSiteDropdown={setShowSiteDropdown}
            sites={sites}
            deviceSearch={deviceSearch}
            setDeviceSearch={setDeviceSearch}
            selectedDevice={selectedDevice}
            setSelectedDevice={setSelectedDevice}
            showDeviceDropdown={showDeviceDropdown}
            setShowDeviceDropdown={setShowDeviceDropdown}
            devices={devices}
            isDevicesLoading={isDevicesLoading}
            isLoading={isLoading}
            isDiscoveringAll={isDiscoveringAll}
            discoveryProgress={discoveryProgress}
            onDiscover={() => handleDiscover()}
            onDiscoverAll={handleDiscoverAll}
          />
        </div>

        <div className="flex flex-col gap-4">
          <DiscoverySummary 
            error={error}
            message={message}
            isLoading={isLoading}
            resultsCount={results.length}
            readyToImportCount={results.filter(r => (r.is_matched || r.create_if_missing) && !r.cable_exists).length}
          />
          
        </div>
      </div>

      {results.length > 0 && (
        <DiscoveryResultsTable 
          results={results}
          resultSearch={resultSearch}
          setResultSearch={setResultSearch}
          setResults={setResults}
          onImport={handleImport}
          importing={importing}
          cableChoices={cableChoices}
        />
      )}
    </div>
  );
}
