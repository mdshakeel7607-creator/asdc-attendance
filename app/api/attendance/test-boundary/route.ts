import { NextResponse } from 'next/server';
import { checkAttendanceWindow } from '@/lib/date-utils';

export async function GET() {
  // Test cases verifying that attendance is accepted at ANY time of day
  const testCases = [
    {
      label: 'Morning Session (9:00:00 AM IST)',
      iso: '2026-10-22T09:00:00+05:30',
      expectedStatus: 'OPEN',
      expectedOpen: true,
    },
    {
      label: 'Noon Session (12:30:00 PM IST)',
      iso: '2026-10-22T12:30:00+05:30',
      expectedStatus: 'OPEN',
      expectedOpen: true,
    },
    {
      label: 'Afternoon Session (3:45:00 PM IST)',
      iso: '2026-10-22T15:45:00+05:30',
      expectedStatus: 'OPEN',
      expectedOpen: true,
    },
    {
      label: 'Evening Session (8:15:00 PM IST)',
      iso: '2026-10-22T20:15:00+05:30',
      expectedStatus: 'OPEN',
      expectedOpen: true,
    },
    {
      label: 'Late Night Session (11:30:00 PM IST)',
      iso: '2026-10-22T23:30:00+05:30',
      expectedStatus: 'OPEN',
      expectedOpen: true,
    },
    {
      label: 'Early Morning Session (6:00:00 AM IST)',
      iso: '2026-10-22T06:00:00+05:30',
      expectedStatus: 'OPEN',
      expectedOpen: true,
    },
  ];

  const results = testCases.map((tc) => {
    const d = new Date(tc.iso);
    const windowResult = checkAttendanceWindow(d);
    const passed =
      windowResult.isOpen === tc.expectedOpen &&
      windowResult.status === tc.expectedStatus;

    return {
      label: tc.label,
      inputTime: tc.iso,
      evaluatedStatus: windowResult.status,
      evaluatedOpen: windowResult.isOpen,
      expectedStatus: tc.expectedStatus,
      expectedOpen: tc.expectedOpen,
      passed,
      message: windowResult.message,
    };
  });

  const allPassed = results.every((r) => r.passed);

  return NextResponse.json({
    summary: allPassed ? 'ALL 24/7 ANYTIME ATTENDANCE TESTS PASSED' : 'TESTS FAILED',
    allPassed,
    totalTests: testCases.length,
    results,
  });
}
