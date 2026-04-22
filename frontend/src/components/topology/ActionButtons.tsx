import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Unlock, X, Layout, Save } from 'lucide-react';
interface ActionButtonsProps {
  isLocked: boolean;
  toggleLock: () => void;
  discardChanges: () => void;
  recalculateLayout: () => void;
  saveLayout: () => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
}
export const ActionButtons = ({
  isLocked,
  toggleLock,
  discardChanges,
  recalculateLayout,
  saveLayout,
  isSaving
}: ActionButtonsProps) => {
  return (
    <div className="absolute bottom-8 right-10 z-20 flex items-center gap-1 px-6 py-3 bg-slate-900/40 backdrop-blur-md border border-slate-700/30 rounded-3xl shadow-2xl animate-in fade-in duration-500">
      <button
        onClick={toggleLock}
        className={`flex items-center gap-3 px-3 py-1 font-bold text-[10px] tracking-widest uppercase transition-all duration-300 ${isLocked
          ? 'text-slate-500 hover:text-slate-200'
          : 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]'
          }`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isLocked ? 'locked' : 'unlocked'}
            initial={{ scale: 0.8, opacity: 0, rotate: -45 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.8, opacity: 0, rotate: 45 }}
            transition={{ duration: 0.2 }}
          >
            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </motion.div>
        </AnimatePresence>
        <span>{isLocked ? 'Topology Locked' : 'Layout Mode'}</span>
      </button>

      {!isLocked && (
        <>
          <span className="text-slate-700 font-extralight mx-1">|</span>
          <button
            onClick={discardChanges}
            className="flex items-center gap-2 px-3 py-1 text-red-500/80 hover:text-red-400 font-bold text-[10px] tracking-widest uppercase transition-all"
          >
            <X className="w-3.5 h-3.5" /> Discard
          </button>
          
          <span className="text-slate-700 font-extralight mx-1">|</span>
          <button
            onClick={recalculateLayout}
            className="flex items-center gap-2 px-3 py-1 text-slate-400 hover:text-slate-200 font-bold text-[10px] tracking-widest uppercase transition-all"
          >
            <Layout className="w-3.5 h-3.5" /> Layout
          </button>
          
          <span className="text-slate-700 font-extralight mx-1">|</span>
          <button
            onClick={saveLayout}
            disabled={isSaving}
            className={`flex items-center gap-2 px-3 py-1 font-bold text-[10px] tracking-widest uppercase transition-all ${isSaving ? 'opacity-50' : 'text-blue-400 hover:text-blue-300 drop-shadow-[0_0_8px_rgba(96,165,250,0.4)]'}`}
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      )}
    </div>
  );
};
