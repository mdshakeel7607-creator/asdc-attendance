'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { auth, db, googleProvider, testConnection, handleFirestoreError, OperationType } from './firebase';
import { isAuthorizedAdmin } from './admin-config';
import { StudentProfile } from './types';

interface AuthContextType {
  user: User | null;
  student: StudentProfile | null;
  isAdmin: boolean;
  loading: boolean;
  isRegistered: boolean;
  loginWithGoogle: () => Promise<User | null>;
  logout: () => Promise<void>;
  refreshStudentProfile: () => Promise<StudentProfile | null>;
  markAnnouncementAsRead: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  student: null,
  isAdmin: false,
  loading: true,
  isRegistered: false,
  loginWithGoogle: async () => null,
  logout: async () => {},
  refreshStudentProfile: async () => null,
  markAnnouncementAsRead: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Test Firestore connection on boot
  useEffect(() => {
    testConnection().catch((err) => {
      console.warn('Initial connection probe error:', err);
    });
  }, []);

  const fetchStudentProfile = useCallback(async (uid: string): Promise<StudentProfile | null> => {
    try {
      const studentDocRef = doc(db, 'students', uid);
      const studentSnap = await getDoc(studentDocRef);
      if (studentSnap.exists()) {
        const data = studentSnap.data() as StudentProfile;
        setStudent(data);
        return data;
      } else {
        setStudent(null);
        return null;
      }
    } catch (error) {
      console.warn('Notice: Student profile not found or permission deferred:', error);
      setStudent(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setUser(currentUser);
        if (currentUser) {
          await fetchStudentProfile(currentUser.uid);
        } else {
          setStudent(null);
        }
      } catch (err) {
        console.warn('Notice: Auth resolution error:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [fetchStudentProfile]);

  const loginWithGoogle = async (): Promise<User | null> => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await fetchStudentProfile(result.user.uid);
        return result.user;
      }
      return null;
    } catch (err) {
      console.error('Google Sign-in failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setStudent(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const refreshStudentProfile = async () => {
    if (!user) return null;
    return await fetchStudentProfile(user.uid);
  };

  const markAnnouncementAsRead = async (announcementId: string) => {
    if (!user || !student) return;
    try {
      const studentRef = doc(db, 'students', user.uid);
      await updateDoc(studentRef, {
        readAnnouncementIds: arrayUnion(announcementId),
      });
      setStudent((prev) =>
        prev
          ? {
              ...prev,
              readAnnouncementIds: Array.from(
                new Set([...(prev.readAnnouncementIds || []), announcementId])
              ),
            }
          : null
      );
    } catch (err) {
      console.error('Failed to mark announcement as read:', err);
    }
  };

  const isAdmin = isAuthorizedAdmin(user?.email);
  const isRegistered = Boolean(student && student.studentId);

  return (
    <AuthContext.Provider
      value={{
        user,
        student,
        isAdmin,
        loading,
        isRegistered,
        loginWithGoogle,
        logout,
        refreshStudentProfile,
        markAnnouncementAsRead,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
