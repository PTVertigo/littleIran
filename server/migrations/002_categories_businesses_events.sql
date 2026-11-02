-- Categories, business listings and cultural events (Milestone 4 §2.2 data definitions and §8 ERD)

CREATE TABLE categories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('business', 'event')),
  UNIQUE (type, name),
  -- lets a listing point at (id, type), so a business can only use a business category
  UNIQUE (id, type)
);

INSERT INTO categories (name, type) VALUES
  ('Restaurant', 'business'),
  ('Retail', 'business'),
  ('Services', 'business'),
  ('Professional Services', 'business'),
  ('Entertainment', 'business'),
  ('Health & Wellness', 'business'),
  ('Festival', 'event'),
  ('Workshop', 'event'),
  ('Celebration', 'event'),
  ('Educational', 'event'),
  ('Social Gathering', 'event'),
  ('Cultural Events', 'event');

CREATE TABLE businesses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- SET NULL, not CASCADE: REQ-3.2.4 keeps submissions, with an anonymized author, when an account is deleted
  user_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
  category_id BIGINT NOT NULL,
  category_type TEXT NOT NULL DEFAULT 'business' CHECK (category_type = 'business'),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  street TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  website TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (category_id, category_type) REFERENCES categories (id, type),
  -- REQ-3.6.2 a rejection always comes with its reason
  CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL)
);

CREATE INDEX businesses_status_name_idx ON businesses (status, lower(name));
CREATE INDEX businesses_category_idx ON businesses (category_id);
CREATE INDEX businesses_user_idx ON businesses (user_id);

-- Hours of operation: open and close time for each day of the week. A day with no row is closed.
CREATE TABLE business_hours (
  business_id BIGINT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1 = Monday ... 7 = Sunday
  opens_at TIME NOT NULL,
  closes_at TIME NOT NULL,
  PRIMARY KEY (business_id, day_of_week),
  CHECK (closes_at > opens_at)
);

CREATE TABLE events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
  category_id BIGINT NOT NULL,
  category_type TEXT NOT NULL DEFAULT 'event' CHECK (category_type = 'event'),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  organizer_name TEXT NOT NULL,
  organizer_contact TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (category_id, category_type) REFERENCES categories (id, type),
  CHECK (ends_at IS NULL OR ends_at >= starts_at),
  CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL)
);

CREATE INDEX events_status_starts_idx ON events (status, starts_at);
CREATE INDEX events_category_idx ON events (category_id);
CREATE INDEX events_user_idx ON events (user_id);
