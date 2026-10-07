export async function countActive(DB, phone) {
  const r = await DB.prepare(
    `SELECT COUNT(*) as c FROM borrow_records WHERE phone = ? AND status = 'borrowed'`
  ).bind(phone).first()
  return r.c
}

export async function borrowBook(DB, { name, phone, book }) {
  await DB.prepare(`
    INSERT INTO borrow_records (name, phone, book, borrow_time, status)
    VALUES (?, ?, ?, datetime('now','localtime'), 'borrowed')
  `).bind(name, phone, book).run()
}

export async function listActiveByPhone(DB, phone) {
  return DB.prepare(`
    SELECT * FROM borrow_records
    WHERE phone = ? AND status = 'borrowed'
    ORDER BY borrow_time DESC
  `).bind(phone).all()
}

export async function returnBook(DB, id) {
  return DB.prepare(`
    UPDATE borrow_records
    SET status='returned', return_time=datetime('now','localtime')
    WHERE id = ? AND status='borrowed'
  `).bind(id).run()
}

export async function listAll(DB) {
  return DB.prepare(`
    SELECT * FROM borrow_records ORDER BY borrow_time DESC LIMIT 2000
  `).all()
}
