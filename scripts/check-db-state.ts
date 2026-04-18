import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function checkDbState() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('=== Checking Database State ===\n');

    // Check if Teacher table exists and its structure
    const teacherCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Teacher'
      ORDER BY ordinal_position
    `);
    
    console.log('Teacher table columns:');
    console.table(teacherCheck.rows);

    // Check if Student table exists and its structure
    const studentCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Student'
      ORDER BY ordinal_position
    `);
    
    console.log('\nStudent table columns:');
    console.table(studentCheck.rows);

    // Check if legacy tables exist
    const legacyTeacherCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Teacher_Legacy'
      ORDER BY ordinal_position
    `);
    
    console.log('\nTeacher_Legacy table columns:');
    console.table(legacyTeacherCheck.rows);

    const legacyStudentCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Student_Legacy'
      ORDER BY ordinal_position
    `);
    
    console.log('\nStudent_Legacy table columns:');
    console.table(legacyStudentCheck.rows);

    // Check row counts
    const teacherCount = await pool.query('SELECT COUNT(*) FROM "Teacher"');
    const studentCount = await pool.query('SELECT COUNT(*) FROM "Student"');
    const legacyTeacherCount = await pool.query('SELECT COUNT(*) FROM "Teacher_Legacy"');
    const legacyStudentCount = await pool.query('SELECT COUNT(*) FROM "Student_Legacy"');

    console.log('\nRow counts:');
    console.log(`  Teacher: ${teacherCount.rows[0].count}`);
    console.log(`  Student: ${studentCount.rows[0].count}`);
    console.log(`  Teacher_Legacy: ${legacyTeacherCount.rows[0].count}`);
    console.log(`  Student_Legacy: ${legacyStudentCount.rows[0].count}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkDbState();
