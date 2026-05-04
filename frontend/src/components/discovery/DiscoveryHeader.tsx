import React from 'react';
import { Layout, ChevronRight } from 'lucide-react';

interface DiscoveryHeaderProps {
  onClose?: () => void;
  isStandalone?: boolean;
}

export const DiscoveryHeader: React.FC<DiscoveryHeaderProps> = ({ onClose, isStandalone }) => {
  return (
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
  );
};
