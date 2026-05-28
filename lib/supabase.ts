import { createClient } from '@supabase/supabase-js';

// Fallback values for build-time compilation when environment variables are not populated
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key';

// Client for public access (safe to run on client side)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client for server-side operations (bypasses RLS - use only in API routes/Server Components)
export const getSupabaseServer = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
