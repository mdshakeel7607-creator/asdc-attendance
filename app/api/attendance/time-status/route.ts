import { NextResponse } from 'next/server';
import { checkAttendanceWindow, getISTTimeInfo } from '@/lib/date-utils';

export async function GET() {
  const now = new Date();
  const windowCheck = checkAttendanceWindow(now);
  const istInfo = getISTTimeInfo(now);

  return NextResponse.json({
    serverTimeIso: now.toISOString(),
    ist: istInfo,
    window: windowCheck,
  });
}
