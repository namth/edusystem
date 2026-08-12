"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { runStartupSeed } from "@/lib/seed";
import { supabase } from "@/lib/supabase";

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
  updatePasswordAndProfile: (newPass: string, name?: string, phone?: string, targetBand?: string) => Promise<boolean>;
  resetPasswordForEmail: (email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to fetch full profile from public.users table
  const fetchProfile = async (authUserId: string, authEmail: string, userMetadata: any): Promise<User> => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUserId)
        .maybeSingle();

      if (data) {
        return {
          id: data.id,
          name: data.name || userMetadata?.full_name || userMetadata?.name || authEmail.split("@")[0],
          email: data.email || authEmail,
          username: data.username || data.id,
          role: (data.role as UserRole) || (userMetadata?.role as UserRole) || "STUDENT",
          phone: data.phone || userMetadata?.phone || "",
          targetBand: data.target_band || userMetadata?.target_band || "IELTS 6.5",
          assignedClasses: data.role === "TEACHER" ? ["cls_101", "cls_102"] : ["cls_101"],
          mustChangePassword: data.must_change_password === true || userMetadata?.must_change_password === true,
        };
      }
    } catch (e) {
      console.error("Error fetching profile from public.users:", e);
    }

    // Fallback profile if row not yet queried
    return {
      id: authUserId,
      name: userMetadata?.full_name || userMetadata?.name || authEmail.split("@")[0],
      email: authEmail,
      role: (userMetadata?.role as UserRole) || "STUDENT",
      phone: userMetadata?.phone || "",
      targetBand: userMetadata?.target_band || "IELTS 6.5",
      assignedClasses: ["cls_101"],
      mustChangePassword: userMetadata?.must_change_password === true,
    };
  };

  useEffect(() => {
    runStartupSeed();

    // 1. Check initial active session
    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await fetchProfile(session.user.id, session.user.email || "", session.user.user_metadata);
          setUser(profile);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    // 2. Realtime Auth State Listener across browser tabs & sessions
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id, session.user.email || "", session.user.user_metadata);
        setUser(profile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Login via Supabase Auth
  const login = async (identifier: string, password?: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      const cleanId = identifier.trim();

      // If user typed username instead of email, resolve email from public.users first
      let emailToUse = cleanId;
      if (!cleanId.includes("@")) {
        const { data: userRow } = await supabase
          .from("users")
          .select("email")
          .or(`username.eq.${cleanId},id.eq.${cleanId}`)
          .maybeSingle();

        if (userRow?.email) {
          emailToUse = userRow.email;
        } else {
          emailToUse = `${cleanId}@student.edu.vn`;
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password || "",
      });

      if (error) {
        const errorMsg = error.message || (error as any).error_description || "Email hoặc Mật khẩu không chính xác.";
        console.error("Supabase Auth Login Error:", errorMsg);
        return { success: false, error: errorMsg };
      }

      if (data.user) {
        const authenticatedUser = await fetchProfile(data.user.id, data.user.email || "", data.user.user_metadata);
        setUser(authenticatedUser);
        return { success: true, user: authenticatedUser };
      }

      return { success: false, error: "Không tìm thấy thông tin đăng nhập" };
    } catch (err: any) {
      console.error("Login exception:", err);
      return { success: false, error: err.message || "Lỗi hệ thống khi đăng nhập" };
    }
  };

  // Register public student
  const register = async (name: string, email: string, password?: string, phone?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password || "123456",
        options: {
          data: {
            full_name: name.trim(),
            phone: phone?.trim() || "",
            role: "STUDENT",
            must_change_password: false,
          },
        },
      });

      if (error) {
        console.error("Supabase Auth Register Error:", error.message);
        return { success: false, error: error.message };
      }

      if (data.user) {
        const registeredUser = await fetchProfile(data.user.id, data.user.email || "", data.user.user_metadata);
        setUser(registeredUser);
        return { success: true };
      }

      return { success: false, error: "Đăng ký không thành công" };
    } catch (err: any) {
      console.error("Register exception:", err);
      return { success: false, error: err.message || "Lỗi đăng ký tài khoản" };
    }
  };

  // First time login onboarding & password update
  const updatePasswordAndProfile = async (
    newPass: string,
    name?: string,
    phone?: string,
    targetBand?: string
  ): Promise<boolean> => {
    try {
      // 1. Update Auth password and user_metadata
      const updatePayload: any = {
        password: newPass.trim(),
        data: {
          must_change_password: false,
        },
      };

      if (name?.trim()) updatePayload.data.full_name = name.trim();
      if (phone?.trim()) updatePayload.data.phone = phone.trim();
      if (targetBand?.trim()) updatePayload.data.target_band = targetBand.trim();

      const { data: authData, error: authErr } = await supabase.auth.updateUser(updatePayload);

      if (authErr) {
        console.error("Update password auth error:", authErr.message);
        return false;
      }

      // 2. Update public.users table row
      if (user) {
        const updateDbObj: any = {
          must_change_password: false,
        };
        if (name?.trim()) updateDbObj.name = name.trim();
        if (phone?.trim()) updateDbObj.phone = phone.trim();
        if (targetBand?.trim()) updateDbObj.target_band = targetBand.trim();

        await supabase
          .from("users")
          .update(updateDbObj)
          .eq("id", user.id);

        const updatedUser: User = {
          ...user,
          name: name?.trim() || user.name,
          phone: phone?.trim() || user.phone,
          targetBand: targetBand?.trim() || user.targetBand,
          mustChangePassword: false,
        };
        setUser(updatedUser);
      }

      return true;
    } catch (e) {
      console.error("updatePasswordAndProfile error:", e);
      return false;
    }
  };

  // Reset password email trigger
  const resetPasswordForEmail = async (email: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
      });

      if (error) {
        console.error("Reset password email error:", error.message);
        return false;
      }

      return true;
    } catch (e) {
      console.error("resetPasswordForEmail exception:", e);
      return false;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("SignOut error:", e);
    } finally {
      setUser(null);
    }
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
