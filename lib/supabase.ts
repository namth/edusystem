import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://owlvfznycutvkrvgbiot.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_8X7i9iuqijcB9IspKxOugA_cMOElBaK";

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
