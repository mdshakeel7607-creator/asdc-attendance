/**
 * Firestore Security Rules Test Suite: The "Dirty Dozen" Hardened Validation
 * 
 * Verifies that the Eight Pillars of Hardened Firestore Security are upheld
 * and that all 12 malicious payloads are blocked.
 */

export interface SecurityTestCase {
  id: string;
  name: string;
  actor: 'unauthenticated' | 'unverified_student' | 'student' | 'admin';
  operation: 'create' | 'read' | 'update' | 'delete' | 'list';
  path: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED' | 'ALLOWED';
  rationale: string;
}

export const DIRTY_DOZEN_SECURITY_TESTS: SecurityTestCase[] = [
  {
    id: 'DD-01',
    name: 'Privilege Escalation via Student Profile Shadow Key',
    actor: 'student',
    operation: 'create',
    path: '/students/user_123',
    payload: {
      uid: 'user_123',
      studentId: 'ASDC-0001',
      fullName: 'Attacker Student',
      phoneNumber: '9876543210',
      fatherName: 'Father',
      motherName: 'Mother',
      email: 'student@example.com',
      batchId: 'ai-builder-mastery',
      batchName: 'AI Builder Mastery',
      role: 'admin', // ILLEGAL SHADOW FIELD
    },
    expectedResult: 'PERMISSION_DENIED',
    rationale: 'isValidStudent rejects documents containing unauthorized keys not in the allowed schema.',
  },
  {
    id: 'DD-02',
    name: 'PII Scraping via List Students',
    actor: 'student',
    operation: 'list',
    path: '/students',
    expectedResult: 'PERMISSION_DENIED',
    rationale: 'allow list on /students is restricted strictly to isAdmin(). Students cannot list all students.',
  },
  {
    id: 'DD-03',
    name: 'Student ID Mutation / Tampering',
    actor: 'student',
    operation: 'update',
    path: '/students/user_123',
    payload: {
      studentId: 'ASDC-0002', // ATTEMPTED MUTATION
    },
    expectedResult: 'PERMISSION_DENIED',
    rationale: 'studentId is immutable. Updates by student only allow phoneNumber, updatedAt, readAnnouncementIds.',
  },
  {
    id: 'DD-04',
    name: 'Proxy Attendance Marking for Different Student UID',
    actor: 'student',
    operation: 'create',
    path: '/attendance/victim_2026-10-22',
    payload: {
      studentUid: 'victim_user', // DOES NOT MATCH request.auth.uid
      studentId: 'ASDC-0002',
      studentName: 'Victim Student',
      studentEmail: 'victim@example.com',
      classDate: '2026-10-22',
      batchId: 'ai-builder-mastery',
      status: 'PRESENT',
      source: 'QR_SCAN',
    },
    expectedResult: 'PERMISSION_DENIED',
    rationale: 'Rule requires incoming().studentUid == request.auth.uid for non-admin attendance writes.',
  },
  {
    id: 'DD-05',
    name: 'Unverified Email Admin Spoofing',
    actor: 'unverified_student',
    operation: 'create',
    path: '/announcements/announcement_1',
    payload: {
      title: 'Fake Holiday Announcement',
      message: 'No classes tomorrow.',
      category: 'HOLIDAY',
      createdAt: new Date().toISOString(),
    },
    expectedResult: 'PERMISSION_DENIED',
    rationale: 'isAdmin() checks request.auth.token.email_verified == true.',
  },
  {
    id: 'DD-06',
    name: 'Unauthorized Holiday Declaration by Student',
    actor: 'student',
    operation: 'create',
    path: '/holidays/2026-10-23',
    payload: {
      date: '2026-10-23',
      title: 'Self-Declared Holiday',
    },
    expectedResult: 'PERMISSION_DENIED',
    rationale: 'Holidays write is gated strictly behind isAdmin().',
  },
  {
    id: 'DD-07',
    name: 'Student Publishing Rogue Announcement',
    actor: 'student',
    operation: 'create',
    path: '/announcements/test-announcement',
    payload: {
      title: 'Classes Postponed Indefinitely',
      message: 'All students are excused.',
      category: 'URGENT',
      createdAt: new Date().toISOString(),
    },
    expectedResult: 'PERMISSION_DENIED',
    rationale: 'Announcements write is gated strictly behind isAdmin().',
  },
  {
    id: 'DD-08',
    name: 'Student Overriding Attendance Record Status',
    actor: 'student',
    operation: 'update',
    path: '/attendance/user_123_2026-10-22',
    payload: {
      status: 'PRESENT',
    },
    expectedResult: 'PERMISSION_DENIED',
    rationale: 'Updates to attendance records are only permitted to isAdmin() with an audit log reason.',
  },
  {
    id: 'DD-09',
    name: 'Denial of Wallet Payload / Overflow String Injection',
    actor: 'student',
    operation: 'create',
    path: '/students/user_123',
    payload: {
      uid: 'user_123',
      studentId: 'ASDC-0001',
      fullName: 'A'.repeat(500), // Exceeds maxLength 100
      phoneNumber: '9876543210',
      fatherName: 'Father',
      motherName: 'Mother',
      email: 'student@example.com',
      batchId: 'ai-builder-mastery',
      batchName: 'AI Builder Mastery',
    },
    expectedResult: 'PERMISSION_DENIED',
    rationale: 'String length bounds are strictly enforced by isValidStudent.',
  },
  {
    id: 'DD-10',
    name: 'Invalid Student ID Format Bypass',
    actor: 'student',
    operation: 'create',
    path: '/students/user_123',
    payload: {
      uid: 'user_123',
      studentId: 'INVALID_ID_99', // Violates ^ASDC-[0-9]{4,}$
      fullName: 'Student Name',
      phoneNumber: '9876543210',
      fatherName: 'Father',
      motherName: 'Mother',
      email: 'student@example.com',
      batchId: 'ai-builder-mastery',
      batchName: 'AI Builder Mastery',
    },
    expectedResult: 'PERMISSION_DENIED',
    rationale: 'Regex pattern ^ASDC-[0-9]{4,}$ rejects non-conforming student IDs.',
  },
  {
    id: 'DD-11',
    name: 'Unauthenticated Access to Institute Settings',
    actor: 'unauthenticated',
    operation: 'read',
    path: '/settings/institute',
    expectedResult: 'PERMISSION_DENIED',
    rationale: 'All reads require isSignedIn().',
  },
  {
    id: 'DD-12',
    name: 'Student Modifying Audit Logs',
    actor: 'student',
    operation: 'create',
    path: '/audit_logs/fake_log',
    payload: {
      action: 'CORRECTION',
      targetStudentId: 'ASDC-0001',
    },
    expectedResult: 'PERMISSION_DENIED',
    rationale: 'Audit logs can only be read and written by isAdmin().',
  },
];
