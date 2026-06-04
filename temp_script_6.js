
        const SUPABASE_URL = 'https://nlnrdtcgbdkzfzwnsffp.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sbnJkdGNnYmRremZ6d25zZmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDUyNTcsImV4cCI6MjA5MTQyMTI1N30.T51eC1fJFc5Wn79JcA5l4m9CIYSYVhE7B7YU19CPQ00';
        const { createClient } = window.supabase;
        const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        db.auth.getSession().then(({ data }) => {
            if (!data.session) window.location.href = '/login.html';
        });

        let GLOBAL_TRM = 3714.0;
    