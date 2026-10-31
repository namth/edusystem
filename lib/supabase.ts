import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL chưa được cấu hình.");
}
if (!supabaseAnonKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY chưa được cấu hình.");
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
