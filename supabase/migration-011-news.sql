-- Migration 011: News feed — topics + curated stories
-- Run this in Supabase SQL Editor

-- News topics: user-configurable with RSS feeds
CREATE TABLE news_topics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL DEFAULT 'default',
  name text NOT NULL,
  keywords text[] DEFAULT '{}',
  rss_feeds jsonb DEFAULT '[]',
  active boolean DEFAULT true,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Curated stories fetched and summarized by Claude
CREATE TABLE news_stories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id uuid REFERENCES news_topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL UNIQUE,
  source_name text NOT NULL,
  summary text NOT NULL,
  topic text NOT NULL,
  published_at timestamptz,
  fetched_at timestamptz DEFAULT now(),
  relevance_score float DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS (PIN auth pattern)
ALTER TABLE news_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON news_topics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON news_stories FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_news_stories_fetched ON news_stories(fetched_at DESC);
CREATE INDEX idx_news_stories_topic ON news_stories(topic);
CREATE INDEX idx_news_topics_active ON news_topics(active);

-- Seed default topics
INSERT INTO news_topics (name, keywords, rss_feeds, position) VALUES
('AI', '{"artificial intelligence","machine learning","LLM","GPT","Claude","AI agents"}',
 '["https://techcrunch.com/category/artificial-intelligence/feed/","https://feeds.arstechnica.com/arstechnica/technology-lab","https://hnrss.org/newest?q=AI+OR+LLM+OR+GPT"]', 0),
('Automation', '{"automation","workflow","zapier","make","n8n","integration"}',
 '["https://blog.hubspot.com/rss.xml","https://hnrss.org/newest?q=automation+OR+workflow"]', 1),
('Sandler Sales', '{"sandler","sales methodology","sales training","B2B sales"}',
 '["https://www.sandler.com/blog/feed/"]', 2),
('Web Dev', '{"nextjs","react","typescript","vercel","web development","frontend"}',
 '["https://hnrss.org/newest?q=nextjs+OR+react+OR+typescript","https://vercel.com/atom"]', 3);
