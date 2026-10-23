/**
 * TypeScript Data Models for ASDC Attendance
 */

export interface StudentProfile {
  uid: string;
  studentId: string; // Format: ASDC-0001
  fullName: string;
  phoneNumber: string;
  fatherName: string;
  motherName: string;
  email: string;
  batchId: string;
  batchName: string;
  createdAt: string;
  updatedAt: string;
  readAnnouncementIds?: string[];
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED';

export interface AttendanceRecord {
  id: string; // Typically `${studentUid}_${classDate}`
  studentUid: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  classDate: string; // YYYY-MM-DD in IST
  batchId: string;
  status: AttendanceStatus;
  source: 'QR_SCAN' | 'ADMIN_MANUAL';
  verifiedAt: string;
  submittedAt?: string;
  correctionReason?: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  category: 'GENERAL' | 'HOLIDAY' | 'SCHEDULE' | 'URGENT';
  batchId: string;
  createdAt: string;
  createdBy: string;
}

export interface Holiday {
  id: string; // YYYY-MM-DD
  date: string;
  title: string;
  reason?: string;
  createdAt: string;
  createdBy: string;
}

export interface AuditLog {
  id: string;
  adminEmail: string;
  action: string;
  targetStudentId: string;
  targetStudentName: string;
  targetDate: string;
  previousStatus?: string;
  newStatus: string;
  reason: string;
  timestamp: string;
}

export interface ClassroomQRPayload {
  issuer: 'ASDC';
  type: 'classroom_attendance';
  batchId: string;
  classroomId: string;
  appUrl?: string;
  generatedAt?: string;
}

export interface StudentAttendanceSummary {
  totalClassesScheduled: number;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  attendancePercentage: number;
}
