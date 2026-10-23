'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Download,
  Printer,
  Calendar,
  Plus,
  Trash2,
  Edit,
  Shield,
  FileSpreadsheet,
  Bell,
  RefreshCw,
  LogOut,
  Sliders,
  QrCode,
  CheckCheck,
} from 'lucide-react';
import {
  getAllStudents,
  getAttendanceRecordsForDate,
  getHolidays,
  getAnnouncements,
  getAuditLogs,
  correctAttendanceRecord,
  saveHoliday,
  removeHoliday,
  createAnnouncement,
  deleteAnnouncement,
  getStudentAttendanceRecords,
} from '@/lib/attendance-service';
import {
  StudentProfile,
  AttendanceRecord,
  Holiday,
  Announcement,
  AuditLog,
  AttendanceStatus,
} from '@/lib/types';
import {
  getISTTimeInfo,
  formatDisplayDate,
  formatDisplayTimestamp,
  checkAttendanceWindow,
} from '@/lib/date-utils';
import {
  SOLE_ADMIN_EMAIL,
  INSTITUTE_CONFIG,
} from '@/lib/admin-config';
import { generateClassroomQRDataUrl } from '@/lib/qr-generator';

interface AdminDashboardProps {
  adminEmail: string;
  onLogout: () => void;
}

export function AdminDashboard({ adminEmail, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'qr' | 'holidays' | 'announcements' | 'audit' | 'settings'>('overview');

  // Core Data
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [holidays, setHolidays] = useState<Record<string, Holiday>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Date Filter for Attendance
  const todayIST = getISTTimeInfo();
  const [selectedDate, setSelectedDate] = useState<string>(todayIST.dateString);
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'NOT_RECORDED'>('ALL');

  // Modals & Actions
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<StudentProfile | null>(null);
  const [studentDetailRecords, setStudentDetailRecords] = useState<AttendanceRecord[]>([]);
  const [correctionModalStudent, setCorrectionModalStudent] = useState<StudentProfile | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<AttendanceStatus>('PRESENT');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);

  // Printable QR state - initialize origin synchronously from window
  const [currentAppOrigin] = useState<string>(() => {
    return typeof window !== 'undefined' ? window.location.origin : '';
  });
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Holiday Form
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayTitle, setHolidayTitle] = useState('');
  const [holidayReason, setHolidayReason] = useState('');
  const [holidaySubmitting, setHolidaySubmitting] = useState(false);

  // Announcement Form
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annCategory, setAnnCategory] = useState<'GENERAL' | 'HOLIDAY' | 'SCHEDULE' | 'URGENT'>('GENERAL');
  const [annSubmitting, setAnnSubmitting] = useState(false);

  // Boundary test state
  const [testResult, setTestResult] = useState<any>(null);
  const [testingBoundary, setTestingBoundary] = useState(false);

  // Live IST Clock
  const [liveIstTime, setLiveIstTime] = useState<string>('');
  const [windowStatus, setWindowStatus] = useState(checkAttendanceWindow());

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const ist = getISTTimeInfo(now);
      setLiveIstTime(`${ist.timeString} IST`);
      setWindowStatus(checkAttendanceWindow(now));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Generate QR Data URL
  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    let isMounted = true;
    generateClassroomQRDataUrl(origin)
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch(console.error);
    return () => {
      isMounted = false;
    };
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      const [stuList, holMap, annList, logList] = await Promise.all([
        getAllStudents(),
        getHolidays(),
        getAnnouncements(),
        getAuditLogs(),
      ]);
      setStudents(stuList);
      setHolidays(holMap);
      setAnnouncements(annList);
      setAuditLogs(logList);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAttendanceForSelectedDate = useCallback(async (date: string) => {
    try {
      setLoadingAttendance(true);
      const map = await getAttendanceRecordsForDate(date);
      setDailyAttendance(map);
    } catch (err) {
      console.error('Failed to load attendance for date:', err);
    } finally {
      setLoadingAttendance(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getAllStudents(),
      getHolidays(),
      getAnnouncements(),
      getAuditLogs(),
    ]).then(([stuList, holMap, annList, logList]) => {
      if (isMounted) {
        setStudents(stuList);
        setHolidays(holMap);
        setAnnouncements(annList);
        setAuditLogs(logList);
        setLoading(false);
      }
    }).catch(console.error);

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (selectedDate) {
      getAttendanceRecordsForDate(selectedDate).then((map) => {
        if (isMounted) {
          setDailyAttendance(map);
          setLoadingAttendance(false);
        }
      }).catch(console.error);
    }
    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  // Handle student detail view
  const handleOpenStudentDetail = async (stu: StudentProfile) => {
    setSelectedStudentForDetail(stu);
    try {
      const recs = await getStudentAttendanceRecords(stu.uid);
      setStudentDetailRecords(recs);
    } catch (err) {
      console.error('Failed to load student history:', err);
    }
  };

  // Check status for a student on selectedDate
  const getStudentStatusForDate = useCallback(
    (stuUid: string): {
      status: 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'NOT_RECORDED' | 'HOLIDAY';
      record?: AttendanceRecord;
    } => {
      const isHoliday = Boolean(holidays[selectedDate]);
      if (isHoliday) {
        return { status: 'HOLIDAY' };
      }

      const rec = dailyAttendance[stuUid];
      if (rec) {
        return { status: rec.status, record: rec };
      }

      const isToday = selectedDate === todayIST.dateString;
      if (isToday) {
        return { status: 'NOT_RECORDED' };
      }

      // Past date with no record
      return { status: 'ABSENT' };
    },
    [dailyAttendance, holidays, selectedDate, todayIST.dateString]
  );

  // Filter students based on search and status
  const filteredStudents = useMemo(() => {
    return students.filter((stu) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        stu.fullName.toLowerCase().includes(q) ||
        stu.studentId.toLowerCase().includes(q) ||
        stu.phoneNumber.includes(q) ||
        stu.email.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === 'ALL') return true;
      const { status } = getStudentStatusForDate(stu.uid);
      if (statusFilter === 'PRESENT') return status === 'PRESENT';
      if (statusFilter === 'ABSENT') return status === 'ABSENT';
      if (statusFilter === 'NOT_RECORDED') return status === 'NOT_RECORDED';

      return true;
    });
  }, [students, searchQuery, statusFilter, getStudentStatusForDate]);

  // Aggregate Metrics for Selected Date
  const metrics = useMemo(() => {
    let present = 0;
    let absent = 0;
    let notFinalized = 0;
    const isHoliday = Boolean(holidays[selectedDate]);

    students.forEach((stu) => {
      const { status } = getStudentStatusForDate(stu.uid);
      if (status === 'PRESENT') present++;
      else if (status === 'ABSENT') absent++;
      else if (status === 'NOT_RECORDED') notFinalized++;
    });

    return {
      totalStudents: students.length,
      present,
      absent,
      notFinalized,
      isHoliday,
    };
  }, [students, selectedDate, holidays, getStudentStatusForDate]);

  // Handle Attendance Correction Submission
  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionModalStudent) return;
    setCorrectionSubmitting(true);

    try {
      await correctAttendanceRecord({
        adminEmail,
        student: correctionModalStudent,
        classDate: selectedDate,
        newStatus: correctionStatus,
        reason: correctionReason,
      });

      await loadAttendanceForSelectedDate(selectedDate);
      const updatedLogs = await getAuditLogs();
      setAuditLogs(updatedLogs);

      setCorrectionModalStudent(null);
      setCorrectionReason('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Correction failed.');
    } finally {
      setCorrectionSubmitting(false);
    }
  };

  // Handle Holiday Add
  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !holidayTitle.trim()) return;
    setHolidaySubmitting(true);
    try {
      await saveHoliday({
        date: holidayDate,
        title: holidayTitle,
        reason: holidayReason,
        adminEmail,
      });
      const holMap = await getHolidays();
      setHolidays(holMap);
      setHolidayDate('');
      setHolidayTitle('');
      setHolidayReason('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add holiday.');
    } finally {
      setHolidaySubmitting(false);
    }
  };

  const handleRemoveHoliday = async (date: string) => {
    if (!confirm(`Are you sure you want to remove holiday for ${date}?`)) return;
    try {
      await removeHoliday(date);
      const holMap = await getHolidays();
      setHolidays(holMap);
    } catch (err) {
      alert('Failed to remove holiday');
    }
  };

  // Handle Announcement Add
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annMessage.trim()) return;
    setAnnSubmitting(true);
    try {
      await createAnnouncement({
        title: annTitle,
        message: annMessage,
        category: annCategory,
        adminEmail,
      });
      const annList = await getAnnouncements();
      setAnnouncements(annList);
      setAnnTitle('');
      setAnnMessage('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to publish announcement.');
    } finally {
      setAnnSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await deleteAnnouncement(id);
      const annList = await getAnnouncements();
      setAnnouncements(annList);
    } catch (err) {
      alert('Failed to delete announcement');
    }
  };

  // CSV Export
  const exportAttendanceCSV = () => {
    if (students.length === 0) {
      alert('No students to export.');
      return;
    }

    const headers = [
      'Student ID',
      'Full Name',
      'Email',
      'Mobile Phone',
      'Batch',
      `Status (${selectedDate})`,
      'Submission Source',
      'Timestamp (IST)',
      'Correction Reason',
    ];

    const rows = students.map((stu) => {
      const { status, record } = getStudentStatusForDate(stu.uid);
      return [
        stu.studentId,
        `"${stu.fullName.replace(/"/g, '""')}"`,
        stu.email,
        stu.phoneNumber,
        `"${stu.batchName}"`,
        status,
        record?.source || '-',
        record ? `"${formatDisplayTimestamp(record.verifiedAt)}"` : '-',
        record?.correctionReason ? `"${record.correctionReason.replace(/"/g, '""')}"` : '-',
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ASDC_Attendance_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Run Boundary Tests
  const runBoundaryTests = async () => {
    setTestingBoundary(true);
    try {
      const res = await fetch('/api/attendance/test-boundary');
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      alert('Failed to run boundary tests');
    } finally {
      setTestingBoundary(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col pb-16 selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black tracking-wider text-white shadow-sm shadow-blue-500/20">
              AS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-950 text-base tracking-tight">
                  {INSTITUTE_CONFIG.INSTITUTE_FULL_NAME}
                </span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Sole Admin Master
                </span>
              </div>
              <p className="text-xs text-slate-500">Institutional Administration & Audit</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live IST indicator */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold">{liveIstTime || 'Connecting...'}</span>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-slate-900 block truncate max-w-[200px]">
                {adminEmail}
              </span>
              <span className="text-[10px] text-blue-700 font-semibold">Sole Authorized Administrator</span>
            </div>

            <button
              onClick={onLogout}
              className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition border border-slate-200"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto border-t border-slate-200 gap-1 py-1.5 scrollbar-none text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Attendance & Students
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`px-3.5 py-2 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'qr'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            Print Classroom QR
          </button>
          <button
            onClick={() => setActiveTab('holidays')}
            className={`px-3.5 py-2 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'holidays'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Holidays & Schedule ({Object.keys(holidays).length})
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            className={`px-3.5 py-2 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'announcements'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Announcements ({announcements.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Audit Logs ({auditLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Settings & Pilot Tests
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6 flex-1">
        {/* ===================== TAB 1: OVERVIEW & ATTENDANCE ===================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Toolbar: Date Picker & Actions */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Report Date (IST):
                  </span>
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {selectedDate === todayIST.dateString && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    Today
                  </span>
                )}
                {metrics.isHoliday && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                    Holiday: {holidays[selectedDate]?.title}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    loadAllData();
                    loadAttendanceForSelectedDate(selectedDate);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border border-slate-200"
                  title="Refresh records"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
                <button
                  onClick={exportAttendanceCSV}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Export CSV (Excel)
                </button>
              </div>
            </div>

            {/* Summary Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Total Students
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                    {metrics.totalStudents}
                  </span>
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-[11px] text-slate-500 mt-2 block font-medium">
                  Enrolled in {INSTITUTE_CONFIG.DEFAULT_BATCH_NAME}
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Present on Date
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                    {metrics.present}
                  </span>
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-[11px] text-slate-500 mt-2 block font-medium">
                  {metrics.totalStudents > 0
                    ? `${Math.round((metrics.present / metrics.totalStudents) * 100)}% attendance rate`
                    : 'No students enrolled'}
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Absent on Date
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl sm:text-3xl font-extrabold text-rose-700">
                    {metrics.absent}
                  </span>
                  <XCircle className="w-5 h-5 text-rose-600" />
                </div>
                <span className="text-[11px] text-slate-500 mt-2 block font-medium">
                  {metrics.isHoliday
                    ? 'No absences on declared holidays'
                    : selectedDate === todayIST.dateString
                    ? 'Attendance open anytime today'
                    : 'Unrecorded / Past Absent'}
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Pending / Open
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl sm:text-3xl font-extrabold text-amber-600">
                    {metrics.notFinalized}
                  </span>
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <span className="text-[11px] text-slate-500 mt-2 block font-medium">
                  {selectedDate === todayIST.dateString
                    ? 'Open for scanning 24/7'
                    : 'Past dates resolved'}
                </span>
              </div>
            </div>

            {/* Students Table Section */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Filter controls */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by name, ID (ASDC-0001), phone, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-medium"
                  />
                </div>

                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-600 font-bold text-[11px] mr-1 hidden sm:inline">Status:</span>
                  {(['ALL', 'PRESENT', 'ABSENT', 'NOT_RECORDED'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
                        statusFilter === s
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {s === 'ALL'
                        ? 'All'
                        : s === 'PRESENT'
                        ? 'Present'
                        : s === 'ABSENT'
                        ? 'Absent'
                        : 'Pending'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                {loading || loadingAttendance ? (
                  <div className="p-12 text-center text-xs text-slate-600 flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>Loading student registry & attendance...</span>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-500 font-medium">
                    {students.length === 0
                      ? 'No students registered in ASDC yet. Provide the app URL to students to register.'
                      : 'No students match the current filter or search criteria.'}
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 uppercase tracking-wider font-bold text-[11px]">
                        <th className="px-4 py-3">Student ID</th>
                        <th className="px-4 py-3">Student Name</th>
                        <th className="px-4 py-3">Contact (Phone & Gmail)</th>
                        <th className="px-4 py-3">Date Status ({selectedDate})</th>
                        <th className="px-4 py-3">Source / Remark</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map((stu) => {
                        const { status, record } = getStudentStatusForDate(stu.uid);
                        return (
                          <tr key={stu.uid} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3 font-mono font-bold text-blue-700">
                              {stu.studentId}
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-950">
                              {stu.fullName}
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-medium">
                              <div>+91 {stu.phoneNumber}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{stu.email}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold text-[11px] ${
                                  status === 'PRESENT'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : status === 'HOLIDAY'
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                    : status === 'NOT_RECORDED'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : status === 'EXCUSED'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {status === 'PRESENT' ? (
                                  <CheckCircle className="w-3 h-3 text-emerald-700" />
                                ) : status === 'HOLIDAY' ? (
                                  <Calendar className="w-3 h-3 text-purple-700" />
                                ) : status === 'NOT_RECORDED' ? (
                                  <Clock className="w-3 h-3 text-amber-700" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-rose-700" />
                                )}
                                {status === 'NOT_RECORDED' ? 'Open / Pending' : status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-medium">
                              {record?.source === 'QR_SCAN' ? (
                                <span className="text-emerald-700 font-semibold">QR Scan ({formatDisplayTimestamp(record.verifiedAt).split('at')[1] || ''})</span>
                              ) : record?.correctionReason ? (
                                <span className="text-amber-800 truncate max-w-[140px] block" title={record.correctionReason}>
                                  Manual: {record.correctionReason}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenStudentDetail(stu)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded text-xs font-semibold transition"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => {
                                    setCorrectionModalStudent(stu);
                                    setCorrectionStatus(status === 'PRESENT' ? 'ABSENT' : 'PRESENT');
                                    setCorrectionReason('');
                                  }}
                                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-bold transition"
                                  title="Correct / Override Attendance"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: PRINTABLE CLASSROOM QR ===================== */}
        {activeTab === 'qr' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 mb-4 shadow-sm">
                <QrCode className="w-8 h-8" />
              </div>

              <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight">
                Official Classroom Attendance QR
              </h2>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                Print this QR code and display it inside the classroom. Students can scan it using their phone&apos;s browser at any time of day.
              </p>

              {/* Printable Card Area */}
              <div
                id="printable-asdc-qr-card"
                className="my-8 mx-auto p-8 bg-white text-slate-900 rounded-2xl shadow-xl max-w-sm border-4 border-blue-600 flex flex-col items-center"
              >
                <div className="text-center mb-4">
                  <span className="text-xs font-black uppercase tracking-widest text-blue-700 block">
                    INSTITUTE ATTENDANCE
                  </span>
                  <h3 className="text-2xl font-black text-slate-950 mt-0.5">
                    {INSTITUTE_CONFIG.INSTITUTE_NAME}
                  </h3>
                  <p className="text-xs font-bold text-slate-600">
                    {INSTITUTE_CONFIG.DEFAULT_BATCH_NAME}
                  </p>
                </div>

                {qrDataUrl ? (
                  <div className="p-3 bg-white border-2 border-slate-200 rounded-xl shadow-inner">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrDataUrl}
                      alt="ASDC Classroom Attendance QR Code"
                      className="w-56 h-56 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center bg-slate-50 rounded-xl">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                <div className="mt-4 text-center">
                  <span className="inline-block px-3 py-1 bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold rounded-lg mb-2">
                    Availability: Open Anytime 24/7
                  </span>
                  <p className="text-[11px] text-slate-500 font-mono break-all leading-tight">
                    {currentAppOrigin}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-blue-500/20 transition"
                >
                  <Printer className="w-4 h-4" />
                  Print Classroom QR Code
                </button>
                {qrDataUrl && (
                  <a
                    href={qrDataUrl}
                    download="ASDC_Classroom_Attendance_QR.png"
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 transition"
                  >
                    <Download className="w-4 h-4" />
                    Download PNG
                  </a>
                )}
              </div>

              <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs text-slate-600 space-y-1.5 font-medium">
                <p className="font-bold text-slate-900">Security & Operational Notes:</p>
                <p>• The QR code embeds your exact deployment URL and the institute batch cryptographic key.</p>
                <p>• Only registered students in &apos;AI Builder Mastery&apos; can mark attendance.</p>
                <p>• Duplicate scans by the same student on the same date will not create duplicates.</p>
                <p>• Students can scan at any time of day (morning, afternoon, evening, night).</p>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 3: HOLIDAYS & NON-CLASS DATES ===================== */}
        {activeTab === 'holidays' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Add Holiday Form */}
            <div className="md:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-950 mb-1 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                Declare Holiday / Non-Class Date
              </h3>
              <p className="text-xs text-slate-600 mb-4 font-medium">
                Students will not be marked Absent on declared holidays.
              </p>

              <form onSubmit={handleAddHoliday} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Date (YYYY-MM-DD) *
                  </label>
                  <input
                    type="date"
                    required
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Holiday Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Diwali / Republic Day"
                    value={holidayTitle}
                    onChange={(e) => setHolidayTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Reason / Details (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. National holiday, institute closed"
                    value={holidayReason}
                    onChange={(e) => setHolidayReason(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={holidaySubmitting}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {holidaySubmitting ? 'Saving...' : 'Add to Schedule'}
                </button>
              </form>
            </div>

            {/* Declared Holidays List */}
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-950 mb-3 flex items-center justify-between">
                <span>Declared Holidays & Excluded Dates</span>
                <span className="text-xs font-semibold text-slate-500">
                  {Object.keys(holidays).length} dates listed
                </span>
              </h3>

              {Object.keys(holidays).length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl font-medium">
                  No holidays declared yet. All scheduled class days will require attendance.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {Object.values(holidays)
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((hol) => (
                      <div key={hol.date} className="py-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {hol.date}
                            </span>
                            <span className="text-xs font-bold text-purple-700">
                              {hol.title}
                            </span>
                          </div>
                          {hol.reason && (
                            <p className="text-[11px] text-slate-600 mt-0.5 font-medium">{hol.reason}</p>
                          )}
                          <span className="text-[10px] text-slate-500 font-mono">
                            Added by {hol.createdBy}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveHoliday(hol.date)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                          title="Delete Holiday"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 4: ANNOUNCEMENTS ===================== */}
        {activeTab === 'announcements' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Create Announcement Form */}
            <div className="md:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-950 mb-1 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                Publish Announcement
              </h3>
              <p className="text-xs text-slate-600 mb-4 font-medium">
                In-app notification visible immediately on student dashboards.
              </p>

              <form onSubmit={handleCreateAnnouncement} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Headline Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Workshop schedule / Holiday update"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category Tag *
                  </label>
                  <select
                    value={annCategory}
                    onChange={(e) => setAnnCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="GENERAL">General Notice</option>
                    <option value="HOLIDAY">Holiday Notice</option>
                    <option value="SCHEDULE">Class Schedule Change</option>
                    <option value="URGENT">Urgent Alert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Message Body *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Details for students..."
                    value={annMessage}
                    onChange={(e) => setAnnMessage(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={annSubmitting}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {annSubmitting ? 'Publishing...' : 'Publish Announcement'}
                </button>
              </form>
            </div>

            {/* List Announcements */}
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-950 mb-3 flex items-center justify-between">
                <span>Active Announcements</span>
                <span className="text-xs font-semibold text-slate-500">
                  {announcements.length} posted
                </span>
              </h3>

              {announcements.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl font-medium">
                  No announcements published yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {announcements.map((ann) => (
                    <div key={ann.id} className="py-4 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-950">{ann.title}</h4>
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            {ann.category}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                          title="Delete announcement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                        {ann.message}
                      </p>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Published by {ann.createdBy} • {formatDisplayTimestamp(ann.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 5: AUDIT LOGS ===================== */}
        {activeTab === 'audit' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-950 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  Administrative Audit Trail
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  Every manual attendance override requires a documented reason and is permanently recorded.
                </p>
              </div>
              <span className="text-xs text-slate-600 font-mono font-bold">{auditLogs.length} entries</span>
            </div>

            <div className="overflow-x-auto">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-medium">
                  No attendance corrections have been logged yet.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 uppercase tracking-wider font-bold text-[11px]">
                      <th className="px-4 py-3">Timestamp (IST)</th>
                      <th className="px-4 py-3">Admin Email</th>
                      <th className="px-4 py-3">Student Affected</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Old Status → New Status</th>
                      <th className="px-4 py-3">Reason / Justification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {formatDisplayTimestamp(log.timestamp)}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-800 font-semibold">
                          {log.adminEmail}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-950">{log.targetStudentName}</span>
                          <span className="text-slate-500 ml-1 font-mono">({log.targetStudentId})</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-800">
                          {log.targetDate}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-400 line-through mr-1">{log.previousStatus || 'UNRECORDED'}</span>
                          <span className="font-bold text-emerald-700">→ {log.newStatus}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-800 font-medium">
                          {log.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 6: SETTINGS & PILOT TESTING ===================== */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Sole Admin Configuration Info Box */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-950 mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Sole Authorized Admin Account
              </h3>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed font-medium">
                Administrative access is strictly restricted to ONE exact Google account: <strong>{SOLE_ADMIN_EMAIL}</strong>. This restriction is enforced in frontend routing and Firestore Security Rules.
              </p>

              <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl text-xs font-mono">
                <span className="text-[10px] text-blue-900 uppercase block font-sans font-bold">
                  Sole Authorized Administrator (mdausafmohiuddin@gmail.com)
                </span>
                <span className="text-blue-900 font-black text-sm block mt-1">
                  {SOLE_ADMIN_EMAIL}
                </span>
                <span className="text-[11px] text-slate-600 font-sans block mt-1 font-medium">
                  Configured in <code className="text-blue-800 font-bold">/lib/admin-config.ts</code> &amp; <code className="text-blue-800 font-bold">firestore.rules</code>
                </span>
              </div>
            </div>

            {/* Attendance Rules Summary */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-950 mb-2 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                Attendance Policy (Anytime 24/7)
              </h3>
              <div className="space-y-2 text-xs text-slate-700 font-medium">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Institute Name</span>
                  <span className="font-bold text-slate-950">{INSTITUTE_CONFIG.INSTITUTE_NAME}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Course / Batch</span>
                  <span className="font-bold text-slate-950">{INSTITUTE_CONFIG.DEFAULT_BATCH_NAME}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Attendance Availability</span>
                  <span className="font-mono text-emerald-700 font-bold">Open Anytime (24/7 on class days)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Timezone Enforced</span>
                  <span className="font-mono text-slate-900 font-semibold">{INSTITUTE_CONFIG.TIMEZONE} (Asia/Kolkata)</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Scheduled Class Days</span>
                  <span className="text-slate-900 font-semibold">Monday through Saturday (Sunday non-class)</span>
                </div>
              </div>
            </div>

            {/* 24/7 Test Verification Runner */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                  <CheckCheck className="w-5 h-5 text-emerald-600" />
                  24/7 Anytime Attendance Test Suite
                </h3>
                <button
                  onClick={runBoundaryTests}
                  disabled={testingBoundary}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingBoundary ? 'animate-spin' : ''}`} />
                  Run Tests Now
                </button>
              </div>

              <p className="text-xs text-slate-600 mb-4 font-medium">
                Execute automated verification to confirm that QR attendance is accepted across all times of day (morning, afternoon, evening, and late night).
              </p>

              {testResult && (
                <div className="space-y-3">
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                      testResult.allPassed
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}
                  >
                    <span>{testResult.summary}</span>
                    <span>{testResult.totalTests} Scenarios Tested</span>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {testResult.results?.map((res: any, idx: number) => (
                      <div key={idx} className="p-3 bg-white flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-950">{res.label}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{res.message}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              res.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {res.passed ? 'PASS (OPEN)' : 'FAIL'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Student Detail Modal */}
      {selectedStudentForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs font-mono font-bold text-blue-700">
                  {selectedStudentForDetail.studentId}
                </span>
                <h3 className="text-lg font-bold text-slate-950">
                  {selectedStudentForDetail.fullName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedStudentForDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="my-4 space-y-2 text-xs font-medium">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Google Account</span>
                <span className="font-mono text-slate-900">{selectedStudentForDetail.email}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Mobile Phone</span>
                <span className="font-mono text-slate-900">+91 {selectedStudentForDetail.phoneNumber}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Father&apos;s Name</span>
                <span className="text-slate-900">{selectedStudentForDetail.fatherName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Mother&apos;s Name</span>
                <span className="text-slate-900">{selectedStudentForDetail.motherName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Batch Code</span>
                <span className="text-slate-900">{selectedStudentForDetail.batchName}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Registered On</span>
                <span className="font-mono text-slate-700">
                  {formatDisplayTimestamp(selectedStudentForDetail.createdAt)}
                </span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                Attendance Log Records ({studentDetailRecords.length})
              </h4>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                {studentDetailRecords.length === 0 ? (
                  <p className="text-slate-500 py-3 text-center font-medium">No attendance records yet.</p>
                ) : (
                  studentDetailRecords.map((r) => (
                    <div key={r.id} className="py-2 flex items-center justify-between font-medium">
                      <span className="font-mono text-slate-900 font-semibold">{r.classDate}</span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                          r.status === 'PRESENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {r.status}
                      </span>
                      <span className="text-slate-500 text-[11px] font-mono">
                        {r.source}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedStudentForDetail(null)}
              className="mt-6 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Attendance Correction Modal with Mandatory Audit Reason */}
      {correctionModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 relative">
            <h3 className="text-base font-bold text-slate-950 mb-1">
              Correct Attendance Record
            </h3>
            <p className="text-xs text-slate-600 mb-4 font-medium">
              Student: <strong>{correctionModalStudent.fullName}</strong> ({correctionModalStudent.studentId}) on <span className="font-mono text-blue-700 font-bold">{selectedDate}</span>
            </p>

            <form onSubmit={handleSaveCorrection} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  New Attendance Status *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['PRESENT', 'ABSENT', 'EXCUSED'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setCorrectionStatus(st)}
                      className={`py-2 rounded-lg font-bold transition text-xs ${
                        correctionStatus === st
                          ? st === 'PRESENT'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : st === 'ABSENT'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mandatory Audit Reason * (At least 5 characters)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Verified physical presence / Medical slip provided..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Logged in permanent audit trail under {adminEmail}.
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCorrectionModalStudent(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={correctionSubmitting || correctionReason.trim().length < 5}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition disabled:opacity-50 shadow-sm"
                >
                  {correctionSubmitting ? 'Logging...' : 'Apply & Audit Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
