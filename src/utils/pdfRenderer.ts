import * as pdfjsLib from 'pdfjs-dist';
import { PdfPageImage } from '../types';

// Set matching worker from CDN dynamically so Vite doesn't complain about worker bundling, or custom assets
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export async function renderPdfPagesToImages(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<PdfPageImage[]> {
  const arrayBuffer = await file.arrayBuffer();
  
  // Loading the PDF document representation
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pageImages: PdfPageImage[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    
    // blueprints are highly detailed, default scale is 1.5 to 2.0x for text readability
    const scale = 2.0; 
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error(`Failed to compute 2D context on page rendering canvas for Page ${i}`);
    }

    // Render PDF page into canvas context
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    // Convert canvas into JPEG format (90% compression quality for fine textual readability)
    const base64 = canvas.toDataURL('image/jpeg', 0.9);

    // Extract text from drawings page to support vision + text dual-modality
    let extractedText = '';
    try {
      const textContent = await page.getTextContent();
      extractedText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch (textErr) {
      console.warn(`Failed text extraction on sheet page ${i}`, textErr);
    }
    
    pageImages.push({
      pageNumber: i,
      base64,
      name: `Sheet_Page_${String(i).padStart(3, '0')}.jpg`,
      width: viewport.width,
      height: viewport.height,
      extractedText,
    });

    if (onProgress) {
      onProgress(i, numPages);
    }
  }

  return pageImages;
}

export async function extractPdfText(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<{ pageNumber: number; text: string }[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const extractedPages: { pageNumber: number; text: string }[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    let pageText = '';
    try {
      const textContent = await page.getTextContent();
      pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch (e) {
      console.warn(`Failed to extract requirements text for page ${i}`, e);
    }

    extractedPages.push({
      pageNumber: i,
      text: pageText,
    });

    if (onProgress) {
      onProgress(i, numPages);
    }
  }

  return extractedPages;
}
