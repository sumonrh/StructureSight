import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Download, Sparkles, HelpCircle, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AnalysisResult } from '../types';

interface AnalysisReportProps {
  currentResult: AnalysisResult | null;
  isLoading: boolean;
  onRunAnalysis: (customPrompt?: string) => void;
  currentPageNumber: number;
  totalPageCount: number;
  drawingName: string;
}

export default function AnalysisReport({
  currentResult,
  isLoading,
  onRunAnalysis,
  currentPageNumber,
  totalPageCount,
  drawingName,
}: AnalysisReportProps) {

  const copyToClipboard = () => {
    if (!currentResult) return;
    navigator.clipboard.writeText(currentResult.analysis);
    alert("Analysis copied to clipboard!");
  };

  const downloadReport = () => {
    if (!currentResult) return;
    const header = `======================================================================
STRUCTURESIGHT: AI DESIGN REVIEW REPORT
======================================================================
Drawing Document:    ${drawingName}
Drawing Page/Sheet:  Sheet ${currentResult.pageNumber} of ${totalPageCount}
Reviewing Engine:    ${currentResult.provider.toUpperCase()} (Model: ${currentResult.modelName})
Review Timestamp:    ${new Date(currentResult.timestamp).toLocaleString()}
Review Category:     Independent Lead Structural Engineer Audit
======================================================================

`;
    const fullText = header + currentResult.analysis;
    const element = document.createElement("a");
    const file = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `${drawingName.replace(/\.[^/.]+$/, "")}_Sheet${currentResult.pageNumber}_Review_Report.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="bg-white dark:bg-tokyo-panel border border-slate-200 dark:border-tokyo-border rounded-lg p-5 text-slate-700 dark:text-tokyo-text shadow-sm h-full flex flex-col transition-colors duration-150" id="report-panel-container">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-tokyo-border pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-600 dark:text-tokyo-blue" />
          <h3 className="font-display font-semibold text-sm tracking-wide text-slate-900 dark:text-tokyo-text uppercase">
             Lead structural Engineering Review
          </h3>
        </div>
        {currentResult && (
          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="text-slate-600 dark:text-tokyo-text hover:text-blue-600 dark:hover:text-tokyo-blue bg-slate-50 dark:bg-tokyo-input border border-slate-200 dark:border-tokyo-border hover:border-slate-300 dark:hover:border-tokyo-border-light py-1 px-2.5 rounded text-xs transition-all flex items-center gap-1 cursor-pointer"
              title="Copy review to clipboard"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
            <button
              onClick={downloadReport}
              className="text-slate-600 dark:text-tokyo-text hover:text-blue-600 dark:hover:text-tokyo-blue bg-slate-50 dark:bg-tokyo-input border border-slate-200 dark:border-tokyo-border hover:border-slate-300 dark:hover:border-tokyo-border-light py-1 px-2.5 rounded text-xs transition-all flex items-center gap-1 cursor-pointer"
              title="Download formal report document"
            >
              <Download className="h-3.5 w-3.5" /> Export Report
            </button>
          </div>
        )}
      </div>

      {/* Main Container: Split or scrollable */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* Render loading state */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-slate-50/60 dark:bg-tokyo-input/40 rounded-lg border border-slate-200 dark:border-tokyo-border">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-4 border-slate-250 dark:border-tokyo-border border-t-blue-600 dark:border-tokyo-blue animate-spin" />
              <Sparkles className="h-5 w-5 text-blue-500 absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-mono text-blue-600 dark:text-tokyo-blue uppercase tracking-widest animate-pulse">Running Structural FEA/Vision Models...</p>
              <p className="text-xs text-slate-500 dark:text-tokyo-muted max-w-xs leading-normal font-sans">
                Executing design audits, extracting tabular details, assessing load paths, and identifying potential code violations under ACI & AISC standards.
              </p>
            </div>
          </div>
        ) : currentResult ? (
          <div>
            {/* Report Header Metadata */}
            <div className="mb-4 p-3 bg-slate-50 dark:bg-tokyo-input rounded border border-slate-200 dark:border-tokyo-border flex flex-wrap gap-4 items-center justify-between text-xs font-mono text-slate-650 dark:text-tokyo-text">
              <div>
                <span className="text-slate-450 dark:text-tokyo-muted uppercase">Engine: </span>
                <span className="text-blue-600 dark:text-tokyo-blue font-bold uppercase">{currentResult.provider}</span>
                <span className="text-slate-350 dark:text-tokyo-border-light"> / </span>
                <span className="text-slate-500 dark:text-tokyo-muted">{currentResult.modelName}</span>
              </div>
              <div>
                <span className="text-slate-450 dark:text-tokyo-muted uppercase">Sheet: </span>
                <span className="text-slate-700 dark:text-tokyo-text font-bold">{currentResult.pageNumber} of {totalPageCount}</span>
              </div>
              <div>
                <span className="text-slate-450 dark:text-tokyo-muted uppercase">Audit: </span>
                <span className="text-blue-600 dark:text-tokyo-blue bg-blue-50 dark:bg-tokyo-blue/10 px-2.5 py-0.5 border border-blue-200/50 dark:border-tokyo-blue/20 rounded flex inline-flex items-center gap-1 font-semibold uppercase font-mono">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 dark:text-tokyo-blue" /> SECURE AUDIT COMPLETE
                </span>
              </div>
            </div>

            {/* Markdown Output */}
            <div className="bg-slate-50/60 dark:bg-tokyo-input/30 rounded-lg p-5 border border-slate-200 dark:border-tokyo-border text-slate-800 dark:text-tokyo-text leading-relaxed text-xs">
              <div className="prose prose-sm prose-slate dark:prose-invert max-w-none space-y-3 font-sans text-slate-705 dark:text-tokyo-text">
                <ReactMarkdown>{currentResult.analysis}</ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 bg-slate-50/50 dark:bg-tokyo-input/20 rounded-lg border border-dashed border-slate-200 dark:border-tokyo-border">
            <span className="p-3 bg-slate-100 dark:bg-tokyo-input border border-slate-200 dark:border-tokyo-border rounded-full text-blue-600 dark:text-tokyo-blue">
              <Sparkles className="h-6 w-6" />
            </span>
            <div className="space-y-1 px-4">
              <h4 className="font-display font-semibold text-sm text-slate-800 dark:text-tokyo-text">No Review Done for This Sheet</h4>
              <p className="text-xs text-slate-550 dark:text-tokyo-muted max-w-sm mx-auto leading-normal font-sans">
                Click "Verify Design & Run Structural AI" below to evaluate rebar joins, truss connections, or bearing notes.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
