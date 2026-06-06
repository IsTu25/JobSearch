import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Guard check to prevent silent configuration failures in demo environments
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '⚠️ Supabase Configuration Missing! Active authentication/sync features will not function. ' +
    'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your env configuration.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

