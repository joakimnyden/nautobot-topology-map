import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  LayoutDashboard, 
  Settings, 
  Bell, 
  Search,
  User,
  Menu,
  X
} from 'lucide-react';
import TopologyMap from './components/TopologyMap';
import SiteTopology from './components/SiteTopology';
import { Site } from './types';
import { MOCK_SITES } from './mockData';

export default function App() {
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sites, setSites] = useState<Site[]>(MOCK_SITES);

  useEffect(() => {
    fetch('/api/plugins/topology-nexus/topology')
      .then(res => res.json())
      .then(response => {
        if (response.status === 'success') {
          console.log('Nautobot Topology Data:', response.data);
        }
      })
      .catch(err => console.error('Failed to fetch Nautobot data:', err));
  }, []);

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="relative border-r border-white/5 bg-[#0a0a0a] flex flex-col z-30"
      >
        <div className="p-6 flex items-center gap-4 mb-8">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-black" />
          </div>
          {isSidebarOpen && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-serif italic text-xl tracking-tight"
            >
              Topology Nexus
            </motion.span>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <NavItem 
            icon={<Globe className="w-5 h-5" />} 
            label="Network Topology" 
            active={true} 
            collapsed={!isSidebarOpen}
            onClick={() => setSelectedSite(null)}
          />
        </nav>

        <div className="p-4 border-t border-white/5">
          <NavItem 
            icon={<Settings className="w-5 h-5" />} 
            label="Settings" 
            active={false} 
            collapsed={!isSidebarOpen}
            onClick={() => {}}
          />
        </div>

        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white/10 border border-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors z-40"
        >
          {isSidebarOpen ? <X className="w-3 h-3" /> : <Menu className="w-3 h-3" />}
        </button>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#0a0a0a]/50 backdrop-blur-md z-20">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input 
                type="text" 
                placeholder="Search devices or sites..." 
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button className="relative p-2 text-white/40 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full border-2 border-[#0a0a0a]" />
            </button>
            <div className="h-8 w-px bg-white/5" />
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right">
                <p className="text-xs font-semibold">Joakim Nyden</p>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">Network Admin</p>
              </div>
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                <User className="w-5 h-5 text-white/40" />
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedSite?.id || 'global'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {selectedSite ? (
                <SiteTopology site={selectedSite} onBack={() => setSelectedSite(null)} />
              ) : (
                <TopologyMap onSiteSelect={setSelectedSite} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, active, collapsed, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all group ${
        active 
          ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
          : 'text-white/40 hover:bg-white/5 hover:text-white'
      }`}
    >
      <div className="shrink-0">{icon}</div>
      {!collapsed && (
        <span className="text-sm font-medium whitespace-nowrap overflow-hidden">
          {label}
        </span>
      )}
      {active && !collapsed && (
        <motion.div 
          layoutId="active-pill"
          className="ml-auto w-1.5 h-1.5 bg-black rounded-full"
        />
      )}
    </button>
  );
}
