import React from 'react';
import { Search, Activity, ArrowRight, AlertCircle, CheckCircle2, Zap, Database, Loader2 } from 'lucide-react';

const SPEED_MAPPING: Record<string, string> = {
  '1000base-t': '1G',
  '10gbase-t': '10G',
  '10gbase-x-sfpp': '10G',
  '25gbase-x-sfp28': '25G',
  '40gbase-x-qsfpp': '40G',
  '100gbase-x-qsfp28': '100G',
  '1000base-x-sfp': '1G',
  '2.5gbase-t': '2.5G',
  '5gbase-t': '5G',
};

interface DiscoveryResultsTableProps {
  results: any[];
  resultSearch: string;
  setResultSearch: (val: string) => void;
  setResults: (results: any[]) => void;
  onImport: () => void;
  importing: boolean;
  cableChoices: {value: string, label: string}[];
}

export const DiscoveryResultsTable: React.FC<DiscoveryResultsTableProps> = ({
  results,
  resultSearch,
  setResultSearch,
  setResults,
  onImport,
  importing,
  cableChoices
}) => {
  const filteredResults = results.filter(r => {
    const search = resultSearch.toLowerCase();
    return (
      r.local_interface.toLowerCase().includes(search) ||
      r.remote_device.toLowerCase().includes(search) ||
      r.remote_interface.toLowerCase().includes(search) ||
      (r.protocol || '').toLowerCase().includes(search)
    );
  });

  const readyToImportCount = results.filter(r => (r.is_matched || r.create_if_missing) && !r.cable_exists).length;

  return (
    <div className="flex-1 min-h-0 bg-slate-800/30 rounded-3xl border border-slate-700/50 overflow-hidden flex flex-col shadow-inner mb-4">
      <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar relative">
        <table className="w-full min-w-[900px] text-left text-sm border-collapse">
          <thead className="bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10 border-b border-slate-700/50">
            <tr className="bg-slate-900/80">
              <th colSpan={6} className="px-6 py-2">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text"
                      placeholder="Filter results..."
                      className="w-full bg-slate-950/60 border border-slate-700/50 rounded-xl pl-10 pr-4 py-1.5 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all placeholder:text-slate-600"
                      value={resultSearch}
                      onChange={(e) => setResultSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-slate-500 uppercase tracking-widest font-bold ml-auto">
                    <Activity className="w-3 h-3 text-cyan-500/50" />
                    <span>Live Filter</span>
                  </div>
                </div>
              </th>
            </tr>
            <tr>
              <th className="px-6 py-3 font-bold text-slate-400 uppercase tracking-tighter text-[10px]">Local Interface</th>
              <th className="px-6 py-3 font-bold text-slate-400 uppercase tracking-tighter text-[10px]">Connection Path</th>
              <th className="px-6 py-3 font-bold text-slate-400 uppercase tracking-tighter text-[10px]">Remote Interface</th>
              <th className="px-6 py-3 font-bold text-slate-400 uppercase tracking-tighter text-[10px]">Protocol</th>
              <th className="px-6 py-3 font-bold text-slate-400 uppercase tracking-tighter text-[10px]">Media Type</th>
              <th className="px-6 py-3 font-bold text-slate-400 uppercase tracking-tighter text-[10px] text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {filteredResults.map((r, i) => (
              <tr key={i} className={`hover:bg-white/5 transition-colors group ${r.cable_exists ? 'opacity-60' : ''} border-b border-slate-700/20`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-100 text-xs">{r.local_interface}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-400 opacity-60 uppercase font-bold tracking-widest">{r.local_interface_type || 'interface'}</span>
                      <span className="text-[9px] text-cyan-500/60 uppercase font-medium">{r.local_type}</span>
                      {r.local_type && (SPEED_MAPPING[r.local_type] || r.local_lag_speed) && (
                        <span className="text-[8px] bg-cyan-500/10 text-cyan-400 px-1 rounded-sm border border-cyan-500/20 font-black">
                          {r.local_lag_speed ? `${r.local_lag_speed}G` : SPEED_MAPPING[r.local_type]}
                        </span>
                      )}
                      {r.local_lag && (
                        <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 font-bold">
                          {r.local_lag}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-500 transition-colors" />
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-300 text-xs">{r.remote_device}</span>
                      <span className="text-[9px] text-slate-500 uppercase">Hardware</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                   <div className="flex flex-col">
                     <span className="font-mono text-cyan-400/80 bg-cyan-500/5 px-2 py-0.5 rounded border border-cyan-500/10 text-xs w-fit">{r.remote_interface}</span>
                     <div className="flex items-center gap-2 mt-0.5">
                       <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">{r.remote_interface_type || 'interface'}</span>
                       <span className="text-[9px] text-cyan-500/40 uppercase font-medium">{r.remote_type}</span>
                     </div>
                   </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-[9px] px-2 py-0.5 rounded-md bg-slate-900 text-slate-500 font-bold border border-slate-700">
                    {r.protocol}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <select 
                      value={r.type || (cableChoices.length > 0 ? cableChoices[0].value : 'other')}
                      disabled={r.cable_exists}
                      onChange={(e) => {
                        const newResults = [...results];
                        const indexInAll = results.findIndex(res => res === i); // Use index i directly from map
                        const targetIdx = results.indexOf(r);
                        if (targetIdx !== -1) {
                          newResults[targetIdx] = { ...newResults[targetIdx], type: e.target.value };
                          setResults(newResults);
                        }
                      }}
                      className={`bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-0.5 text-[10px] text-slate-300 outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all ${r.cable_exists ? 'cursor-not-allowed' : 'cursor-pointer hover:border-slate-500'}`}
                    >
                      {cableChoices && cableChoices.length > 0 ? (
                        cableChoices.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))
                      ) : (
                        <>
                          <option value="cat6">Cat6</option>
                          <option value="cat6a">Cat6a</option>
                          <option value="fiber-lc">Fiber (LC)</option>
                          <option value="dac-passive">DAC</option>
                        </>
                      )}
                    </select>
                    {r.suggested_cable && !r.cable_exists && (
                      <span className="text-[10px]" title={`Auto-suggested based on ${r.local_type}`}>✨</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right whitespace-nowrap">
                  {!r.is_matched ? (
                    <div className="flex flex-col items-end gap-2">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold">
                        <AlertCircle className="w-2.5 h-2.5" />
                        UNMATCHED
                      </div>
                      {(r.local_device_id && r.remote_device_id) && (
                        <label className="flex items-center gap-2 cursor-pointer group/toggle">
                          <span className="text-[10px] text-slate-500 group-hover/toggle:text-cyan-400 transition-colors">Create missing?</span>
                          <input 
                            type="checkbox" 
                            checked={r.create_if_missing || false}
                            onChange={(e) => {
                              const newResults = [...results];
                              const idx = results.findIndex(res => res === r);
                              if (idx !== -1) {
                                newResults[idx] = { ...newResults[idx], create_if_missing: e.target.checked };
                                setResults(newResults);
                              }
                            }}
                            className="w-3 h-3 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/30"
                          />
                        </label>
                      )}
                    </div>
                  ) : r.cable_exists ? (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 border border-slate-600/30 text-[10px] font-bold">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      EXISTS
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                      <Zap className="w-2.5 h-2.5" />
                      READY
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="px-6 py-3 bg-slate-900/90 backdrop-blur-xl border-t border-slate-700/50 flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-4">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-emerald-500" />
            <span>Found <span className="text-emerald-400 font-bold underline decoration-emerald-500/30">{readyToImportCount}</span> missing links.</span>
          </div>
        </div>

        <button 
          onClick={onImport}
          disabled={readyToImportCount === 0 || importing}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all shadow-lg active:scale-95 text-xs ${
            readyToImportCount === 0 || importing
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
          }`}
        >
          {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          <span>Import {readyToImportCount} Cables</span>
        </button>
      </div>
    </div>
  );
};
