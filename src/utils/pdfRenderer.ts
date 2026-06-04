import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { PdfPageImage } from '../types';

// Set matching worker from CDN dynamically so Vite doesn't complain about worker bundling, or custom assets
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export async function renderPdfPagesToImages(
  file: File,
  onProgress?: (current: number, total: number) => void,
  format: 'jpeg' | 'png' = 'jpeg'
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

    // Convert canvas into specified format
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const quality = format === 'jpeg' ? 0.9 : undefined;
    const base64 = canvas.toDataURL(mimeType, quality);

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
    
    const suffix = format === 'png' ? 'png' : 'jpg';
    pageImages.push({
      pageNumber: i,
      base64,
      name: `Sheet_Page_${String(i).padStart(3, '0')}.${suffix}`,
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

export async function renderPdfPageToImage(
  file: File,
  pageNumber: number,
  format: 'jpeg' | 'png'
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);
  
  const scale = 2.0; 
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error(`Failed to compute 2D context on page rendering canvas for Page ${pageNumber}`);
  }

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const quality = format === 'jpeg' ? 0.9 : undefined;
  return canvas.toDataURL(mimeType, quality);
}

export async function renderPdfPageToPdfBytes(
  file: File,
  pageNumber: number
): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();
  const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNumber - 1]);
  newPdf.addPage(copiedPage);
  return await newPdf.save();
}
