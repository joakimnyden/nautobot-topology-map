import React from 'react';
import { Activity, AlertCircle, Loader2 } from 'lucide-react';

interface DiscoverySummaryProps {
  error: string | null;
  message: string;
  isLoading: boolean;
  resultsCount: number;
  readyToImportCount: number;
}

export const DiscoverySummary: React.FC<DiscoverySummaryProps> = ({ 
  error, 
  message, 
  isLoading, 
  resultsCount, 
  readyToImportCount 
}) => {
  return (
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

      {resultsCount > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Total Results</span>
            <span className="font-bold text-white">{resultsCount}</span>
          </div>
          <div className="flex justify-between items-center text-sm mt-2">
            <span className="text-slate-500">Ready to Import</span>
            <span className="font-bold text-emerald-400">{readyToImportCount}</span>
          </div>
        </div>
      )}
    </div>
  );
};
