-- Forum categories (REQ-3.5.1). They live in the shared categories table with their own type, as in the ERD.
-- The posts that belong to them come with REQ-3.5.2.

ALTER TABLE categories DROP CONSTRAINT categories_type_check;
ALTER TABLE categories ADD CONSTRAINT categories_type_check CHECK (type IN ('business', 'event', 'forum'));

INSERT INTO categories (name, type) VALUES
  ('General Discussion', 'forum'),
  ('Business Recommendations', 'forum'),
  ('Event Planning', 'forum'),
  ('Cultural Exchange', 'forum'),
  ('Q&A', 'forum');
