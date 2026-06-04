import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Download, Sparkles, HelpCircle, FileText, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { AnalysisResult } from '../types';

function parseMarkdownToHtml(markdown: string): string {
  if (!markdown) return "";

  // 1. Split into lines
  const lines = markdown.split(/\r?\n/);
  const result: string[] = [];

  let inCodeBlock = false;
  let codeContent: string[] = [];
  
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;

  let inTable = false;
  let tableHeaderParsed = false;
  let tableRows: string[][] = [];

  let inBlockquote = false;
  let blockquoteContent: string[] = [];

  // Helper to format inline tags safely
  const formatInline = (text: string): string => {
    let formatted = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    // Bold
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Italic
    formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");
    // Inline code
    formatted = formatted.replace(/`(.*?)`/g, "<code style='background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 11px; color: #0f172a;'>$1</code>");
    return formatted;
  };

  // Helper to close open blocks
  const closeBlocks = () => {
    if (inList) {
      if (listType === 'ul') {
        result.push("</ul>");
      } else if (listType === 'ol') {
        result.push("</ol>");
      }
      inList = false;
      listType = null;
    }
    if (inTable) {
      // Build HTML table
      let tableHtml = `<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; text-align: left; border: 1px solid #e2e8f0;">`;
      tableRows.forEach((row, idx) => {
        const isHeader = idx === 1 && tableHeaderParsed; // the row index 1 is usually header if separator was row 1
        // Actually, we can treat the very first row parsed before separator as header.
        const isFirst = idx === 0;
        tableHtml += `<tr style="${isFirst ? 'background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;' : 'border-bottom: 1px solid #f1f5f9;'}">`;
        row.forEach(cell => {
          const cellContent = formatInline(cell.trim());
          if (isFirst) {
            tableHtml += `<th style="padding: 10px 12px; font-weight: 600; color: #1e3a8a;">${cellContent}</th>`;
          } else {
            tableHtml += `<td style="padding: 10px 12px; color: #334155;">${cellContent}</td>`;
          }
        });
        tableHtml += `</tr>`;
      });
      tableHtml += `</table>`;
      result.push(tableHtml);
      inTable = false;
      tableHeaderParsed = false;
      tableRows = [];
    }
    if (inBlockquote) {
      const quoteHtml = `<blockquote style="border-left: 4px solid #3b82f6; padding: 6px 16px; margin: 0 0 16px 0; color: #475569; background-color: #f8fafc; font-style: italic; border-radius: 0 4px 4px 0;">${formatInline(blockquoteContent.join("<br/>"))}</blockquote>`;
      result.push(quoteHtml);
      inBlockquote = false;
      blockquoteContent = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code blocks
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        // End of code block
        const blockHtml = `<pre style="background-color: #f1f5f9; padding: 12px 16px; border-radius: 6px; font-family: monospace; font-size: 12px; overflow-x: auto; border-left: 4px solid #3b82f6; color: #334155; margin-bottom: 16px; white-space: pre-wrap;">${codeContent.join("\n")}</pre>`;
        result.push(blockHtml);
        inCodeBlock = false;
        codeContent = [];
      } else {
        // Start of code block
        closeBlocks();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      // Escape HTML tags in raw code
      const escapedLine = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      codeContent.push(escapedLine);
      continue;
    }

    // 2. Horizontal rule
    if (trimmed === "---" || trimmed === "***") {
      closeBlocks();
      result.push(`<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />`);
      continue;
    }

    // 3. Headers
    if (trimmed.startsWith("#")) {
      closeBlocks();
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = formatInline(match[2]);
        if (level === 1) {
          result.push(`<h2 style="color: #1e3a8a; margin-top: 26px; margin-bottom: 12px; font-size: 18px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; font-weight: 800;">${text}</h2>`);
        } else if (level === 2) {
          result.push(`<h3 style="color: #1e3a8a; margin-top: 22px; margin-bottom: 10px; font-size: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; font-weight: 700;">${text}</h3>`);
        } else {
          result.push(`<h4 style="color: #1e3a8a; margin-top: 18px; margin-bottom: 8px; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-weight: 600;">${text}</h4>`);
        }
      }
      continue;
    }

    // 4. Blockquotes
    if (trimmed.startsWith(">")) {
      closeBlocks();
      inBlockquote = true;
      const quoteText = trimmed.substring(1).trim();
      blockquoteContent.push(quoteText);
      continue;
    }

    // 5. Tables
    if (trimmed.startsWith("|")) {
      // Split by | but ignore leading/trailing empty cells
      const cells = trimmed.split("|").slice(1, -1);
      
      // Check if it is a separator line like |---|---|
      const isSeparator = cells.every(c => c.trim().match(/^-+$/));
      
      if (isSeparator) {
        tableHeaderParsed = true;
      } else {
        if (!inTable) {
          closeBlocks();
          inTable = true;
        }
        tableRows.push(cells);
      }
      continue;
    }

    // 6. Bullet lists
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        closeBlocks();
        inList = true;
        listType = 'ul';
        result.push(`<ul style="margin-top: 0; margin-bottom: 14px; padding-left: 20px; list-style-type: disc;">`);
      }
      result.push(`<li style="margin-bottom: 6px;">${formatInline(ulMatch[1])}</li>`);
      continue;
    }

    // 7. Ordered lists
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        closeBlocks();
        inList = true;
        listType = 'ol';
        result.push(`<ol style="margin-top: 0; margin-bottom: 14px; padding-left: 20px; list-style-type: decimal;">`);
      }
      result.push(`<li style="margin-bottom: 6px;">${formatInline(olMatch[2])}</li>`);
      continue;
    }

    // 8. Plain paragraph or empty line
    if (trimmed === "") {
      closeBlocks();
    } else {
      // If we are currently compiling a text block, we can continue or start new
      closeBlocks();
      result.push(`<p style="margin-top: 0; margin-bottom: 14px; font-size: 13.5px; line-height: 1.6; color: #334155;">${formatInline(trimmed)}</p>`);
    }
  }

  // Close any remaining blocks
  closeBlocks();

  return result.join("\n");
}

interface AnalysisReportProps {
  currentResult: AnalysisResult | null;
  isLoading: boolean;
  onRunAnalysis: (customPrompt?: string) => void;
  currentPageNumber: number;
  totalPageCount: number;
  drawingName: string;
  isBulkReviewing: boolean;
  bulkProgress: { current: number; total: number } | null;
  hasRequirements: boolean;
  selectedPagesCount: number;
  onStartBulkReview: () => void;
  hasUploadedFile: boolean;
}

export default function AnalysisReport({
  currentResult,
  isLoading,
  onRunAnalysis,
  currentPageNumber,
  totalPageCount,
  drawingName,
  isBulkReviewing,
  bulkProgress,
  hasRequirements,
  selectedPagesCount,
  onStartBulkReview,
  hasUploadedFile,
}: AnalysisReportProps) {

  // Report metadata form fields
  const [projectName, setProjectName] = React.useState('');
  const [clientName, setClientName] = React.useState('');
  const [leadAuditor, setLeadAuditor] = React.useState('rafiqulhaque25West');
  const [contractId, setContractId] = React.useState('');
  const [isMetadataExpanded, setIsMetadataExpanded] = React.useState(false);

  // Sync project name with drawing name initially
  React.useEffect(() => {
    if (drawingName) {
      setProjectName(drawingName.replace(/\.[^/.]+$/, "").replace(/_/g, " "));
    }
  }, [drawingName]);

  const copyToClipboard = () => {
    if (!currentResult) return;
    navigator.clipboard.writeText(currentResult.analysis);
    alert("Analysis copied to clipboard!");
  };

  const downloadReport = () => {
    if (!currentResult) return;
    
    const htmlContent = parseMarkdownToHtml(currentResult.analysis);
    const dateStr = new Date(currentResult.timestamp).toLocaleString();

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Independent Design Check Report - ${projectName || drawingName}</title>
  <style>
    body {
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #334155;
      line-height: 1.6;
      margin: 0;
      padding: 40px;
      background-color: #f8fafc;
    }
    .report-container {
      max-width: 850px;
      margin: 0 auto;
      background: #ffffff;
      padding: 50px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
      border-bottom: 3px solid #1e3a8a;
      padding-bottom: 20px;
    }
    .logo-cell {
      font-size: 24px;
      font-weight: 800;
      color: #1e3a8a;
      font-family: 'Segoe UI', sans-serif;
    }
    .report-title {
      font-size: 18px;
      font-weight: 700;
      text-transform: uppercase;
      text-align: right;
      color: #0f172a;
      letter-spacing: 0.05em;
    }
    .metadata-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      background: #f8fafc;
      padding: 20px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      margin-bottom: 30px;
      font-size: 13px;
    }
    .metadata-item {
      display: flex;
      flex-direction: column;
    }
    .metadata-label {
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .metadata-value {
      color: #0f172a;
      font-weight: 500;
    }
    .report-content {
      font-size: 14px;
      color: #334155;
    }
    .footer {
      margin-top: 50px;
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body {
        background-color: #ffffff;
        padding: 0;
      }
      .report-container {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      .footer {
        position: fixed;
        bottom: 0;
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <table class="header-table">
      <tr>
        <td class="logo-cell">StructureSight</td>
        <td class="report-title">Independent Design Check Report</td>
      </tr>
    </table>
    
    <div class="metadata-grid">
      <div class="metadata-item">
        <span class="metadata-label">Project / Drawing Name</span>
        <span class="metadata-value">${projectName || drawingName}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Drawing Sheet Details</span>
        <span class="metadata-value">Sheet ${currentResult.pageNumber} of ${totalPageCount} (${drawingName})</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Client / Owner Name</span>
        <span class="metadata-value">${clientName || 'N/A'}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Project Code / Contract ID</span>
        <span class="metadata-value">${contractId || 'N/A'}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Reviewing Engine</span>
        <span class="metadata-value">${currentResult.provider.toUpperCase()} (${currentResult.modelName})</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Lead Engineer / Auditor</span>
        <span class="metadata-value">${leadAuditor || 'rafiqulhaque25West'}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Date & Time</span>
        <span class="metadata-value">${dateStr}</span>
      </div>
    </div>

    <div class="report-content">
      ${htmlContent}
    </div>

    <div class="footer">
      <span>StructureSight CAD review system. Confidential - Internal Structural Audit Record.</span>
      <span>Security Level: Air-gap Sandbox Encapsulated</span>
    </div>
  </div>
</body>
</html>`;

    const element = document.createElement("a");
    const file = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `${(projectName || drawingName).replace(/\s+/g, "_")}_Sheet${currentResult.pageNumber}_Review_Report.html`;
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
             Independent Design Check
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
        {isLoading || isBulkReviewing ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-slate-50/60 dark:bg-tokyo-input/40 rounded-lg border border-slate-200 dark:border-tokyo-border">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-4 border-slate-250 dark:border-tokyo-border border-t-blue-600 dark:border-tokyo-blue animate-spin" />
              <Sparkles className="h-5 w-5 text-blue-500 absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-mono text-blue-600 dark:text-tokyo-blue uppercase tracking-widest animate-pulse">
                {isBulkReviewing 
                  ? `Reviewing Sheet ${bulkProgress?.current} of ${bulkProgress?.total}...` 
                  : 'Running Structural FEA/Vision Models...'}
              </p>
              <p className="text-xs text-slate-550 dark:text-tokyo-muted max-w-xs leading-normal font-sans">
                {isBulkReviewing 
                  ? 'Performing batch design checks across selected blueprint sheets using specified engineering guidelines.' 
                  : 'Executing design audits, extracting tabular details, assessing load paths, and identifying potential code violations under ACI & AISC standards.'}
              </p>
            </div>
          </div>
        ) : currentResult ? (
          <div className="space-y-4">
            {/* Report Header Metadata */}
            <div className="p-3 bg-slate-50 dark:bg-tokyo-input rounded border border-slate-200 dark:border-tokyo-border flex flex-wrap gap-4 items-center justify-between text-xs font-mono text-slate-650 dark:text-tokyo-text">
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

            {/* Project Details Section */}
            <div className="bg-slate-50/50 dark:bg-tokyo-input/20 border border-slate-250 dark:border-tokyo-border rounded-lg overflow-hidden transition-all duration-150">
              <button
                type="button"
                onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
                className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-tokyo-text hover:bg-slate-100 dark:hover:bg-tokyo-input/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-tokyo-blue" />
                  <span>Report Metadata & Project Information</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-tokyo-blue font-mono font-bold">
                  <span>{isMetadataExpanded ? "Hide" : "Edit Details"}</span>
                  {isMetadataExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </div>
              </button>
              
              {isMetadataExpanded && (
                <div className="px-3 pb-3 pt-1.5 grid grid-cols-2 gap-3 border-t border-slate-200 dark:border-tokyo-border bg-slate-50/20 dark:bg-tokyo-input/10">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-tokyo-comment uppercase tracking-wide">Project Name</label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full bg-white dark:bg-tokyo-input border border-slate-250 dark:border-tokyo-border rounded px-2 py-1 text-xs text-slate-800 dark:text-tokyo-text outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g. Bridge Design Check"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-tokyo-comment uppercase tracking-wide">Client / Owner Name</label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full bg-white dark:bg-tokyo-input border border-slate-250 dark:border-tokyo-border rounded px-2 py-1 text-xs text-slate-800 dark:text-tokyo-text outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g. Department of Transportation"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-tokyo-comment uppercase tracking-wide">Lead Auditor</label>
                    <input
                      type="text"
                      value={leadAuditor}
                      onChange={(e) => setLeadAuditor(e.target.value)}
                      className="w-full bg-white dark:bg-tokyo-input border border-slate-250 dark:border-tokyo-border rounded px-2 py-1 text-xs text-slate-800 dark:text-tokyo-text outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g. rafiqulhaque25West"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-tokyo-comment uppercase tracking-wide">Project Code / Contract ID</label>
                    <input
                      type="text"
                      value={contractId}
                      onChange={(e) => setContractId(e.target.value)}
                      className="w-full bg-white dark:bg-tokyo-input border border-slate-250 dark:border-tokyo-border rounded px-2 py-1 text-xs text-slate-800 dark:text-tokyo-text outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g. CONTRACT-98231-X"
                    />
                  </div>
                </div>
              )}
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

      {/* Bulk Review and Fallback warning section */}
      <div className="shrink-0 pt-4 border-t border-slate-200 dark:border-tokyo-border space-y-3 mt-4">
        {!hasRequirements && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-md text-[11px] text-amber-850 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-650 dark:text-amber-400" />
            <div>
              <span className="font-semibold">Standard requirements / specs not found.</span> The check is being done based on general engineering design check principles.
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onStartBulkReview}
          disabled={!hasUploadedFile || selectedPagesCount === 0 || isLoading || isBulkReviewing}
          className="w-full bg-blue-600 dark:bg-tokyo-blue hover:bg-blue-700 dark:hover:bg-tokyo-blue/80 text-white disabled:opacity-40 font-mono py-2.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer uppercase tracking-wider shadow-sm"
        >
          <Sparkles className={`h-4 w-4 ${(isLoading || isBulkReviewing) ? 'animate-spin' : ''}`} />
          {isBulkReviewing 
            ? `Reviewing (${bulkProgress ? `${bulkProgress.current}/${bulkProgress.total}` : '...'})` 
            : `Start Review on Selected Sheets (${selectedPagesCount})`}
        </button>
      </div>
    </div>
  );
}
