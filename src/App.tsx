import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileCheck2,
  Sparkles,
  Download,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  FolderOpen,
  Cpu,
  Key,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  Info,
  Calendar,
  User,
  ExternalLink,
  Layers,
  Sun,
  Moon
} from 'lucide-react';
import { renderPdfPagesToImages, extractPdfText, renderPdfPageToImage, renderPdfPageToPdfBytes } from './utils/pdfRenderer';
import { generateZipForExport } from './utils/zipper';
import { PDFDrawingFile, PdfPageImage, AiModelConfig, AnalysisResult, DrawingChecklistItem, PDFRequirementsFile } from './types';
import ApiKeySettings from './components/ApiKeySettings';
import DrawingsChecklist from './components/DrawingsChecklist';
import BlueprintViewer from './components/BlueprintViewer';
import AnalysisReport from './components/AnalysisReport';
import EngineeringChat from './components/EngineeringChat';

const initialChecklist: DrawingChecklistItem[] = [
  { id: 'sc1', label: 'Verify continuous, direct load pathway from foundations to headers', checked: false, category: 'safety' },
  { id: 'sc2', label: 'Monitor shear-moment stress configurations and redundant truss cross-links', checked: false, category: 'safety' },
  { id: 'sc3', label: 'Evaluate structural vulnerabilities under critical earthquake/lateral gusts', checked: false, category: 'safety' },
  { id: 'sc4', label: 'Perform beam-column joints reinforcement tie audits under AC-318 spacing limits', checked: false, category: 'detailing' },
  { id: 'sc5', label: 'Audit connection lap splice tension anchorage embedment specs', checked: false, category: 'detailing' },
  { id: 'sc6', label: 'Inspect welded structural steel gusset sizing and splice plates details', checked: false, category: 'detailing' },
  { id: 'sc7', label: 'Confirm design calculations refer to IBC standards and AISC 360 guides', checked: false, category: 'compliance' },
  { id: 'sc8', label: 'Assert concrete (f\'c = 4000psi) and steel grades (A572 Gr. 50) labels on note lists', checked: false, category: 'materials' },
];

export default function App() {
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  // Apply theme class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // File state
  const [uploadedFile, setUploadedFile] = useState<PDFDrawingFile | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [isRenderingPdf, setIsRenderingPdf] = useState<boolean>(false);
  const [renderingProgress, setRenderingProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Separate standard & requirements document state
  const [uploadedRequirements, setUploadedRequirements] = useState<PDFRequirementsFile | null>(null);
  const [isParsingRequirements, setIsParsingRequirements] = useState<boolean>(false);
  const [requirementsProgress, setRequirementsProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [isDraggingRequirements, setIsDraggingRequirements] = useState<boolean>(false);

  // Model settings state
  const [aiConfig, setAiConfig] = useState<AiModelConfig>({
    provider: 'gemini',
    modelName: 'gemini-3.5-flash',
    customKey: ''
  });

  // Checklist state
  const [checklist, setChecklist] = useState<DrawingChecklistItem[]>(initialChecklist);

  // AI review reports cache: pageNumber -> AnalysisResult
  const [aiResults, setAiResults] = useState<Record<number, AnalysisResult>>({});
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Selected pages for compressed ZIP bundle
  const [zipSelectedPages, setZipSelectedPages] = useState<Set<number>>(new Set());
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [exportMode, setExportMode] = useState<'jpeg' | 'png' | 'pdf'>('jpeg');

  // Custom prompting state
  const [customPrompt, setCustomPrompt] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const requirementsInputRef = useRef<HTMLInputElement>(null);

  // Handle Drag & Drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        await processPdfFile(file);
      } else {
        alert('Please drop a valid .pdf structural document.');
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processPdfFile(files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Handle Requirements Drag & Drop
  const handleRequirementsDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingRequirements(true);
  };

  const handleRequirementsDragLeave = () => {
    setIsDraggingRequirements(false);
  };

  const handleRequirementsDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingRequirements(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        await processRequirementsPdfFile(file);
      } else {
        alert('Please drop a valid .pdf standards or requirements document.');
      }
    }
  };

  const handleRequirementsFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processRequirementsPdfFile(files[0]);
    }
  };

  const triggerRequirementsInput = () => {
    requirementsInputRef.current?.click();
  };

  const processRequirementsPdfFile = async (file: File) => {
    try {
      setIsParsingRequirements(true);
      setApiError(null);
      setRequirementsProgress({ current: 0, total: 0 });

      const pagesText = await extractPdfText(file, (current, total) => {
        setRequirementsProgress({ current, total });
      });

      if (pagesText.length === 0) {
        throw new Error('No readable text content was extracted from this PDF reference standard document.');
      }

      setUploadedRequirements({
        name: file.name,
        size: file.size,
        totalPages: pagesText.length,
        pagesText,
      });

    } catch (err: any) {
      console.error(err);
      setApiError(err.message || 'An error occurred while parsing the standards document.');
    } finally {
      setIsParsingRequirements(false);
    }
  };

  // Convert PDF to images client-side
  const processPdfFile = async (file: File) => {
    try {
      setIsRenderingPdf(true);
      setApiError(null);
      setAiResults({});
      setCustomPrompt('');
      setRenderingProgress({ current: 0, total: 0 });

      const renderFormat = exportMode === 'png' ? 'png' : 'jpeg';
      const pages = await renderPdfPagesToImages(file, (current, total) => {
        setRenderingProgress({ current, total });
      }, renderFormat);

      if (pages.length === 0) {
        throw new Error('No pages were rendered from this PDF file.');
      }

      setUploadedFile({
        name: file.name,
        size: file.size,
        totalPages: pages.length,
        pages,
        originalFile: file,
      });

      // Select all pages in zip bundle by default
      const defaultPages = new Set(pages.map(p => p.pageNumber));
      setZipSelectedPages(defaultPages);
      setCurrentPageIndex(0);

    } catch (err: any) {
      console.error(err);
      setApiError(err.message || 'An error occurred while parsing and rendering your PDF drawing.');
    } finally {
      setIsRenderingPdf(false);
    }
  };

    // Run AI Design Review API
  const runAiReview = async (specificPrompt?: string) => {
    if (!uploadedFile) return;
    const activePage = uploadedFile.pages[currentPageIndex];
    if (!activePage) return;

    setIsAnalyzing(true);
    setApiError(null);

    const activePrompt = specificPrompt || customPrompt;

    try {
      // Gather and truncate requirements text safely for prompt context optimization
      let requirementsText = '';
      if (uploadedRequirements) {
        requirementsText = uploadedRequirements.pagesText
          .map(p => `[Standard Doc Page ${p.pageNumber}]\n${p.text}`)
          .join('\n\n');
        
        if (requirementsText.length > 35000) {
          requirementsText = requirementsText.substring(0, 35000) + '\n\n... [Reference text truncated to avoid exceeding model input length limits] ...';
        }
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: activePage.base64,
          provider: aiConfig.provider,
          apiKey: aiConfig.customKey,
          model: aiConfig.modelName,
          customPrompt: activePrompt,
          drawingText: activePage.extractedText || '',
          requirementsText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Server error while performing design review.');
      }

      const result: AnalysisResult = {
        pageNumber: activePage.pageNumber,
        analysis: data.analysis,
        provider: aiConfig.provider,
        modelName: aiConfig.modelName,
        timestamp: new Date().toISOString(),
      };

      // Cache review result under page index
      setAiResults(prev => ({
        ...prev,
        [activePage.pageNumber]: result
      }));

    } catch (err: any) {
      console.error(err);
      setApiError(err.message || 'The structural analysis request could not be completed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ZIP download compiled archive
  const downloadZipArchive = async () => {
    if (!uploadedFile || zipSelectedPages.size === 0 || !uploadedFile.originalFile) return;

    setIsZipping(true);
    try {
      const selectedPageNumbers = Array.from(zipSelectedPages).sort((a, b) => a - b);

      const zipBlob = await generateZipForExport(
        uploadedFile.originalFile,
        selectedPageNumbers,
        exportMode,
        uploadedFile.pages
      );
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      
      const suffix = exportMode === 'pdf' ? 'PDF_Sheets' : (exportMode === 'png' ? 'PNG_Images' : 'JPEG_Images');
      link.download = `${uploadedFile.name.replace(/\.[^/.]+$/, "")}_${suffix}.zip`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      alert('Failed to generate drawing ZIP file: ' + err.message);
    } finally {
      setIsZipping(false);
    }
  };

  // Single Page Download
  const downloadSinglePage = async () => {
    if (!uploadedFile || !uploadedFile.originalFile) return;
    const page = uploadedFile.pages[currentPageIndex];
    if (!page) return;

    const baseName = uploadedFile.name.replace(/\.[^/.]+$/, "");
    const pageStr = String(page.pageNumber).padStart(3, '0');

    setIsZipping(true);
    try {
      if (exportMode === 'jpeg') {
        const link = document.createElement('a');
        link.href = page.base64;
        link.download = `${baseName}_Page_${pageStr}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (exportMode === 'png') {
        const pngBase64 = await renderPdfPageToImage(uploadedFile.originalFile, page.pageNumber, 'png');
        const link = document.createElement('a');
        link.href = pngBase64;
        link.download = `${baseName}_Page_${pageStr}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (exportMode === 'pdf') {
        const pdfBytes = await renderPdfPageToPdfBytes(uploadedFile.originalFile, page.pageNumber);
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${baseName}_Page_${pageStr}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to download single sheet: ' + err.message);
    } finally {
      setIsZipping(false);
    }
  };

  // Toggle zip compilation inclusion
  const togglePageZipSelection = (pageNumber: number) => {
    const updated = new Set(zipSelectedPages);
    if (updated.has(pageNumber)) {
      updated.delete(pageNumber);
    } else {
      updated.add(pageNumber);
    }
    setZipSelectedPages(updated);
  };

  // Bulk selectors for ZIP list
  const selectAllPagesForZip = (select: boolean) => {
    if (!uploadedFile) return;
    if (select) {
      setZipSelectedPages(new Set(uploadedFile.pages.map(p => p.pageNumber)));
    } else {
      setZipSelectedPages(new Set());
    }
  };

  // Interactive engineer checklist handlers
  const handleChecklistToggle = (id: string) => {
    setChecklist(prev =>
      prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item)
    );
  };

  const handleChecklistReset = () => {
    setChecklist(initialChecklist);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const currentActivePageImage = uploadedFile ? uploadedFile.pages[currentPageIndex] : null;
  const currentActiveResult = currentActivePageImage ? aiResults[currentActivePageImage.pageNumber] : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-tokyo-bg text-slate-900 dark:text-tokyo-text flex flex-col font-sans transition-colors duration-150" id="structuresight-dashboard">
      
      {/* Precision Drafting Header */}
      <header className="h-14 bg-slate-900 dark:bg-tokyo-card text-white flex items-center justify-between px-6 border-b border-slate-700 dark:border-tokyo-border flex-shrink-0 transition-colors duration-150">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 dark:bg-tokyo-blue rounded flex items-center justify-center font-bold text-lg text-white">S</div>
          <h1 className="text-xl font-semibold tracking-tight">StructureSight</h1>
          <span className="ml-4 text-xs font-mono text-slate-400 dark:text-tokyo-muted border border-slate-700 dark:border-tokyo-border px-2 py-0.5 rounded">v1.2.0-PRO</span>
        </div>

        {/* Engineer Session Details */}
        <div className="flex items-center gap-4 text-xs">
          <div className="hidden lg:flex items-center gap-2 bg-slate-800 dark:bg-tokyo-input px-3 py-1 rounded-md border border-slate-700 dark:border-tokyo-border">
            <span className="text-xs text-slate-400 dark:text-tokyo-muted">Model:</span>
            <span className="text-xs font-mono font-medium text-blue-400 dark:text-tokyo-blue">{aiConfig.modelName}</span>
            <div className="w-2 h-2 rounded-full bg-green-500 dark:bg-tokyo-green animate-pulse"></div>
          </div>
          
          <div className="hidden sm:flex text-slate-300 dark:text-tokyo-muted font-mono items-center gap-1.5 border border-slate-700 dark:border-tokyo-border px-3 py-1 rounded">
            <User className="h-3.5 w-3.5 text-slate-400 dark:text-tokyo-muted" />
            <span className="truncate max-w-[150px]" title="rafiqulhaque25@gmail.com">rafiqulhaque25West</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md bg-slate-800 dark:bg-tokyo-input text-slate-300 dark:text-tokyo-muted hover:text-white dark:hover:text-tokyo-text border border-slate-700 dark:border-tokyo-border hover:bg-slate-700 dark:hover:bg-tokyo-panel transition-colors cursor-pointer"
            title={theme === 'light' ? 'Switch to Tokyo Night' : 'Switch to Light Theme'}
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4 text-tokyo-yellow" />
            )}
          </button>

          <div className="w-8 h-8 bg-slate-700 dark:bg-tokyo-input rounded-full flex items-center justify-center text-xs border border-slate-600 dark:border-tokyo-border font-semibold text-white">JD</div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 flex flex-col xl:flex-row overflow-hidden">
        
        {/* Left Drawer / Side Panel Controls */}
        <section className="w-full xl:w-96 border-b xl:border-b-0 xl:border-r border-slate-200 dark:border-tokyo-border bg-white dark:bg-tokyo-panel p-5 overflow-y-auto space-y-5 shrink-0 select-none text-slate-700 dark:text-tokyo-text transition-colors duration-150">
          
          {/* Document Ingestion Sandbox */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-400 dark:text-tokyo-comment uppercase tracking-wider">
              Drawing Ingestion Sandbox
            </label>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`border-2 border-dashed rounded-lg p-5 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-blue-500 dark:border-tokyo-blue bg-blue-50/50 dark:bg-tokyo-blue/10'
                  : 'border-slate-200 dark:border-tokyo-border bg-slate-550 dark:bg-tokyo-input hover:bg-slate-100 dark:hover:bg-tokyo-card hover:border-slate-300 dark:hover:border-tokyo-border-light'
              }`}
              id="pdf-drop-zone"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".pdf"
                className="hidden"
                id="file-element"
              />
              <UploadCloud className="h-8 w-8 text-blue-500 dark:text-tokyo-blue mx-auto mb-2" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-700 dark:text-tokyo-text">Drag & Drop Drawing PDF</p>
                <p className="text-[10px] text-slate-400 dark:text-tokyo-muted font-mono">or click to browse local folders</p>
              </div>
            </div>

            {/* Ingested PDF Info Display */}
            {isRenderingPdf && (
              <div className="bg-slate-50 dark:bg-tokyo-input p-3 rounded border border-slate-200 dark:border-tokyo-border space-y-2 text-center text-xs text-slate-500 dark:text-tokyo-muted">
                <div className="flex justify-between font-mono text-[11px]">
                  <span>
                    {exportMode === 'png' && 'Converting PDF vectors to PNGs...'}
                    {exportMode === 'jpeg' && 'Converting PDF vectors to JPEGs...'}
                    {exportMode === 'pdf' && 'Rendering PDF sheets for Workbench...'}
                  </span>
                  <span className="text-blue-600 dark:text-tokyo-blue font-bold">{renderingProgress.current} / {renderingProgress.total}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-tokyo-card h-1 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 dark:bg-tokyo-blue h-full transition-all duration-150"
                    style={{ width: `${(renderingProgress.current / renderingProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {uploadedFile && !isRenderingPdf && (
              <div className="bg-slate-50 dark:bg-tokyo-input p-3 rounded-lg border border-slate-200 dark:border-tokyo-border text-xs flex items-center justify-between gap-3 text-slate-700 dark:text-tokyo-text">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-tokyo-muted mb-1">
                    <FileCheck2 className="h-3.5 w-3.5 text-blue-600 dark:text-tokyo-blue shrink-0" />
                    <span className="truncate font-semibold text-slate-800 dark:text-tokyo-text" title={uploadedFile.name}>
                      {uploadedFile.name}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-tokyo-muted font-mono">
                    Size: {formatFileSize(uploadedFile.size)} • Total Sheets: {uploadedFile.totalPages}
                  </div>
                </div>
                <button
                  onClick={() => setUploadedFile(null)}
                  className="text-slate-400 dark:text-tokyo-muted hover:text-red-500 dark:hover:text-tokyo-red transition-colors py-1 px-1.5 rounded cursor-pointer animate-pulse"
                  title="Clear drawing"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Conversion Options & AI Interpretation */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-tokyo-border">
            <label className="block text-xs font-semibold text-slate-400 dark:text-tokyo-comment uppercase tracking-wider">
              Conversion Option & AI Interpretation
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 dark:border-tokyo-border text-[10px] font-mono font-semibold">
              <button
                type="button"
                onClick={() => setExportMode('jpeg')}
                className={`py-1 rounded transition-all cursor-pointer ${
                  exportMode === 'jpeg'
                    ? 'bg-white dark:bg-tokyo-card text-blue-600 dark:text-tokyo-blue shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-700 dark:text-tokyo-muted dark:hover:text-tokyo-text'
                }`}
              >
                JPEG
              </button>
              <button
                type="button"
                onClick={() => setExportMode('png')}
                className={`py-1 rounded transition-all cursor-pointer ${
                  exportMode === 'png'
                    ? 'bg-white dark:bg-tokyo-card text-blue-600 dark:text-tokyo-blue shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-700 dark:text-tokyo-muted dark:hover:text-tokyo-text'
                }`}
              >
                PNG
              </button>
              <button
                type="button"
                onClick={() => setExportMode('pdf')}
                className={`py-1 rounded transition-all cursor-pointer ${
                  exportMode === 'pdf'
                    ? 'bg-white dark:bg-tokyo-card text-blue-600 dark:text-tokyo-blue shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-700 dark:text-tokyo-muted dark:hover:text-tokyo-text'
                }`}
              >
                Split PDF
              </button>
            </div>
            {/* AI Interpretation Note */}
            <div className="bg-blue-50/50 dark:bg-tokyo-blue/5 border border-blue-100 dark:border-tokyo-border/30 rounded p-2.5 text-[10.5px] leading-relaxed font-sans text-slate-650 dark:text-tokyo-muted">
              {exportMode === 'jpeg' && (
                <p>
                  <span className="font-semibold text-slate-800 dark:text-tokyo-text">JPEG (Default):</span> High-compression web-standard format. Excellent for fast page rendering and general review. Vision models parse it well, but extremely fine rebar spacing annotations or pixelated detail symbols may be slightly distorted by JPEG compression blocks.
                </p>
              )}
              {exportMode === 'png' && (
                <p>
                  <span className="font-semibold text-slate-800 dark:text-tokyo-text">PNG (Lossless):</span> Lossless pixel fidelity. <strong className="text-blue-600 dark:text-tokyo-blue font-semibold">Recommended for AI Vision models.</strong> By preserving every vector stroke, thin grid lines, and microscopic text labels without compression artifacts, it prevents the AI from misreading tiny dimensions.
                </p>
              )}
              {exportMode === 'pdf' && (
                <p>
                  <span className="font-semibold text-slate-800 dark:text-tokyo-text">Split PDF (Vector):</span> Retains original document structures and text layers. Excellent for text-extraction models. However, standard vision models cannot read PDFs directly and will convert them to images behind the scenes, making PNG a cleaner direct vision choice.
                </p>
              )}
            </div>
          </div>

          {/* Standards & Requirements PDF Reference Ingestion */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-tokyo-border">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-400 dark:text-tokyo-comment uppercase tracking-wider">
                Reference Standards & Specs
              </label>
              {uploadedRequirements && (
                <span className="text-[9px] bg-emerald-550 dark:bg-tokyo-green/10 text-emerald-700 dark:text-tokyo-green font-bold px-2 py-0.5 rounded border border-emerald-250 dark:border-tokyo-green/20 animate-pulse font-mono">
                  ACTIVE REFERENCE
                </span>
              )}
            </div>

            <div
              onDragOver={handleRequirementsDragOver}
              onDragLeave={handleRequirementsDragLeave}
              onDrop={handleRequirementsDrop}
              onClick={triggerRequirementsInput}
              className={`border-2 border-dashed rounded-lg p-5 text-center transition-all cursor-pointer ${
                isDraggingRequirements
                  ? 'border-blue-500 dark:border-tokyo-blue bg-blue-50/50 dark:bg-tokyo-blue/10'
                  : 'border-slate-200 dark:border-tokyo-border bg-slate-50 dark:bg-tokyo-input hover:bg-slate-100 dark:hover:bg-tokyo-card hover:border-slate-300 dark:hover:border-tokyo-border-light'
              }`}
              id="requirements-drop-zone"
            >
              <input
                type="file"
                ref={requirementsInputRef}
                onChange={handleRequirementsFileSelect}
                accept=".pdf"
                className="hidden"
                id="requirements-file-element"
              />
              <UploadCloud className="h-8 w-8 text-blue-500 dark:text-tokyo-blue mx-auto mb-2" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-700 dark:text-tokyo-text">Standards & Requirements PDF</p>
                <p className="text-[10px] text-slate-400 dark:text-tokyo-muted font-mono">Upload ACI / AISC specs or project criteria</p>
              </div>
            </div>

            {/* Parsing requirements feedback */}
            {isParsingRequirements && (
              <div className="bg-slate-50 dark:bg-tokyo-input p-3 rounded border border-slate-200 dark:border-tokyo-border space-y-2 text-center text-xs text-slate-500 dark:text-tokyo-muted">
                <div className="flex justify-between font-mono text-[11px]">
                  <span>Extracting standards text...</span>
                  <span className="text-blue-600 dark:text-tokyo-blue font-bold">
                    {requirementsProgress.current} / {requirementsProgress.total}
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-tokyo-card h-1 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 dark:bg-tokyo-blue h-full transition-all duration-150"
                    style={{ width: `${(requirementsProgress.current / requirementsProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {uploadedRequirements && !isParsingRequirements && (
              <div className="bg-slate-50 dark:bg-tokyo-input p-3 rounded-lg border border-slate-200 dark:border-tokyo-border text-xs space-y-2 text-slate-700 dark:text-tokyo-text">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-tokyo-muted mb-1">
                      <FileCheck2 className="h-3.5 w-3.5 text-blue-600 dark:text-tokyo-blue shrink-0" />
                      <span className="truncate font-semibold text-slate-800 dark:text-tokyo-text" title={uploadedRequirements.name}>
                        {uploadedRequirements.name}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-tokyo-muted font-mono">
                      Size: {formatFileSize(uploadedRequirements.size)} • total pages: {uploadedRequirements.totalPages}
                    </div>
                  </div>
                  <button
                    onClick={() => setUploadedRequirements(null)}
                    className="text-slate-400 dark:text-tokyo-muted hover:text-red-500 dark:hover:text-tokyo-red transition-colors py-1 px-1.5 rounded cursor-pointer"
                    title="Remove requirements reference"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
                
                {/* Reference Snippet Preview Box */}
                {uploadedRequirements.pagesText[0] && (
                  <div className="bg-white dark:bg-tokyo-card p-2 rounded border border-slate-100 dark:border-tokyo-border text-[10px] text-slate-500 dark:text-tokyo-muted leading-normal max-h-[80px] overflow-y-auto font-mono scrollbar-thin">
                    <span className="text-slate-400 dark:text-tokyo-comment font-bold uppercase block text-[8px] mb-1">Extracted Text Sample:</span>
                    <p className="italic leading-relaxed">
                      "{uploadedRequirements.pagesText[0].text.length > 180 
                        ? uploadedRequirements.pagesText[0].text.substring(0, 180) + '...'
                        : uploadedRequirements.pagesText[0].text}"
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Model AI Configuration Settings API Panel */}
          <ApiKeySettings config={aiConfig} onChange={setAiConfig} />

          {/* Page Selector Grid */}
          {uploadedFile && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold text-slate-400 dark:text-tokyo-comment uppercase tracking-wider">
                  Ingested Blueprint Pages ({uploadedFile.pages.length})
                </label>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-450 dark:text-tokyo-muted">
                  <button onClick={() => selectAllPagesForZip(true)} className="text-blue-600 dark:text-tokyo-blue hover:text-blue-700 dark:hover:text-tokyo-blue/80 cursor-pointer font-bold">
                    All
                  </button>
                  <span>•</span>
                  <button onClick={() => selectAllPagesForZip(false)} className="text-blue-600 dark:text-tokyo-blue hover:text-blue-700 dark:hover:text-tokyo-blue/80 cursor-pointer font-bold">
                    None
                  </button>
                </div>
              </div>

              {/* Compressed ZIP download executor */}
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-4 gap-1.5 max-h-[160px] overflow-y-auto p-2 bg-slate-50 dark:bg-tokyo-input rounded border border-slate-200 dark:border-tokyo-border">
                  {uploadedFile.pages.map((page, idx) => {
                    const isSelected = currentPageIndex === idx;
                    const inZip = zipSelectedPages.has(page.pageNumber);
                    return (
                      <div key={page.pageNumber} className="relative group">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentPageIndex(idx);
                            setApiError(null);
                          }}
                          className={`w-full py-2.5 rounded font-mono text-xs font-bold border transition-all text-center flex flex-col items-center justify-center cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-tokyo-blue/10 border-blue-500 dark:border-tokyo-blue text-blue-700 dark:text-tokyo-blue shadow-sm'
                              : 'bg-white dark:bg-tokyo-card border-slate-200 dark:border-tokyo-border text-slate-600 dark:text-tokyo-muted hover:border-slate-350 dark:hover:border-tokyo-border-light hover:bg-slate-50 dark:hover:bg-tokyo-panel'
                          }`}
                        >
                          <span>{page.pageNumber}</span>
                        </button>
                        
                        {/* Little checkbox on preview to select/deselect page to ZIP compile */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePageZipSelection(page.pageNumber);
                          }}
                          className={`absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full border flex items-center justify-center transition-all ${
                            inZip 
                              ? 'bg-blue-600 dark:bg-tokyo-blue border-blue-500 dark:border-tokyo-blue text-white shadow' 
                              : 'bg-white dark:bg-tokyo-card border-slate-200 dark:border-tokyo-border text-slate-400 dark:text-tokyo-muted'
                          }`}
                          title={`Toggle Page ${page.pageNumber} for ZIP`}
                        >
                          {inZip && <span className="text-[8px] leading-none">✓</span>}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={downloadZipArchive}
                  disabled={isZipping || zipSelectedPages.size === 0}
                  className="w-full bg-blue-600 dark:bg-tokyo-blue hover:bg-blue-700 dark:hover:bg-tokyo-blue/80 text-white border border-transparent disabled:opacity-40 disabled:hover:bg-blue-600 font-mono py-2.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer uppercase tracking-wider shadow-sm"
                >
                  <Download className={`h-4 w-4 ${isZipping ? 'animate-bounce' : ''}`} />
                  {isZipping ? 'Archiving & Compiling...' : `Download ZIP (${zipSelectedPages.size} ${exportMode === 'pdf' ? 'PDFs' : exportMode.toUpperCase() + 's'})`}
                </button>
              </div>
            </div>
          )}

          {/* Interactive Structural checklist */}
          <DrawingsChecklist
            items={checklist}
            onToggle={handleChecklistToggle}
            onReset={handleChecklistReset}
          />

         </section>

        {/* Center / Right Drafting Floor Workspace */}
        <section className="flex-1 bg-slate-100 dark:bg-tokyo-bg p-6 overflow-y-auto flex flex-col lg:grid lg:grid-cols-2 gap-6 min-h-0 transition-colors duration-150">
          
          {/* Column A: HD Page drawing stage viewer */}
          <div className="flex flex-col space-y-4">
            
            {/* API Exception Error Notice Bar */}
            {apiError && (
              <div className="bg-rose-50 dark:bg-tokyo-red/10 border border-rose-250 dark:border-tokyo-red/25 rounded p-4 text-xs text-rose-805 dark:text-tokyo-red font-sans flex items-start gap-3 shadow-sm">
                <ShieldAlert className="h-4.5 w-4.5 text-rose-605 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold uppercase tracking-wider font-mono text-rose-700 dark:text-tokyo-red">System Review Exception</p>
                  <p className="leading-snug text-rose-600 dark:text-tokyo-red/90">{apiError}</p>
                </div>
              </div>
            )}

            <div className="flex-1">
              <BlueprintViewer
                pageImage={currentActivePageImage}
                isSelectedInZip={currentActivePageImage ? zipSelectedPages.has(currentActivePageImage.pageNumber) : false}
                onToggleZipSelection={() => currentActivePageImage && togglePageZipSelection(currentActivePageImage.pageNumber)}
                onDownloadPageImage={downloadSinglePage}
                isLoadingFile={isRenderingPdf}
                exportMode={exportMode}
                isDownloading={isZipping}
              />
            </div>

            {/* Custom Review Prompt Drafting Input Box */}
            {uploadedFile && (
              <div className="bg-white dark:bg-tokyo-panel border border-slate-200 dark:border-tokyo-border rounded-lg p-5 space-y-3 shadow-sm transition-colors duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Info className="h-4.5 w-4.5 text-blue-600 dark:text-tokyo-blue" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-tokyo-text uppercase tracking-widest font-mono">
                      Drawing reviewer instructions
                    </span>
                  </div>
                  {customPrompt && (
                    <button
                      onClick={() => setCustomPrompt('')}
                      className="text-[10px] text-slate-550 dark:text-tokyo-muted hover:text-blue-650 dark:hover:text-tokyo-blue font-mono transition-colors border border-slate-200 dark:border-tokyo-border px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      Clear custom prompt
                    </button>
                  )}
                </div>

                <textarea
                  className="w-full bg-slate-50 dark:bg-tokyo-input border border-slate-200 dark:border-tokyo-border rounded p-3 text-xs text-slate-800 dark:text-tokyo-text outline-none focus:border-blue-500 dark:focus:border-tokyo-blue focus:ring-1 focus:ring-blue-500 dark:focus:ring-tokyo-blue transition-all font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 leading-relaxed"
                  rows={3}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Draft specific review instructions here (e.g., 'Inspect the moment connection bolts on vertical support girders.' Leave empty to execute the standard expert structural audit)."
                />

                <button
                  type="button"
                  onClick={() => runAiReview()}
                  disabled={isAnalyzing || isRenderingPdf}
                  className="w-full bg-slate-900 dark:bg-tokyo-input hover:bg-black dark:hover:bg-tokyo-card text-white dark:text-tokyo-text border border-transparent dark:border-tokyo-border font-semibold py-3 px-4 rounded text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider font-mono cursor-pointer shadow-sm"
                >
                  <Sparkles className={`h-4.5 w-4.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  {isAnalyzing ? 'Analyzing structural assets...' : 'Verify Design & Run Structural AI'}
                </button>
              </div>
            )}
          </div>

          {/* Column B: Lead Structural Engineering AI Report Panel & Interactive Chat */}
          <div className="flex flex-col space-y-6">
            <AnalysisReport
              currentResult={currentActiveResult}
              isLoading={isAnalyzing}
              onRunAnalysis={(prompt) => runAiReview(prompt)}
              currentPageNumber={uploadedFile ? currentPageIndex + 1 : 0}
              totalPageCount={uploadedFile ? uploadedFile.totalPages : 0}
              drawingName={uploadedFile ? uploadedFile.name : 'Unknown Drawing'}
            />

            <EngineeringChat
              pageImage={currentActivePageImage}
              uploadedRequirements={uploadedRequirements}
              aiConfig={aiConfig}
            />
          </div>

        </section>

      </main>

      {/* Engineering Footer details */}
      <footer className="bg-slate-100 dark:bg-tokyo-panel border-t border-slate-200 dark:border-tokyo-border px-6 py-3.5 flex flex-wrap items-center justify-between text-[11px] font-sans text-slate-550 dark:text-tokyo-muted shrink-0 font-medium transition-colors duration-150">
        <div>
          StructureSight CAD review system. Designed for Structural Review Boards and Civil Engineers.
        </div>
        <div className="flex gap-4 items-center">
          <span className="flex items-center gap-1 text-blue-700 dark:text-tokyo-blue bg-blue-50 dark:bg-tokyo-blue/10 px-2.5 py-0.5 rounded border border-blue-200 dark:border-tokyo-blue/20">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-tokyo-blue animate-pulse" /> Active Session Secure
          </span>
          <span>Security Level: Air-gap Sandbox Encapsulated</span>
        </div>
      </footer>

    </div>
  );
}
