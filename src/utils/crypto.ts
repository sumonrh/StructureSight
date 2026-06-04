// Helper to convert PEM to ArrayBuffer
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64Lines = pem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '');
  const binaryDerString = window.atob(b64Lines);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  return binaryDer.buffer;
}

// Encrypt function using browser's native Web Crypto API (RSA-OAEP-256)
export async function encryptWithPublicKey(pemText: string, plainText: string): Promise<string> {
  if (!plainText) return '';
  try {
    const der = pemToArrayBuffer(pemText);
    const cryptoKey = await window.crypto.subtle.importKey(
      "spki",
      der,
      {
        name: "RSA-OAEP",
        hash: "SHA-256"
      },
      false,
      ["encrypt"]
    );
    
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(plainText);
    
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: "RSA-OAEP"
      },
      cryptoKey,
      encodedData
    );
    
    // Convert buffer to base64
    const bytes = new Uint8Array(encryptedBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  } catch (err) {
    console.error("Web Crypto encryption error:", err);
    throw new Error("Failed to secure API key in transit.");
  }
}
