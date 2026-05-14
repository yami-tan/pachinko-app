import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bydbwmmsdenvcjwzxbbb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5ZGJ3bW1zZGVudmNqd3p4YmJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDIyODAsImV4cCI6MjA5NDI3ODI4MH0.zrZYDu2RicMxIrBsgFzU7LbE08fLsZXCdURefRrdJw0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
