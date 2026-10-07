CREATE TABLE IF NOT EXISTS borrow_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  book TEXT NOT NULL,
  borrow_time DATETIME NOT NULL,
  return_time DATETIME,
  status TEXT NOT NULL DEFAULT 'borrowed',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_phone ON borrow_records(phone);
CREATE INDEX IF NOT EXISTS idx_status ON borrow_records(status);
