-- Enable uuid-ossp if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- MIGRATION UPDATE HELPER:
-- If you already created the tables previously, run this query in Supabase to add the subject column:
-- ALTER TABLE questions ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'सामान्य';
-- CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);

-- ====================================================
-- Table 1: questions
-- ====================================================
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL DEFAULT 'सामान्य',
    topic TEXT NOT NULL,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of exactly 4 strings
    correct_option INTEGER NOT NULL, -- Index 0-3
    explanation TEXT NOT NULL,
    image_url TEXT, -- Nullable URL to Supabase Storage
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);

-- ====================================================
-- Table 2: test_history
-- ====================================================
CREATE TABLE IF NOT EXISTS test_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    test_type TEXT NOT NULL, -- "topic-wise" or "mixed"
    topics JSONB NOT NULL, -- Array of topic strings
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    question_results JSONB NOT NULL, -- Array of per-question results
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on user_id for analytics queries
CREATE INDEX IF NOT EXISTS idx_test_history_user_id ON test_history(user_id);

-- ====================================================
-- Table 3: user_insights
-- ====================================================
CREATE TABLE IF NOT EXISTS user_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,
    summary_marathi TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on user_id
CREATE INDEX IF NOT EXISTS idx_user_insights_user_id ON user_insights(user_id);

-- ====================================================
-- Row Level Security (RLS) Enablement
-- ====================================================
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_insights ENABLE ROW LEVEL SECURITY;

-- ====================================================
-- RLS Policies
-- ====================================================

-- Questions Policies
DROP POLICY IF EXISTS "Public read questions" ON questions;
CREATE POLICY "Public read questions"
    ON questions FOR SELECT
    USING (true);

-- Test History Policies
DROP POLICY IF EXISTS "Insert own test history" ON test_history;
CREATE POLICY "Insert own test history"
    ON test_history FOR INSERT
    WITH CHECK (true);

-- User Insights Policies
DROP POLICY IF EXISTS "Insert or update own insights" ON user_insights;
CREATE POLICY "Insert or update own insights"
    ON user_insights FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Update own insights" ON user_insights;
CREATE POLICY "Update own insights"
    ON user_insights FOR UPDATE
    USING (true);

-- ====================================================
-- Storage Bucket Instructions (Can be executed in Supabase console)
-- Create a public bucket called 'math-figures'
-- ====================================================
-- Note: In Supabase, you can set the bucket 'math-figures' to public.
-- The policy for authenticated/anon uploads can be configured in the Storage UI.

-- ====================================================
-- Table 4: users (Login IDs mapping to UUIDs)
-- ====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    login_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow public access to users table (insert and select)
DROP POLICY IF EXISTS "Public select users" ON users;
CREATE POLICY "Public select users" ON users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert users" ON users;
CREATE POLICY "Public insert users" ON users FOR INSERT WITH CHECK (true);

