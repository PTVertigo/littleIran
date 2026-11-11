-- Forum posts (Milestone 4 §2.2 Forum Post Data). REQ-3.5.2 lists the posts of a forum category.

CREATE TABLE forum_posts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- SET NULL, not CASCADE: REQ-3.2.4 keeps posts, with an anonymized author, when an account is deleted
  user_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
  category_id BIGINT NOT NULL,
  category_type TEXT NOT NULL DEFAULT 'forum' CHECK (category_type = 'forum'),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  -- approved: shown. flagged: shown, and waiting for an administrator (REQ-3.8.9). hidden: removed from public view (REQ-3.8.10).
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'flagged', 'hidden')),
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  FOREIGN KEY (category_id, category_type) REFERENCES categories (id, type)
);

CREATE INDEX forum_posts_category_created_idx ON forum_posts (category_id, created_at DESC, id DESC);
CREATE INDEX forum_posts_user_idx ON forum_posts (user_id);
