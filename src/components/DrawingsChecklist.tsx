import React from 'react';
import { CheckSquare, Square, ClipboardCheck, RotateCcw } from 'lucide-react';
import { DrawingChecklistItem } from '../types';

interface DrawingsChecklistProps {
  items: DrawingChecklistItem[];
  onToggle: (id: string) => void;
  onReset: () => void;
}

export default function DrawingsChecklist({ items, onToggle, onReset }: DrawingsChecklistProps) {
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
        <button
          type="button"
          onClick={onReset}
          className="text-slate-500 dark:text-tokyo-muted hover:text-blue-600 dark:hover:text-tokyo-blue flex items-center gap-1 text-[11px] font-mono transition-colors border border-slate-200 dark:border-tokyo-border hover:border-slate-300 dark:hover:border-tokyo-border-light px-2 py-0.5 rounded cursor-pointer"
          title="Reset checklist"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center text-[11px] font-mono text-slate-550 dark:text-tokyo-muted mb-1">
          <span>Review Detailing Completion</span>
          <span className="text-blue-600 dark:text-tokyo-blue font-bold">{getPercentage()}%</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-tokyo-card h-1.5 rounded-full overflow-hidden border border-slate-205 dark:border-tokyo-border">
          <div 
            className="bg-blue-600 dark:bg-tokyo-blue h-full transition-all duration-300"
            style={{ width: `${getPercentage()}%` }}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-4">
        {(Object.keys(categories) as Array<keyof typeof categories>).map((catKey) => {
          const categoryItems = items.filter(item => item.category === catKey);
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
        })}
      </div>
    </div>
  );
}
