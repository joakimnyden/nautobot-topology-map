import React from 'react';
import { Plus, Minus, RotateCcw } from 'lucide-react';
interface ZoomControlsProps {
  zoomIn: (options?: { duration?: number }) => void;
  zoomOut: (options?: { duration?: number }) => void;
  handleResetZoom: () => void;
}
export const ZoomControls = ({ zoomIn, zoomOut, handleResetZoom }: ZoomControlsProps) => {
  return (
    <div className="absolute bottom-8 left-8 z-20 flex flex-col gap-2">
      <button
        onClick={() => zoomIn({ duration: 300 })}
        className="p-3 bg-slate-800/80 backdrop-blur-md hover:bg-slate-700/80 text-slate-300 rounded-2xl border border-slate-700/50 shadow-xl transition-all"
        title="Zoom In"
      >
        <Plus className="w-4 h-4" />
      </button>
      <button
        onClick={() => zoomOut({ duration: 300 })}
        className="p-3 bg-slate-800/80 backdrop-blur-md hover:bg-slate-700/80 text-slate-300 rounded-2xl border border-slate-700/50 shadow-xl transition-all"
        title="Zoom Out"
      >
        <Minus className="w-4 h-4" />
      </button>
      <button
        onClick={handleResetZoom}
        className="p-3 bg-slate-800/80 backdrop-blur-md hover:bg-slate-700/80 text-slate-300 rounded-2xl border border-slate-700/50 shadow-xl transition-all"
        title="Reset View"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    </div>
  );
};
