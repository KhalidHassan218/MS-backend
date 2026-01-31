import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv'; // Ensure dotenv is loaded if needed
dotenv.config();

// ADD 'export' HERE so we can use these in middleware
export const supabaseUrl = process.env.SUPABASE_URL;
export const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);