-- Album access is the only rule for a photo that belongs to an album.
-- photos.visibility is kept only when album_id is null.

ALTER TABLE albums ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'friends'));

ALTER TABLE albums ADD COLUMN allow_comments INTEGER NOT NULL DEFAULT 1
  CHECK (allow_comments IN (0, 1));

-- album_id has to become optional, so the photos table is rebuilt.
CREATE TABLE photos_next (
  id TEXT PRIMARY KEY,
  album_id TEXT REFERENCES albums (id),
  object_key TEXT NOT NULL,
  uploader_id TEXT NOT NULL REFERENCES users (id),
  taken_at TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  caption TEXT NOT NULL DEFAULT '',
  visibility TEXT CHECK (visibility IS NULL OR visibility IN ('only_me', 'friends'))
);

INSERT INTO photos_next (id, album_id, object_key, uploader_id, taken_at, uploaded_at, caption, visibility)
SELECT id, album_id, object_key, uploader_id, taken_at, uploaded_at, caption, NULL
FROM photos;

DROP TABLE photos;
ALTER TABLE photos_next RENAME TO photos;

CREATE INDEX photos_album_taken ON photos (album_id, taken_at);
CREATE INDEX photos_uploader ON photos (uploader_id);
