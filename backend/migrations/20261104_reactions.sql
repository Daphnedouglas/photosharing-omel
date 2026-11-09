-- One reaction per person per photo. Existing likes become "love".

CREATE TABLE reactions (
  user_id TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('love', 'touched', 'haha', 'stunning', 'thanks')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, photo_id)
);

INSERT INTO reactions (user_id, photo_id, reaction)
SELECT user_id, photo_id, 'love' FROM likes;
