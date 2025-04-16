/**
 * 数据库迁移脚本
 * 执行 SQL 迁移文件以设置 Supabase 数据库
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// 创建 Supabase 客户端
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('错误: 环境变量未设置。请确保 .env.local 文件中包含 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 迁移文件目录
const migrationsDir = path.join(__dirname, '../migrations');

async function runMigrations() {
  try {
    // 读取迁移文件
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // 确保按文件名顺序执行

    console.log(`找到 ${files.length} 个迁移文件`);

    // 逐个执行迁移文件
    for (const file of files) {
      console.log(`执行迁移: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // 执行 SQL
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        console.error(`迁移失败 ${file}:`, error);
        process.exit(1);
      }

      console.log(`迁移成功: ${file}`);
    }

    console.log('所有迁移已成功执行');
  } catch (error) {
    console.error('迁移过程中出错:', error);
    process.exit(1);
  }
}

runMigrations(); 