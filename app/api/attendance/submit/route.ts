import { NextRequest, NextResponse } from 'next/server';
import { getISTTimeInfo } from '@/lib/date-utils';
import { INSTITUTE_CONFIG } from '@/lib/admin-config';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AttendanceRecord, ClassroomQRPayload } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      studentUid,
      studentId,
      studentName,
      studentEmail,
      batchId,
      rawQrContent,
    } = body;

    // 1. Basic validation
    if (!studentUid || !studentId || !studentName || !studentEmail || !rawQrContent) {
      return NextResponse.json(
        { error: 'Missing required student or QR scan payload fields.' },
        { status: 400 }
      );
    }

    // 2. Authoritative Date in Asia/Kolkata (Anytime attendance allowed)
    const evaluationTime = new Date();
    const istInfo = getISTTimeInfo(evaluationTime);
    const classDate = istInfo.dateString; // YYYY-MM-DD

    // 3. QR Payload verification
    let qrData: ClassroomQRPayload;
    try {
      qrData = typeof rawQrContent === 'string' ? JSON.parse(rawQrContent) : rawQrContent;
    } catch {
      return NextResponse.json(
        { error: 'Invalid QR code. The scanned QR is not a valid ASDC classroom code.' },
        { status: 400 }
      );
    }

    if (
      qrData.issuer !== 'ASDC' ||
      qrData.type !== 'classroom_attendance' ||
      qrData.classroomId !== INSTITUTE_CONFIG.CLASSROOM_SECRET_KEY
    ) {
      return NextResponse.json(
        { error: 'Invalid Classroom QR. Scanned QR code does not match ASDC AI Builder Mastery classroom.' },
        { status: 400 }
      );
    }

    // 4. Batch restriction check
    if (
      qrData.batchId !== INSTITUTE_CONFIG.DEFAULT_BATCH_ID ||
      batchId !== INSTITUTE_CONFIG.DEFAULT_BATCH_ID
    ) {
      return NextResponse.json(
        {
          error: `Unauthorized Batch: Only students enrolled in '${INSTITUTE_CONFIG.DEFAULT_BATCH_NAME}' may submit attendance.`,
        },
        { status: 403 }
      );
    }

    // 5. Check if date is declared a holiday
    try {
      const holidayRef = doc(db, 'holidays', classDate);
      const holidaySnap = await getDoc(holidayRef);
      if (holidaySnap.exists()) {
        const holidayData = holidaySnap.data();
        return NextResponse.json(
          {
            error: `Attendance is not active today. Date ${classDate} is declared a holiday: ${
              holidayData?.title || 'Official Holiday'
            }.`,
            isHoliday: true,
          },
          { status: 400 }
        );
      }
    } catch (err) {
      console.warn('Holiday check notice:', err);
    }

    // 6. Duplicate prevention: Exactly one valid attendance record per student per class date
    const attendanceDocId = `${studentUid}_${classDate}`;
    const attendanceRef = doc(db, 'attendance', attendanceDocId);
    const existingSnap = await getDoc(attendanceRef);

    if (existingSnap.exists()) {
      const existingRecord = existingSnap.data() as AttendanceRecord;
      return NextResponse.json({
        success: false,
        alreadyRecorded: true,
        message: `Attendance already recorded for today (${classDate}) as ${existingRecord.status}.`,
        record: existingRecord,
      });
    }

    // 7. Write verified attendance record with trusted timestamp
    const nowIso = new Date().toISOString();
    const newRecord: AttendanceRecord = {
      id: attendanceDocId,
      studentUid,
      studentId,
      studentName,
      studentEmail,
      classDate,
      batchId: INSTITUTE_CONFIG.DEFAULT_BATCH_ID,
      status: 'PRESENT',
      source: 'QR_SCAN',
      verifiedAt: nowIso,
      submittedAt: nowIso,
    };

    await setDoc(attendanceRef, newRecord);

    return NextResponse.json({
      success: true,
      alreadyRecorded: false,
      message: `Successfully marked PRESENT for ${classDate} at ${istInfo.timeString} IST.`,
      record: newRecord,
    });
  } catch (error) {
    console.error('Attendance submission error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal attendance processing error.' },
      { status: 500 }
    );
  }
}
