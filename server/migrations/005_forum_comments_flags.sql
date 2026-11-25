-- Comments and replies on forum posts, and flags that report a post to the administrators (Week 8).

CREATE TABLE forum_comments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES forum_posts (id) ON DELETE CASCADE,
  -- A reply points at a comment of the same post; replies go one level deep
  parent_id BIGINT REFERENCES forum_comments (id) ON DELETE CASCADE,
  -- SET NULL, as for posts: REQ-3.2.4 keeps content with an anonymized author
  user_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX forum_comments_post_idx ON forum_comments (post_id, created_at, id);

-- One flag per member per post; flagging again changes nothing
CREATE TABLE forum_flags (
  post_id BIGINT NOT NULL REFERENCES forum_posts (id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
