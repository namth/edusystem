"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type UserRole = "STUDENT" | "TEACHER" | "ADMIN";
export type TeacherStatus = "TRIAL" | "VERIFIED" | "REJECTED" | null;

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: UserRole;
  phone?: string;
  targetBand?: string;
  assignedClasses?: string[];
  mustChangePassword?: boolean;
  teacherStatus?: TeacherStatus;
  emailIsPlaceholder?: boolean;
}

export interface RegisterStudentPayload {
  name: string;
  gradeLevel?: string | null;
  goals?: {
    subjects?: string[];
    englishGoal?: string;
    targetScore?: string;
  } | null;
  hasEmail?: boolean;
  email?: string;
  username?: string;
  password?: string;
  phone?: string;
  classCode?: string;
  website?: string;
}

export interface RegisterStudentResult {
  success: boolean;
  user?: User;
  username?: string;
  enrolled?: { classId: string; className: string } | null;
  enrollError?: string;
  error?: string;
  field?: string;
  suggestions?: string[];
  status?: number;
  retryAfterSeconds?: number;
  networkError?: boolean;
}

export interface RegisterTeacherPayload {
  name: string;
  subjects: string[];
  levels: string[];
  workplaceType: string;
  workplaceName?: string | null;
  studentCount: string;
  needs: string[];
  source?: string | null;
  phone: string;
  email: string;
  password: string;
  website?: string;
}

export interface RegisterTeacherResult {
  success: boolean;
  user?: User;
  error?: string;
  field?: string;
  status?: number;
  retryAfterSeconds?: number;
  networkError?: boolean;
}

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  login: (identifier: string, password?: string) => Promise<{ success: boolean; user?: User; error?: string; status?: number; retryAfterSeconds?: number }>;
  register: (name: string, email: string, password?: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
  registerStudent: (payload: RegisterStudentPayload) => Promise<RegisterStudentResult>;
  registerTeacher: (payload: RegisterTeacherPayload) => Promise<RegisterTeacherResult>;
  logout: () => Promise<void>;
  updatePasswordAndProfile: (newPass: string, name?: string, phone?: string, targetBand?: string) => Promise<{ success: boolean; error?: string }>;
  resetPasswordForEmail: (email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check initial active session from Native Backend API
    async function initAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setUser(data.user);
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Native Auth init error:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    initAuth();
  }, []);

  // Login via Native Backend API (/api/auth/login)
  const login = async (
    identifier: string,
    password?: string
  ): Promise<{ success: boolean; user?: User; error?: string; status?: number; retryAfterSeconds?: number }> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const retryHeader = res.headers.get("Retry-After");
      const retryAfterSeconds = retryHeader ? Number(retryHeader) || undefined : undefined;
      const data = await res.json();

      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || "Đăng nhập không thành công.",
          status: res.status,
          retryAfterSeconds,
        };
      }

      setUser(data.user);
      return { success: true, user: data.user, status: res.status };
    } catch (err: any) {
      console.error("Login exception:", err);
      return { success: false, error: err.message || "Lỗi hệ thống khi đăng nhập." };
    }
  };

  // Đăng ký học sinh kiểu phỏng vấn (/api/auth/register)
  const registerStudent = async (payload: RegisterStudentPayload): Promise<RegisterStudentResult> => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const retryHeader = res.headers.get("Retry-After");
      const retryAfterSeconds = retryHeader ? Number(retryHeader) || undefined : undefined;
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        return {
          ...data,
          success: false,
          error: data.error || "Đăng ký không thành công.",
          status: res.status,
          retryAfterSeconds,
        };
      }

      if (data.user) {
        setUser(data.user);
      }
      return {
        ...data,
        success: true,
        status: res.status,
      };
    } catch (err: any) {
      console.error("registerStudent exception:", err);
      return {
        success: false,
        error: err.message || "Không thể kết nối máy chủ. Vui lòng thử lại.",
        networkError: true,
      };
    }
  };

  // Đăng ký giáo viên dùng thử (/api/auth/register/teacher)
  const registerTeacher = async (payload: RegisterTeacherPayload): Promise<RegisterTeacherResult> => {
    try {
      const res = await fetch("/api/auth/register/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const retryHeader = res.headers.get("Retry-After");
      const retryAfterSeconds = retryHeader ? Number(retryHeader) || undefined : undefined;
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        return {
          ...data,
          success: false,
          error: data.error || "Đăng ký giáo viên không thành công.",
          status: res.status,
          retryAfterSeconds,
        };
      }

      if (data.user) {
        setUser(data.user);
      }
      return {
        ...data,
        success: true,
        status: res.status,
      };
    } catch (err: any) {
      console.error("registerTeacher exception:", err);
      return {
        success: false,
        error: err.message || "Không thể kết nối máy chủ. Vui lòng thử lại.",
        networkError: true,
      };
    }
  };

  // Giữ hàm register cũ tương thích ngược (gọi sang registerStudent)
  const register = async (name: string, email: string, password?: string, phone?: string): Promise<{ success: boolean; error?: string }> => {
    const res = await registerStudent({
      name,
      email,
      password,
      phone,
      hasEmail: true,
    });
    return { success: res.success, error: res.error };
  };

  // Logout via Native Backend API (/api/auth/logout)
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      setUser(null);
    }
  };

  // Đổi mật khẩu lần đầu (bắt buộc) rồi lưu hồ sơ — gọi API thật, chỉ cập nhật state khi server đã lưu
  const updatePasswordAndProfile = async (
    newPass: string,
    name?: string,
    phone?: string,
    targetBand?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const passRes = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: newPass }),
      });
      const passJson = await passRes.json().catch(() => ({}));
      if (!passRes.ok || !passJson.success) {
        return { success: false, error: passJson.error || "Không đổi được mật khẩu." };
      }

      const profileRes = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, target_band: targetBand }),
      });
      const profileJson = await profileRes.json().catch(() => ({}));

      if (user) {
        setUser({
          ...user,
          ...(profileRes.ok && profileJson.success
            ? { name: name || user.name, phone: phone || user.phone, targetBand: targetBand || user.targetBand }
            : {}),
          mustChangePassword: false,
        });
      }
      if (!profileRes.ok || !profileJson.success) {
        return { success: true, error: "Đã đổi mật khẩu nhưng chưa lưu được hồ sơ: " + (profileJson.error || "") };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: "Lỗi kết nối: " + (err?.message || "") };
    }
  };

  const resetPasswordForEmail = async (_email: string): Promise<boolean> => {
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        loading,
        login,
        register,
        registerStudent,
        registerTeacher,
        logout,
        updatePasswordAndProfile,
        resetPasswordForEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
