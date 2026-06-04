export interface PdfPageImage {
  pageNumber: number;
  base64: string; // complete data URI
  name: string; // page name (e.g., "Page_001.png")
  width: number;
  height: number;
  extractedText?: string; // extracted text from page
}

export interface PDFRequirementsFile {
  name: string;
  size: number;
  totalPages: number;
  pagesText: { pageNumber: number; text: string }[];
}

export type AiProvider = 'gemini' | 'openai' | 'anthropic' | 'grok';

export interface AiModelConfig {
  provider: AiProvider;
  modelName: string;
  customKey?: string;
}

export interface AnalysisResult {
  pageNumber: number;
  analysis: string;
  provider: AiProvider;
  modelName: string;
  timestamp: string;
}

export interface PDFDrawingFile {
  name: string;
  size: number;
  totalPages: number;
  pages: PdfPageImage[];
  originalFile?: File;
}

export interface DrawingChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  category: 'safety' | 'detailing' | 'compliance' | 'materials';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

