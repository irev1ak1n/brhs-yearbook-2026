/* ══════════════════════════════════════
   SHARED SUPABASE CLIENT
   The URL and anon (publishable) key below are meant to be public —
   they only grant what the Row Level Security policies allow (public
   read on content tables/buckets, write only for the authenticated
   dashboard user). No secret keys live here or anywhere in this repo.
══════════════════════════════════════ */
const BRHS_SUPABASE_URL = 'https://vbryqkibfrbpfszjjluq.supabase.co';
const BRHS_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZicnlxa2liZnJicGZzempqbHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxODE1MDYsImV4cCI6MjEwNDc1NzUwNn0.9pGoqpTiJ3vIfD42R8kA1OwpH_XvYEcdxnOjjb7gQGg';

function getSupabaseClient(){
    if(!window.__brhsSupabase){
        window.__brhsSupabase = supabase.createClient(BRHS_SUPABASE_URL, BRHS_SUPABASE_ANON_KEY);
    }
    return window.__brhsSupabase;
}

const BRHS_STORAGE_BUCKETS = {
    sport: 'sport-photos',
    happyFriday: 'happy-friday-photos',
    senior: 'senior-photos',
};
