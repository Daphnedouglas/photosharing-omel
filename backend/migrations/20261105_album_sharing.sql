-- Album sharing. The app tier stays stateless: these rows live in the
-- shared database, and photo bytes live in object storage (object_key only).

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE friendships (
  user_id TEXT NOT NULL REFERENCES users (id),
  friend_id TEXT NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

CREATE TABLE albums (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE album_members (
  album_id TEXT NOT NULL REFERENCES albums (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'contributor', 'viewer')),
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (album_id, user_id)
);

CREATE INDEX album_members_user ON album_members (user_id);

CREATE TABLE share_links (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL REFERENCES albums (id),
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('contributor', 'viewer')),
  expires_at TEXT,
  revoked_at TEXT,
  require_login INTEGER NOT NULL DEFAULT 1 CHECK (require_login IN (0, 1)),
  created_by TEXT NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  use_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX share_links_album ON share_links (album_id);

CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL REFERENCES albums (id),
  object_key TEXT NOT NULL,
  uploader_id TEXT NOT NULL REFERENCES users (id),
  taken_at TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  caption TEXT NOT NULL DEFAULT ''
);

-- Year and month filters are ranges on taken_at, for example
-- taken_at >= '2026-10-01' AND taken_at < '2026-11-01'.
CREATE INDEX photos_album_taken ON photos (album_id, taken_at);
CREATE INDEX photos_uploader ON photos (uploader_id);

CREATE TABLE photo_tags (
  photo_id TEXT NOT NULL REFERENCES photos (id),
  tag TEXT NOT NULL,
  PRIMARY KEY (photo_id, tag)
);

CREATE INDEX photo_tags_tag ON photo_tags (tag, photo_id);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  photo_id TEXT NOT NULL REFERENCES photos (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX comments_photo ON comments (photo_id, created_at);
CREATE INDEX comments_body ON comments (body);

CREATE TABLE favorites (
  user_id TEXT NOT NULL REFERENCES users (id),
  photo_id TEXT NOT NULL REFERENCES photos (id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, photo_id)
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  kind TEXT NOT NULL,
  album_id TEXT,
  actor_id TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TEXT
);

CREATE INDEX notifications_user ON notifications (user_id, created_at);

CREATE TABLE activity (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL REFERENCES albums (id),
  actor_id TEXT NOT NULL REFERENCES users (id),
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX activity_album ON activity (album_id, created_at);
