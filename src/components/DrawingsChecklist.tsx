import React from 'react';
import { CheckSquare, Square, ClipboardCheck, RotateCcw, AlertTriangle } from 'lucide-react';
import { DrawingChecklistItem } from '../types';

interface DrawingsChecklistProps {
  items: DrawingChecklistItem[];
  onToggle: (id: string) => void;
  onReset: () => void;
  isLoading?: boolean;
  onGenerate?: () => void;
  hasUploadedRequirements: boolean;
  requirementsFileName?: string;
  statusMessage?: string | null;
}

export default function DrawingsChecklist({
  items,
  onToggle,
  onReset,
  isLoading = false,
  onGenerate,
  hasUploadedRequirements,
  requirementsFileName,
  statusMessage,
}: DrawingsChecklistProps) {
  const categories = {
    safety: '1. Integrity & Safety',
    detailing: '2. Detailing & Reinforcement',
    compliance: '3. Code Alignment',
    materials: '4. Materials & Notes'
  };

  const getPercentage = () => {
    if (items.length === 0) return 0;
    const completed = items.filter(t => t.checked).length;
    return Math.round((completed / items.length) * 100);
  };

  return (
    <div className="bg-white dark:bg-tokyo-panel border border-slate-200 dark:border-tokyo-border rounded-lg p-5 text-slate-700 dark:text-tokyo-text shadow-sm transition-colors duration-150" id="checklist-container">
      <div className="flex items-center justify-between mb-4 border-b border-slate-150 dark:border-tokyo-border pb-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-blue-600 dark:text-tokyo-blue" />
          <h3 className="font-display font-semibold text-sm tracking-wide text-slate-900 dark:text-tokyo-text uppercase">
            Engineering Review Checklist
          </h3>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="text-slate-500 dark:text-tokyo-muted hover:text-blue-600 dark:hover:text-tokyo-blue flex items-center gap-1 text-[11px] font-mono transition-colors border border-slate-200 dark:border-tokyo-border hover:border-slate-300 dark:hover:border-tokyo-border-light px-2 py-0.5 rounded cursor-pointer"
            title="Reset checklist"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </div>

      {/* Status Alert Notice Banner */}
      {statusMessage && (
        <div className="mb-4 p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded text-[11px] text-amber-850 dark:text-amber-200 leading-normal font-sans flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="mb-4">
          <div className="flex justify-between items-center text-[11px] font-mono text-slate-555 dark:text-tokyo-muted mb-1">
            <span>Review Detailing Completion</span>
            <span className="text-blue-600 dark:text-tokyo-blue font-bold">{getPercentage()}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-tokyo-card h-1.5 rounded-full overflow-hidden border border-slate-200 dark:border-tokyo-border">
            <div 
              className="bg-blue-600 dark:bg-tokyo-blue h-full transition-all duration-300"
              style={{ width: `${getPercentage()}%` }}
            />
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
            <div className="h-6 w-6 border-2 border-slate-200 dark:border-tokyo-border border-t-blue-600 dark:border-tokyo-blue rounded-full animate-spin" />
            <p className="text-[11px] font-mono text-slate-400 dark:text-tokyo-muted uppercase tracking-widest animate-pulse">Generating checklist...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-6 px-4 bg-slate-50/50 dark:bg-tokyo-input/20 border border-dashed border-slate-200 dark:border-tokyo-border rounded-lg">
            {hasUploadedRequirements ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-tokyo-text leading-relaxed font-sans font-semibold">
                  Reference standards PDF ready: <span className="font-mono text-blue-600 dark:text-tokyo-blue font-medium block truncate mt-1 bg-white dark:bg-tokyo-input p-1.5 rounded border border-slate-200 dark:border-tokyo-border">{requirementsFileName}</span>
                </p>
                <button
                  type="button"
                  onClick={onGenerate}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-mono py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer uppercase tracking-wider shadow-sm"
                >
                  Generate Review Checklist
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-550 dark:text-tokyo-muted leading-relaxed font-sans">
                No checklist loaded. Upload a standards & requirements PDF to dynamically generate the engineering review checklist.
              </p>
            )}
          </div>
        ) : (
          (Object.keys(categories) as Array<keyof typeof categories>).map((catKey) => {
            const categoryItems = items.filter(item => item.category === catKey);
            if (categoryItems.length === 0) return null;
            return (
              <div key={catKey} className="space-y-1.5" id={`category-block-${catKey}`}>
                <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-tokyo-comment font-mono pl-1 border-l-2 border-blue-500 dark:border-tokyo-blue">
                  {categories[catKey]}
                </h4>
                <div className="space-y-1 pl-1">
                  {categoryItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onToggle(item.id)}
                      className="w-full flex items-start gap-2.5 py-1.5 px-2 hover:bg-slate-50 dark:hover:bg-tokyo-card rounded text-left transition-colors group cursor-pointer"
                    >
                      <span className="mt-0.5 text-slate-400 dark:text-tokyo-muted group-hover:text-blue-600 dark:group-hover:text-tokyo-blue transition-colors shrink-0">
                        {item.checked ? (
                          <CheckSquare className="h-4 w-4 text-blue-600 dark:text-tokyo-blue" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-300 dark:text-tokyo-border-light" />
                        )}
                      </span>
                      <span className={`text-xs ${item.checked ? 'text-slate-400 dark:text-tokyo-comment line-through' : 'text-slate-700 dark:text-tokyo-text group-hover:text-slate-900 dark:group-hover:text-white'} transition-colors leading-snug`}>
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
