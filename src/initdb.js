const fs = require('fs');
const path = require('path');
const pool = require('./db');

(async () => {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
    try {
        await pool.query(sql);
        console.log('✅ DB 초기화 완료');
    } catch (e) {
        console.error('❌ 초기화 실패:', e.message);
    } finally {
        await pool.end();
    }
})();
