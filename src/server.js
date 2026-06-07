const express = require('express');
const cors    = require('cors');
const path    = require('path');
const pool    = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ──────────────────────────────────────────────
// 1. 단순 조회 (SELECT + LIKE)
// ──────────────────────────────────────────────
app.get('/api/books', async (req, res) => {
    const q = req.query.q || '';
    const sql = `
        SELECT id, title, author, isbn, total_copies, available_copies, like_count
        FROM   books
        WHERE  title  ILIKE $1 OR author ILIKE $1
        ORDER  BY id`;
    const { rows } = await pool.query(sql, [`%${q}%`]);
    res.json(rows);
});

app.get('/api/users', async (_req, res) => {
    const { rows } = await pool.query('SELECT id, name FROM users ORDER BY id');
    res.json(rows);
});

// 내 대출 현황 (JOIN)
app.get('/api/users/:id/loans', async (req, res) => {
    const sql = `
        SELECT l.id, b.title, l.loaned_at, l.due_date, l.returned_at
        FROM   loans l
        JOIN   books b ON b.id = l.book_id
        WHERE  l.user_id = $1
        ORDER  BY l.loaned_at DESC`;
    const { rows } = await pool.query(sql, [req.params.id]);
    res.json(rows);
});

// ──────────────────────────────────────────────
// 2. 좋아요  →  READ COMMITTED  (격리성 약하게)
//    - 좋아요 수는 정확히 1차이 나도 큰 문제 없음
//    - 동시성 ↑, 처리량 ↑
// ──────────────────────────────────────────────
app.post('/api/books/:id/like', async (req, res) => {
    const { user_id } = req.body;
    const book_id     = req.params.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');

        // 이미 좋아요 했는지 확인
        const dup = await client.query(
            'SELECT 1 FROM likes WHERE user_id=$1 AND book_id=$2',
            [user_id, book_id]);
        if (dup.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: '이미 좋아요한 책입니다.' });
        }

        await client.query(
            'INSERT INTO likes (user_id, book_id) VALUES ($1, $2)',
            [user_id, book_id]);
        await client.query(
            'UPDATE books SET like_count = like_count + 1 WHERE id = $1',
            [book_id]);
           

        await client.query('COMMIT');
        res.json({ ok: true, isolation: 'READ COMMITTED' });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// ──────────────────────────────────────────────
// 3. 대출  →  SERIALIZABLE  (격리성 강하게)
//    - 재고(available_copies)는 절대 음수가 되면 안 됨
//    - 동시 대출 요청 시 Lost Update / Phantom 방지
// ──────────────────────────────────────────────
app.post('/api/loans', async (req, res) => {
    const { user_id, book_id } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

        const { rows } = await client.query(
            'SELECT available_copies FROM books WHERE id = $1',
            [book_id]);
        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '책이 존재하지 않습니다.' });
        }
        if (rows[0].available_copies <= 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: '대출 가능한 재고가 없습니다.' });
        }

        await client.query(`
            INSERT INTO loans (user_id, book_id, due_date)
            VALUES ($1, $2, NOW() + INTERVAL '14 days')`,
            [user_id, book_id]);

        await client.query(
            'UPDATE books SET available_copies = available_copies - 1 WHERE id = $1',
            [book_id]);

        await client.query('COMMIT');
        res.json({ ok: true, isolation: 'SERIALIZABLE' });
    } catch (e) {
        await client.query('ROLLBACK');
        // SERIALIZABLE 충돌 시 40001 발생 → 재시도 유도
        if (e.code === '40001') {
            return res.status(409).json({ error: '동시 트랜잭션 충돌, 재시도 필요' });
        }
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// ──────────────────────────────────────────────
// 4. 반납  →  SERIALIZABLE
// ──────────────────────────────────────────────
app.post('/api/loans/:id/return', async (req, res) => {
    const loan_id = req.params.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

        const { rows } = await client.query(
            'SELECT book_id, returned_at FROM loans WHERE id = $1',
            [loan_id]);
        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '대출 기록이 없습니다.' });
        }
        if (rows[0].returned_at !== null) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: '이미 반납된 책입니다.' });
        }

        await client.query(
            'UPDATE loans SET returned_at = NOW() WHERE id = $1',
            [loan_id]);
        await client.query(
            'UPDATE books SET available_copies = available_copies + 1 WHERE id = $1',
            [rows[0].book_id]);

        await client.query('COMMIT');
        res.json({ ok: true, isolation: 'SERIALIZABLE' });
    } catch (e) {
        await client.query('ROLLBACK');
        if (e.code === '40001') {
            return res.status(409).json({ error: '동시 트랜잭션 충돌, 재시도 필요' });
        }
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
