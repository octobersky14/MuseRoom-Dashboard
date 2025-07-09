import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

// Use placeholder values for development if environment variables are not set
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

// Check if we're using placeholder values
const isUsingPlaceholders =
  supabaseUrl.includes("placeholder") ||
  supabaseAnonKey.includes("placeholder");

if (isUsingPlaceholders) {
  console.warn(
    "⚠️  Using placeholder Supabase credentials. Authentication will not work until you set up real Supabase environment variables."
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: !isUsingPlaceholders,
    persistSession: !isUsingPlaceholders,
    detectSessionInUrl: !isUsingPlaceholders,
  },
});

// Admin client for server-side operations
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
