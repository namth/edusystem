"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type UserRole = "STUDENT" | "TEACHER" | "ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: UserRole;
  phone?: string;
  targetBand?: string;
  assignedClasses: string[];
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  login: (identifier: string, password?: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  register: (name: string, email: string, password?: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
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
  const login = async (identifier: string, password?: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Đăng nhập không thành công." };
      }

      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err: any) {
      console.error("Login exception:", err);
      return { success: false, error: err.message || "Lỗi hệ thống khi đăng nhập." };
    }
  };

  // Register via Native Backend API (/api/auth/register)
  const register = async (name: string, email: string, password?: string, phone?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, phone }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Đăng ký không thành công." };
      }

      // Auto login after registration
      await login(email, password);
      return { success: true };
    } catch (err: any) {
      console.error("Register exception:", err);
      return { success: false, error: err.message || "Lỗi hệ thống khi đăng ký." };
    }
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

  const resetPasswordForEmail = async (email: string): Promise<boolean> => {
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
