import QRCode from 'qrcode';
import { INSTITUTE_CONFIG } from './admin-config';
import { ClassroomQRPayload } from './types';

/**
 * Creates the official ASDC Classroom QR payload
 */
export function buildClassroomQRPayload(originUrl?: string): ClassroomQRPayload {
  return {
    issuer: 'ASDC',
    type: 'classroom_attendance',
    batchId: INSTITUTE_CONFIG.DEFAULT_BATCH_ID,
    classroomId: INSTITUTE_CONFIG.CLASSROOM_SECRET_KEY,
    appUrl: originUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generates high-resolution QR Code Data URL (PNG) for printing or display
 */
export async function generateClassroomQRDataUrl(originUrl?: string): Promise<string> {
  const payload = buildClassroomQRPayload(originUrl);
  const jsonString = JSON.stringify(payload);

  try {
    const dataUrl = await QRCode.toDataURL(jsonString, {
      width: 512,
      margin: 2,
      color: {
        dark: '#0f172a', // Navy blue
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
    return dataUrl;
  } catch (err) {
    console.error('Failed to generate QR data URL:', err);
    throw err;
  }
}
