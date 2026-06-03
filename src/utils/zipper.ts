import JSZip from 'jszip';
import { PdfPageImage } from '../types';

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
