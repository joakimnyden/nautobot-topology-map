import React from 'react';
import { Box, Search, X, Filter } from 'lucide-react';
interface ControlPanelProps {
  filterType: 'all' | 'vlan' | 'protocol' | 'prefix';
  setFilterType: (val: any) => void;
  filterValue: string;
  setFilterValue: (val: string) => void;
  filterSearchQuery: string;
  setFilterSearchQuery: (val: string) => void;
  filteredAvailableValues: (string | number)[];
  iconMode: 'role' | 'vendor';
  setIconMode: (val: any) => void;
}
export const ControlPanel = ({
  filterType,
  setFilterType,
  filterValue,
  setFilterValue,
  filterSearchQuery,
  setFilterSearchQuery,
  filteredAvailableValues,
  iconMode,
  setIconMode,
}: ControlPanelProps) => {
  return (
    <div className="absolute top-28 right-8 z-20 flex flex-col gap-3 items-end">
      {/* Filter Type Selector */}
      <div className="flex items-center gap-1 px-5 py-3 bg-slate-900/40 backdrop-blur-md rounded-3xl border border-slate-700/30">
        {['all', 'vlan', 'protocol', 'prefix'].map((type, idx) => (
          <React.Fragment key={type}>
            {idx > 0 && <span className="text-slate-700 font-extralight mx-1">|</span>}
            <button
              onClick={() => { setFilterType(type as any); setFilterValue(''); }}
              className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${filterType === type ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : 'text-slate-500 hover:text-slate-200'}`}
            >
              {type}
            </button>
          </React.Fragment>
        ))}
      </div>
      {/* Filter Value Selector */}
      {filterType !== 'all' && (
        <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-700/50 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 w-[340px] max-h-[480px] animate-in fade-in zoom-in duration-300">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Box className="w-3.5 h-3.5" /> Available {filterType}s
            </span>
            {filterValue && (
              <button 
                onClick={() => setFilterValue('')} 
                className="px-3 py-1 rounded-full bg-red-500/10 text-[9px] font-bold text-red-400 hover:bg-red-500/20 transition-all border border-red-500/20 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
            <input
              type="text"
              placeholder={`Filter ${filterType}s...`}
              value={filterSearchQuery}
              onChange={(e) => setFilterSearchQuery(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl pl-10 pr-4 py-2.5 text-[11px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-2 overflow-y-auto pr-2 custom-scrollbar max-h-[300px]">
            {filteredAvailableValues.map(val => (
              <button
                key={val}
                onClick={() => setFilterValue(val.toString())}
                className={`px-4 py-2 rounded-xl text-[10px] font-mono transition-all border duration-200 ${filterValue === val.toString()
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-slate-800/60 border-slate-700/30 text-slate-400 hover:bg-slate-700/80 hover:border-slate-600 hover:text-slate-200'}`}
              >
                {val}
              </button>
            ))}
            {filteredAvailableValues.length === 0 && (
              <div className="w-full py-8 text-center bg-slate-950/20 rounded-2xl border border-dashed border-slate-800">
                <p className="text-[11px] text-slate-500 italic uppercase tracking-tighter">No matching {filterType}s found</p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Icon Toggles */}
      <div className="flex flex-col items-end gap-1.5 w-full max-w-[200px]">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mr-2">Display Icons</span>
        <div className="flex items-center justify-center gap-1 px-5 py-3 bg-slate-900/40 backdrop-blur-md rounded-3xl border border-slate-700/30 w-full">
          <button
            onClick={() => setIconMode('role')}
            className={`flex-1 px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${iconMode === 'role' ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : 'text-slate-500 hover:text-slate-200'}`}
          >
            Role
          </button>
          <span className="text-slate-700 font-extralight mx-1">|</span>
          <button
            onClick={() => setIconMode('vendor')}
            className={`flex-1 px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${iconMode === 'vendor' ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : 'text-slate-500 hover:text-slate-200'}`}
          >
            Vendor
          </button>
        </div>
      </div>
    </div>
  );
};
