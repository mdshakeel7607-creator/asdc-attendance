# ASDC Attendance Security Specification

## 1. Data Invariants & Zero-Trust Architecture
1. **Student PII Isolation & Self-Access**:
   - Students can ONLY read and write their own student profile (`/students/{studentUid}`) where `request.auth.uid == studentUid`.
   - Students cannot read other students' profiles or PII (phone, parents' names, email).
   - Students cannot modify their institutional `studentId` or `batchId` after creation.
   - Students cannot assign themselves administrative privileges.
2. **Attendance Integrity & Non-Tampering**:
   - Attendance documents are keyed as `/attendance/{studentUid}_{classDate}`.
   - Only the student matching `studentUid` (or an authorized admin) can write an attendance record.
   - For student writes: must have valid studentUid matching `request.auth.uid`, verified email, and match required schema.
   - Server-side time window enforcement: Attendance window is strictly 8:00 PM IST (inclusive) to 9:00 PM IST (exclusive).
   - Only authorized administrators can update attendance with an audit reason, or an audit log must be recorded.
3. **Admin Privilege Boundary**:
   - Only Google accounts in the allowlist (`mdausafmohiuddin@gmail.com`, `admin2@asdc.edu.in`) with verified email have admin access.
   - Only admins can read all student profiles, create announcements, declare holidays, or review audit logs.
4. **Announcements & Holidays**:
   - Announcements and Holidays are readable by all authenticated users (students need to see notices and holidays).
   - Only admins can create, update, or delete announcements and holidays.
5. **Atomic Counter**:
   - `/counters/student_id` is only incremented during valid student registration with valid initial sequencing.

---

## 2. The "Dirty Dozen" Threat Payloads
1. **Dirty 01: Student Privilege Escalation**
   - Non-admin student attempts to write to `/admins/{uid}` or add `role: "admin"` to their own profile.
   - *Expected*: PERMISSION_DENIED.
2. **Dirty 02: PII Scraping**
   - Authenticated student A queries `/students` to fetch student B's phone number and parents' names.
   - *Expected*: PERMISSION_DENIED.
3. **Dirty 03: Spoofed Student ID Overwrite**
   - Student attempts to update their `studentId` from `ASDC-0005` to `ASDC-0001`.
   - *Expected*: PERMISSION_DENIED (immutability rule).
4. **Dirty 04: Proxy Attendance Marking for Another Student**
   - Student A attempts to create `/attendance/studentB_2026-10-22` with `studentUid: "studentB"`.
   - *Expected*: PERMISSION_DENIED (`request.auth.uid != studentUid`).
5. **Dirty 05: Unverified Email Write Attack**
   - Attacker signs in with `email_verified == false` matching admin email string.
   - *Expected*: PERMISSION_DENIED (`request.auth.token.email_verified == true` required).
6. **Dirty 06: Student Declaring False Holiday**
   - Student writes a document to `/holidays/2026-10-23`.
   - *Expected*: PERMISSION_DENIED.
7. **Dirty 07: Student Publishing Rogue Announcement**
   - Student attempts to create `/announcements/fake-alert` claiming "Class cancelled today".
   - *Expected*: PERMISSION_DENIED.
8. **Dirty 08: Student Modifying Attendance Status**
   - Student attempts to update their own attendance record status from `ABSENT` to `PRESENT`.
   - *Expected*: PERMISSION_DENIED (only admin can update attendance status).
9. **Dirty 09: Denial of Wallet / 1MB Payload Injection**
   - Student injects a 500KB string into the `fullName` or `phoneNumber` field.
   - *Expected*: PERMISSION_DENIED (`maxLength` / `size()` violation).
10. **Dirty 10: Shadow Field Injection in Profile**
    - Student payload contains unexpected keys like `isAdmin: true` or `bypassedTime: true`.
    - *Expected*: PERMISSION_DENIED (`hasOnly()` violation).
11. **Dirty 11: Malformed Student ID Format**
    - Student attempts to set `studentId: "SUPERUSER-0001"`.
    - *Expected*: PERMISSION_DENIED (`pattern` regex match violation).
12. **Dirty 12: Anonymous User Access**
    - Unauthenticated or anonymous user attempts to read announcements or student records.
    - *Expected*: PERMISSION_DENIED.
