require('../config/env').validateEnvironment();
const { pool } = require('../config/legacyDatabase');

async function ensureRow(connection, table, idColumn, nameColumn, name, parentColumn, parentId, extra = {}) {
  const where = parentColumn ? `WHERE \`${parentColumn}\` = ? AND \`${nameColumn}\` = ?` : `WHERE \`${nameColumn}\` = ?`;
  const values = parentColumn ? [parentId, name] : [name];
  const [existing] = await connection.execute(`SELECT \`${idColumn}\` AS id FROM \`${table}\` ${where} LIMIT 1`, values);
  if (existing.length) return existing[0].id;
  const columns = [nameColumn, ...(parentColumn ? [parentColumn] : []), ...Object.keys(extra)];
  const rowValues = [name, ...(parentColumn ? [parentId] : []), ...Object.values(extra)];
  const placeholders = columns.map(() => '?').join(', ');
  const [insert] = await connection.execute(
    `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES (${placeholders})`, rowValues);
  return insert.insertId;
}

(async () => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const districtId = await ensureRow(connection, 'districts', 'district_id', 'district_name', 'Demo District');
    const sectorId = await ensureRow(connection, 'sectors', 'sector_id', 'sector_name', 'Demo Sector', 'district_id', districtId);
    const cellId = await ensureRow(connection, 'cells', 'cell_id', 'cell_name', 'Demo Cell', 'sector_id', sectorId);
    const villageId = await ensureRow(connection, 'villages', 'village_id', 'village_name', 'Demo Village', 'cell_id', cellId);
    for (const name of [
      'Cereals and grains', 'Fruits', 'Vegetables', 'Legumes',
      'Root and tuber crops', 'Livestock and animal products', 'Other agricultural products',
    ]) {
      await ensureRow(connection, 'categories', 'category_id', 'category_name', name, null, null,
        { description: 'AgriConnect marketplace category.' });
    }
    await ensureRow(connection, 'categories', 'category_id', 'category_name', 'Demo Produce', null, null,
      { description: 'Demo category for local testing; safe to remove when no longer needed.' });
    await connection.commit();
    console.log(`Demo lookup data ready: district=${districtId}, village=${villageId}, category=Demo Produce`);
  } catch (error) {
    await connection.rollback();
    console.error('Demo data setup failed:', error.code || error.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
})();
