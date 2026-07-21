const db = require('../src/db');

async function refundStuck() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const stuck = await client.query("SELECT * FROM withdrawals WHERE status = 'failed' AND retry_count >= 3");
    for (const w of stuck.rows) {
      await client.query('UPDATE users SET zhu_balance = zhu_balance + $1 WHERE id = $2', [w.amount, w.user_id]);
      console.log(`Refunded stuck withdrawal ${w.id} of ${w.amount} ZHU to user ${w.user_id}`);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
  } finally {
    client.release();
    process.exit();
  }
}

refundStuck();
