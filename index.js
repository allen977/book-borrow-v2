import {
  countActive, borrowBook, listActiveByPhone, returnBook, listAll
} from './db.js'

const MAX_BORROW = 2
const MAX_DAYS = 14

export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    const p = url.pathname

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
    if (req.method === 'OPTIONS')
      return new Response(null, { headers: cors })

    // 借书
    if (p === '/api/borrow' && req.method === 'POST') {
      const { name, phone, book } = await req.json()
      if (!name || !phone || !book)
        return json({ error: '信息不完整' }, 400, cors)

      const active = (await listActiveByPhone(env.DB, phone)).results
      if (active.length >= MAX_BORROW) {
        return json({
          error: `每人最多借 ${MAX_BORROW} 本，你已借 ${active.length} 本，请先归还`
        }, 400, cors)
      }
      await borrowBook(env.DB, { name, phone, book })
      return json({ success: true }, 200, cors)
    }

    // 查某人借出中
    if (p === '/api/active' && req.method === 'GET') {
      const phone = url.searchParams.get('phone')
      const { results } = await listActiveByPhone(env.DB, phone)
      const list = results.map(r => withOverdue(r))
      return json({ list }, 200, cors)
    }

    // 还书
    if (p === '/api/return' && req.method === 'POST') {
      const { id } = await req.json()
      const r = await returnBook(env.DB, id)
      if (r.meta.changes === 0)
        return json({ error: '记录不存在或已还' }, 400, cors)
      return json({ success: true }, 200, cors)
    }

    // 管理员查全部
    if (p === '/api/all') {
      const pwd = url.searchParams.get('pwd')
      if (pwd !== env.ADMIN_PWD)
        return json({ error: '密码错误' }, 403, cors)
      const { results } = await listAll(env.DB)
      const list = results.map(r => withOverdue(r))
      return json({ list }, 200, cors)
    }

    // 导出 CSV
    if (p === '/api/export') {
      const pwd = url.searchParams.get('pwd')
      if (pwd !== env.ADMIN_PWD)
        return json({ error: '密码错误' }, 403, cors)

      const { results } = await listAll(env.DB)
      const csv = [
        '姓名,手机,书名,借书时间,还书时间,状态,是否超期,超期天数',
        ...results.map(r => {
          const o = calcOverdue(r)
          return `"${r.name}","${r.phone}","${r.book}","${r.borrow_time}","${r.return_time || ''}","${r.status}","${o.overdue}","${o.overdue ? o.days : 0}"`
        })
      ].join('\n')

      return new Response('\ufeff' + csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename=borrows.csv'
        }
      })
    }

    return new Response('Not Found', { status: 404, headers: cors })
  },

  // 每日 09:00 定时检测超期（需配合 triggers.crons）
  async scheduled(event, env) {
    const { results } = await env.DB.prepare(`
      SELECT * FROM borrow_records
      WHERE status='borrowed'
        AND borrow_time <= datetime('now','localtime','-14 days')
    `).all()

    if (!results.length) return

    const text = results.map(r =>
      `🚨 逾期：${r.name} ${r.phone}\n《${r.book}》\n借于 ${r.borrow_time}`
    ).join('\n\n')

    if (env.NOTIFY_URL) {
      try {
        await fetch(env.NOTIFY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msgtype: 'text',
            text: { content: '【借书系统逾期提醒】\n' + text }
          })
        })
      } catch(e) {
        console.error('推送失败', e)
      }
    }
    console.log('逾期记录数：', results.length)
  }
}

// 超期判断（基于当前时间）
function withOverdue(r) {
  if (r.status === 'returned') return { ...r, overdue: false, overdueDays: 0 }
  const borrow = new Date(r.borrow_time.replace(' ', 'T') + '+08:00')
  const days = Math.floor((Date.now() - borrow.getTime()) / 86400000)
  const overdue = days > MAX_DAYS
  return { ...r, overdue, overdueDays: overdue ? days - MAX_DAYS : 0 }
}

// 超期判断（用于后台/导出，接受记录）
function calcOverdue(r) {
  if (r.status === 'returned') return { overdue: false, days: 0 }
  const t = new Date(r.borrow_time.replace(' ', 'T') + '+08:00').getTime()
  const days = Math.floor((Date.now() - t) / 86400000)
  return { overdue: days > MAX_DAYS, days }
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors }
  })
}
