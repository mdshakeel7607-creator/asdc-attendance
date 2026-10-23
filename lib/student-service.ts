import { doc, runTransaction } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { StudentProfile } from './types';
import { INSTITUTE_CONFIG } from './admin-config';

export interface RegisterStudentInput {
  uid: string;
  fullName: string;
  phoneNumber: string;
  fatherName: string;
  motherName: string;
  email: string;
  batchId?: string;
  batchName?: string;
}

/**
 * Registers a student with atomic sequential institutional ID assignment (e.g. ASDC-0001).
 * Uses a Firestore runTransaction to guarantee zero collisions under concurrency.
 */
export async function registerStudentWithSequentialId(
  input: RegisterStudentInput
): Promise<StudentProfile> {
  const studentRef = doc(db, 'students', input.uid);
  const counterRef = doc(db, 'counters', 'student_id');

  try {
    const result = await runTransaction(db, async (transaction) => {
      // 1. Check if student profile already exists
      const studentSnap = await transaction.get(studentRef);
      if (studentSnap.exists()) {
        return studentSnap.data() as StudentProfile;
      }

      // 2. Read counter document
      const counterSnap = await transaction.get(counterRef);
      let nextNumber = 1;

      if (counterSnap.exists()) {
        const data = counterSnap.data();
        if (typeof data.currentValue === 'number') {
          nextNumber = data.currentValue + 1;
        }
      }

      // 3. Format ID as ASDC-0001
      const studentId = `ASDC-${String(nextNumber).padStart(4, '0')}`;
      const nowIso = new Date().toISOString();

      const newStudent: StudentProfile = {
        uid: input.uid,
        studentId,
        fullName: input.fullName.trim(),
        phoneNumber: input.phoneNumber.trim(),
        fatherName: input.fatherName.trim(),
        motherName: input.motherName.trim(),
        email: input.email.toLowerCase().trim(),
        batchId: input.batchId || INSTITUTE_CONFIG.DEFAULT_BATCH_ID,
        batchName: input.batchName || INSTITUTE_CONFIG.DEFAULT_BATCH_NAME,
        createdAt: nowIso,
        updatedAt: nowIso,
        readAnnouncementIds: [],
      };

      // 4. Update counter document
      transaction.set(
        counterRef,
        {
          currentValue: nextNumber,
          lastAssignedId: studentId,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      // 5. Create student document
      transaction.set(studentRef, newStudent);

      return newStudent;
    });

    return result;
  } catch (error) {
    console.error('Registration transaction failed:', error);
    handleFirestoreError(error, OperationType.WRITE, `students/${input.uid}`);
  }
}
