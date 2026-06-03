import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Download, CheckSquare, Square, FileCheck2, ArrowLeftRight, Layers } from 'lucide-react';
import { PdfPageImage } from '../types';

interface BlueprintViewerProps {
  pageImage: PdfPageImage | null;
  isSelectedInZip: boolean;
  onToggleZipSelection: () => void;
  onDownloadPageImage: () => void;
  isLoadingFile: boolean;
}

export default function BlueprintViewer({
  pageImage,
  isSelectedInZip,
  onToggleZipSelection,
  onDownloadPageImage,
  isLoadingFile,
}: BlueprintViewerProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 25, 250));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 25, 50));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  return (
    <div className="bg-white dark:bg-tokyo-panel border border-slate-200 dark:border-tokyo-border rounded-lg p-5 text-slate-700 dark:text-tokyo-text shadow-sm flex flex-col h-full transition-colors duration-150" id="blueprint-viewer-container">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-100 dark:border-tokyo-border pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-blue-600 dark:text-tokyo-blue" />
          <h3 className="font-display font-semibold text-sm tracking-wide text-slate-800 dark:text-tokyo-text uppercase">
            Drawing Workbench Spec
          </h3>
        </div>

        {pageImage && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Zoom Controllers */}
            <div className="flex items-center bg-slate-50 dark:bg-tokyo-input border border-slate-200 dark:border-tokyo-border rounded overflow-hidden">
              <button
                onClick={handleZoomOut}
                className="p-1 px-2.5 hover:bg-slate-100 dark:hover:bg-tokyo-card hover:text-blue-600 dark:hover:text-tokyo-blue transition-colors border-r border-slate-200 dark:border-tokyo-border cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="h-4.5 w-4.5 text-slate-500 dark:text-tokyo-muted" />
              </button>
              <span className="px-2 text-[10px] font-mono text-slate-600 dark:text-tokyo-text min-w-[45px] text-center" id="zoom-level-text">
                {zoomLevel}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1 px-2.5 hover:bg-slate-100 dark:hover:bg-tokyo-card hover:text-blue-600 dark:hover:text-tokyo-blue transition-colors border-l border-slate-200 dark:border-tokyo-border cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="h-4.5 w-4.5 text-slate-500 dark:text-tokyo-muted" />
              </button>
            </div>

            <button
              onClick={handleResetZoom}
              className="px-2 py-1 bg-slate-50 dark:bg-tokyo-input border border-slate-200 dark:border-tokyo-border hover:bg-slate-100 dark:hover:bg-tokyo-card rounded font-mono text-[10px] text-slate-500 dark:text-tokyo-muted transition-all cursor-pointer"
            >
              Fit
            </button>

            {/* ZIP selection toggle */}
            <button
              onClick={onToggleZipSelection}
              className={`flex items-center gap-1.5 py-1 px-2.5 rounded font-mono text-[11px] font-medium border transition-all cursor-pointer ${
                isSelectedInZip
                  ? 'bg-blue-50 dark:bg-tokyo-blue/10 border-blue-550 dark:border-tokyo-blue text-blue-700 dark:text-tokyo-blue'
                  : 'bg-slate-50 dark:bg-tokyo-input border-slate-200 dark:border-tokyo-border hover:border-slate-350 dark:hover:border-tokyo-border-light text-slate-500 dark:text-tokyo-muted'
              }`}
              title="Include or exclude this page in final ZIP export bundle"
            >
              {isSelectedInZip ? (
                <>
                  <CheckSquare className="h-4 w-4 text-blue-600 dark:text-tokyo-blue" /> Including in ZIP
                </>
              ) : (
                <>
                  <Square className="h-4 w-4 text-slate-400 dark:text-tokyo-muted" /> Exclude from ZIP
                </>
              )}
            </button>

            {/* Export single image */}
            <button
              onClick={onDownloadPageImage}
              className="flex items-center gap-1.5 py-1 px-2.5 bg-slate-50 dark:bg-tokyo-input border border-slate-200 dark:border-tokyo-border hover:bg-slate-100 dark:hover:bg-tokyo-card text-slate-600 dark:text-tokyo-text hover:text-blue-600 dark:hover:text-tokyo-blue rounded transition-all cursor-pointer"
              title="Download page drafting as a standalone JPEG file"
            >
              <Download className="h-4 w-4" /> Download JPEG
            </button>
          </div>
        )}
      </div>

      {/* Main Drawing Stage */}
      <div className="flex-1 min-h-[350px] bg-slate-50/70 dark:bg-tokyo-bg rounded-lg border border-slate-250 dark:border-tokyo-border relative overflow-auto flex items-center justify-center p-4 blueprint-grid transition-colors duration-150">
        {isLoadingFile ? (
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="h-10 w-10 border-4 border-slate-200 dark:border-tokyo-border border-t-blue-600 dark:border-tokyo-blue rounded-full animate-spin" />
            <p className="text-xs font-mono text-slate-400 dark:text-tokyo-comment uppercase tracking-widest animate-pulse">Rendering Design Blueprints...</p>
          </div>
        ) : pageImage ? (
          <div 
            className="transition-transform duration-200 ease-out origin-center select-none"
            style={{ transform: `scale(${zoomLevel / 100})` }}
          >
            <img
              src={pageImage.base64}
              alt={pageImage.name}
              className="max-h-[60vh] max-w-full rounded shadow-xl border border-slate-200 dark:border-tokyo-border pointer-events-none"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="text-center p-8 text-slate-400 dark:text-tokyo-muted max-w-md space-y-3">
            <FileCheck2 className="h-10 w-10 text-slate-300 dark:text-tokyo-border-light mx-auto" />
            <div>
              <p className="font-display text-sm font-medium text-slate-700 dark:text-tokyo-text">Workspace Vacant</p>
              <p className="text-xs text-slate-500 dark:text-tokyo-muted mt-1">
                Upload structural drawings or blueprints in the private dashboard side-drawer to begin analysis, image rendering, and lead review reports.
              </p>
            </div>
          </div>
        )}

        {/* Floating Page Number watermark */}
        {pageImage && (
          <div className="absolute bottom-3 right-3 px-2 border border-slate-200 dark:border-tokyo-border py-1 bg-white/90 dark:bg-tokyo-panel/90 rounded text-[10px] font-mono text-slate-500 dark:text-tokyo-text uppercase shadow-sm">
            Sheet {pageImage.pageNumber} • HD 2.0x
          </div>
        )}
      </div>
    </div>
  );
}
