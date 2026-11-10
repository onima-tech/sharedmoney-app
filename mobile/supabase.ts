import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Supabase configuration from environment variables
// Expo requires the EXPO_PUBLIC_ prefix for environment variables to be accessible in the app
// Create a .env file in the mobile directory with:
// EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
// EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL' || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
  throw new Error(
    'Missing Supabase credentials!\n\n' +
    'Please create a .env file in the mobile directory with:\n' +
    'EXPO_PUBLIC_SUPABASE_URL=your_supabase_url\n' +
    'EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key\n\n' +
    'Note: The EXPO_PUBLIC_ prefix is required for Expo to expose these variables.\n' +
    'Get these values from: Supabase Dashboard > Settings > API'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true, // Re-enabled now that refresh token reuse interval is set to 300s
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
