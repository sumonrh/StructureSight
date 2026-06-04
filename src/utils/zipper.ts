import JSZip from 'jszip';
import { PdfPageImage } from '../types';
import { renderPdfPageToImage, renderPdfPageToPdfBytes } from './pdfRenderer';

export async function generateZip(pages: PdfPageImage[]): Promise<Blob> {
  const zip = new JSZip();
  
  for (const page of pages) {
    // Strip standard Scheme header (e.g. "data:image/jpeg;base64,") before adding
    const rawBase64 = page.base64.split(',')[1];
    if (rawBase64) {
      zip.file(page.name, rawBase64, { base64: true });
    }
  }

  // Generate binary output as zip blob
  const zipContent = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6, // balanced level
    },
  });

  return zipContent;
}

export async function generateZipForExport(
  file: File,
  pageNumbers: number[],
  mode: 'jpeg' | 'png' | 'pdf',
  basePages: PdfPageImage[]
): Promise<Blob> {
  const zip = new JSZip();
  const baseName = file.name.replace(/\.[^/.]+$/, "");

  for (const pageNum of pageNumbers) {
    const pageStr = String(pageNum).padStart(3, '0');
    if (mode === 'jpeg') {
      const page = basePages.find(p => p.pageNumber === pageNum);
      if (page) {
        const rawBase64 = page.base64.split(',')[1];
        if (rawBase64) {
          zip.file(`${baseName}_Page_${pageStr}.jpg`, rawBase64, { base64: true });
        }
      }
    } else if (mode === 'png') {
      const base64 = await renderPdfPageToImage(file, pageNum, 'png');
      const rawBase64 = base64.split(',')[1];
      if (rawBase64) {
        zip.file(`${baseName}_Page_${pageStr}.png`, rawBase64, { base64: true });
      }
    } else if (mode === 'pdf') {
      const pdfBytes = await renderPdfPageToPdfBytes(file, pageNum);
      zip.file(`${baseName}_Page_${pageStr}.pdf`, pdfBytes);
    }
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6,
    },
  });
}
