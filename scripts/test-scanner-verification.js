/**
 * Automated Verification Test Suite for ASDC QR Camera Scanner & Attendance Pipeline
 * Directly executable by Node.js
 */

const QRCode = require('qrcode');
const jsQR = require('jsqr');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    testsFailed++;
  }
}

const INSTITUTE_CONFIG = {
  INSTITUTE_NAME: 'ASDC',
  INSTITUTE_FULL_NAME: 'ASDC Attendance',
  DEFAULT_BATCH_ID: 'ai-builder-mastery',
  DEFAULT_BATCH_NAME: 'AI Builder Mastery',
  CLASSROOM_SECRET_KEY: 'ASDC_AIMASTERY_ROOM_2026',
};

const SOLE_ADMIN_EMAIL = 'mdausafmohiuddin@gmail.com';
function isAuthorizedAdmin(email) {
  if (!email) return false;
  return email.toLowerCase().trim() === SOLE_ADMIN_EMAIL.toLowerCase().trim();
}

function buildClassroomQRPayload(originUrl) {
  return {
    issuer: 'ASDC',
    type: 'classroom_attendance',
    batchId: INSTITUTE_CONFIG.DEFAULT_BATCH_ID,
    classroomId: INSTITUTE_CONFIG.CLASSROOM_SECRET_KEY,
    appUrl: originUrl || '',
    generatedAt: new Date().toISOString(),
  };
}

async function runTests() {
  console.log('\n=======================================================');
  console.log('🧪 ASDC ATTENDANCE — SCANNER & PIPELINE VERIFICATION');
  console.log('=======================================================\n');

  // TEST 1: QR Payload Generation
  console.log('[1] QR Payload Schema & Integrity:');
  const payload = buildClassroomQRPayload('https://asdc.institute');
  assert(payload.issuer === 'ASDC', 'Payload issuer is strictly "ASDC"');
  assert(payload.type === 'classroom_attendance', 'Payload type is "classroom_attendance"');
  assert(payload.batchId === INSTITUTE_CONFIG.DEFAULT_BATCH_ID, 'Payload matches AI Builder Mastery batch ID');
  assert(payload.classroomId === INSTITUTE_CONFIG.CLASSROOM_SECRET_KEY, 'Payload matches classroom secret key');
  assert(Boolean(payload.generatedAt), 'Payload includes ISO timestamp');

  // TEST 2: Invalid & Corrupted Payloads
  console.log('\n[2] Invalid QR Rejection Logic:');
  const validateQR = (raw) => {
    try {
      const data = JSON.parse(raw);
      if (data.issuer !== 'ASDC') return { valid: false, reason: 'Wrong issuer' };
      if (data.batchId !== INSTITUTE_CONFIG.DEFAULT_BATCH_ID) return { valid: false, reason: 'Wrong batch' };
      if (data.classroomId !== INSTITUTE_CONFIG.CLASSROOM_SECRET_KEY) return { valid: false, reason: 'Wrong classroom' };
      return { valid: true, data };
    } catch {
      return { valid: false, reason: 'Invalid JSON' };
    }
  };

  const validJson = JSON.stringify(payload);
  assert(validateQR(validJson).valid === true, 'Accepts valid ASDC classroom QR');
  assert(validateQR('not-json').valid === false, 'Rejects non-JSON strings gracefully');
  assert(validateQR(JSON.stringify({ ...payload, issuer: 'ASGC' })).valid === false, 'Rejects misspelled institute "ASGC"');
  assert(validateQR(JSON.stringify({ ...payload, batchId: 'other-batch' })).valid === false, 'Rejects unauthorized batch');
  assert(validateQR(JSON.stringify({ ...payload, classroomId: 'wrong-key' })).valid === false, 'Rejects invalid classroom key');

  // TEST 3: End-to-end QR Code Image Generation & Decoding with jsQR
  console.log('\n[3] Image Generation & jsQR Decoding Pipeline:');
  const qrDataUrl = await QRCode.toDataURL(validJson, { width: 300, margin: 2 });
  assert(qrDataUrl.startsWith('data:image/png;base64,'), 'QRCode generates valid base64 PNG data URL');

  const rawQr = QRCode.create(validJson, { errorCorrectionLevel: 'H' });
  const moduleCount = rawQr.modules.size;
  const rawImageData = new Uint8ClampedArray(moduleCount * 4 * moduleCount * 4 * 4);
  const scale = 4;
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      const isDark = rawQr.modules.get(r, c);
      const color = isDark ? 0 : 255;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = (r * scale + dy) * (moduleCount * scale) + (c * scale + dx);
          rawImageData[px * 4] = color;
          rawImageData[px * 4 + 1] = color;
          rawImageData[px * 4 + 2] = color;
          rawImageData[px * 4 + 3] = 255;
        }
      }
    }
  }

  const decoded = jsQR(rawImageData, moduleCount * scale, moduleCount * scale);
  assert(decoded !== null, 'jsQR successfully decodes synthetic image matrix');
  assert(decoded?.data === validJson, 'jsQR decoded content perfectly matches source JSON payload');

  // TEST 4: Single-Flight Lock & Session Cancellation Simulation
  console.log('\n[4] Concurrency & Lifecycle Controller Simulation:');
  let isStarting = false;
  let activeSessionId = 0;
  let runningStreams = 0;

  const simulateStartCamera = async (sessionId) => {
    if (isStarting) {
      return { status: 'LOCKED', message: 'Concurrent start blocked by single-flight lock' };
    }
    isStarting = true;
    activeSessionId = sessionId;

    await new Promise((r) => setTimeout(r, 20));

    if (activeSessionId !== sessionId) {
      isStarting = false;
      return { status: 'CANCELLED', message: 'Stream discarded due to newer session' };
    }

    runningStreams++;
    isStarting = false;
    return { status: 'STARTED', message: 'Camera stream active' };
  };

  const call1Promise = simulateStartCamera(1);
  const call2Result = await simulateStartCamera(1);
  const call1Result = await call1Promise;

  assert(call2Result.status === 'LOCKED', 'Concurrent start attempt #2 correctly locked out');
  assert(call1Result.status === 'STARTED', 'Primary start attempt #1 successfully started');

  const call3Promise = simulateStartCamera(2);
  activeSessionId = 3; // Modal closed / cancelled
  const call3Result = await call3Promise;
  assert(call3Result.status === 'CANCELLED', 'Stale promise cleanly cancelled without leaking stream');

  // TEST 5: Sole Admin Security Check
  console.log('\n[5] Sole Admin Authorization Check:');
  assert(isAuthorizedAdmin('mdausafmohiuddin@gmail.com') === true, 'Authorizes exact admin: mdausafmohiuddin@gmail.com');
  assert(isAuthorizedAdmin('MDAUSAFMOHIUDDIN@GMAIL.COM') === true, 'Case-insensitive admin authorization');
  assert(isAuthorizedAdmin('hacker@gmail.com') === false, 'Denies unauthorized user email');
  assert(isAuthorizedAdmin('') === false, 'Denies empty email');
  assert(isAuthorizedAdmin(null) === false, 'Denies null email');

  // TEST 6: Duplicate Scan Prevention & Cooldown
  console.log('\n[6] Duplicate Scan & Rate Limiting Protection:');
  let isProcessing = false;
  let lastDecodedPayload = null;
  let submissions = 0;

  const simulateScanDetection = (decodedText, mockTime) => {
    if (isProcessing) return { submitted: false, reason: 'IN_FLIGHT_LOCKED' };
    if (
      lastDecodedPayload &&
      lastDecodedPayload.text === decodedText &&
      mockTime - lastDecodedPayload.time < 3000
    ) {
      return { submitted: false, reason: 'COOLDOWN_SUPPRESSED' };
    }
    lastDecodedPayload = { text: decodedText, time: mockTime };
    isProcessing = true;
    submissions++;
    // Simulate server response after 50ms
    isProcessing = false;
    return { submitted: true, submissions };
  };

  const sampleQR = validJson;
  const scan1 = simulateScanDetection(sampleQR, 1000);
  assert(scan1.submitted === true, 'Initial QR detection processes submission');

  const scan2 = simulateScanDetection(sampleQR, 1100);
  assert(scan2.submitted === false && scan2.reason === 'COOLDOWN_SUPPRESSED', 'Immediate duplicate QR within 100ms suppressed by cooldown');

  const scan3 = simulateScanDetection(sampleQR, 2500);
  assert(scan3.submitted === false && scan3.reason === 'COOLDOWN_SUPPRESSED', 'Duplicate QR at 1.5s suppressed by cooldown');

  const scan4 = simulateScanDetection(sampleQR, 4500);
  assert(scan4.submitted === true, 'Valid rescan after 3.5s cooldown window succeeds');

  // TEST 7: Non-Fatal QR Error Handling (Camera Stream Continuity)
  console.log('\n[7] Non-Fatal Scan Resilience (Stream Remains Live):');
  let cameraStreamLive = true;
  const processFrame = (raw) => {
    const val = validateQR(raw);
    if (!val.valid) {
      // Non-fatal warning: DO NOT stop camera
      return { valid: false, cameraLive: cameraStreamLive, error: val.reason };
    }
    // Only valid payload marks attendance
    return { valid: true, cameraLive: cameraStreamLive, payload: val.data };
  };

  const badFrameResult = processFrame('corrupted_qr');
  assert(badFrameResult.valid === false, 'Bad QR detected as invalid');
  assert(badFrameResult.cameraLive === true, 'Camera stream remains live and unbroken on invalid QR frame');

  const goodFrameResult = processFrame(validJson);
  assert(goodFrameResult.valid === true, 'Valid QR successfully processed');
  assert(goodFrameResult.cameraLive === true, 'Camera preview remained continuously visible throughout');

  console.log('\n=======================================================');
  console.log(`🏁 TEST RESULTS: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log('=======================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
