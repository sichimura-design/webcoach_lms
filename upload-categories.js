#!/usr/bin/env node

/**
 * Moodle Category Upload Script
 *
 * CSVファイルからカテゴリを読み込んでMoodleに一括作成します
 *
 * 使用方法:
 *   node upload-categories.js <csvファイル> <username> <password>
 *
 * 例:
 *   node upload-categories.js moodle-category-upload-template.csv admin adminpassword
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const readline = require('readline');

// 環境変数または引数からBFF URLを取得
const BFF_URL = process.env.BFF_URL || process.env.REACT_APP_BFF_URL || 'http://localhost:3001';

// CSV解析関数
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    throw new Error('CSVファイルが空です');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

// カテゴリデータの検証
function validateCategory(category, lineNumber) {
  const errors = [];

  if (!category.name || category.name === '') {
    errors.push(`行${lineNumber}: カテゴリ名が空です`);
  }

  if (category.parent && isNaN(parseInt(category.parent))) {
    errors.push(`行${lineNumber}: 親カテゴリIDは数値である必要があります`);
  }

  return errors;
}

// カテゴリデータの変換
function transformCategory(category) {
  return {
    name: category.name,
    parent: parseInt(category.parent) || 0,
    idnumber: category.idnumber || '',
    description: category.description || '',
    visible: category.visible === '0' ? 0 : 1
  };
}

// BFF APIにログイン
async function login(username, password) {
  try {
    console.log(`\n🔐 ログイン中... (${BFF_URL})`);

    const response = await axios.post(`${BFF_URL}/api/login`, {
      username,
      password,
      service: 'moodle_mobile_app'
    }, {
      withCredentials: true
    });

    // Cookieからセッションを取得
    const cookies = response.headers['set-cookie'];
    if (!cookies) {
      throw new Error('セッションCookieが取得できませんでした');
    }

    console.log('✅ ログイン成功\n');
    return cookies;
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('ログイン失敗: ユーザー名またはパスワードが正しくありません');
    }
    throw new Error(`ログインエラー: ${error.message}`);
  }
}

// カテゴリを作成
async function createCategories(categories, sessionCookies) {
  try {
    console.log(`📤 カテゴリを作成中... (${categories.length}件)\n`);

    const response = await axios.post(`${BFF_URL}/api/moodle/categories`, categories, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookies.join('; ')
      },
      withCredentials: true
    });

    return response.data;
  } catch (error) {
    console.error('カテゴリ作成エラー:', error.response?.data || error.message);
    throw error;
  }
}

// 既存のカテゴリを取得
async function getCategories(sessionCookies) {
  try {
    const response = await axios.get(`${BFF_URL}/api/moodle/categories`, {
      headers: {
        'Cookie': sessionCookies.join('; ')
      },
      withCredentials: true
    });

    return response.data;
  } catch (error) {
    console.error('カテゴリ取得エラー:', error.message);
    return [];
  }
}

// カテゴリをグループ化（トップレベルとサブカテゴリ）
function groupCategories(categories) {
  const topLevel = categories.filter(cat => cat.parent === 0);
  const subCategories = categories.filter(cat => cat.parent !== 0);

  return { topLevel, subCategories };
}

// メイン処理
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('使用方法: node upload-categories.js <csvファイル> <username> <password>');
    console.error('例: node upload-categories.js moodle-category-upload-template.csv admin adminpassword');
    process.exit(1);
  }

  const [csvFile, username, password] = args;

  console.log('\n=================================================');
  console.log('  Moodle カテゴリ一括アップロードツール');
  console.log('=================================================\n');

  // CSVファイルの存在確認
  if (!fs.existsSync(csvFile)) {
    console.error(`❌ エラー: CSVファイルが見つかりません: ${csvFile}`);
    process.exit(1);
  }

  try {
    // CSVファイルを読み込み
    console.log(`📂 CSVファイルを読み込み中: ${csvFile}`);
    const content = fs.readFileSync(csvFile, 'utf8');
    const rows = parseCSV(content);
    console.log(`✅ ${rows.length}件のカテゴリを検出\n`);

    // データ検証
    console.log('🔍 データを検証中...');
    let allErrors = [];
    rows.forEach((row, index) => {
      const errors = validateCategory(row, index + 2);
      allErrors = allErrors.concat(errors);
    });

    if (allErrors.length > 0) {
      console.error('\n❌ CSVファイルにエラーがあります:\n');
      allErrors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }
    console.log('✅ データ検証完了\n');

    // カテゴリデータの変換
    const categories = rows.map(transformCategory);

    // トップレベルとサブカテゴリに分類
    const { topLevel, subCategories } = groupCategories(categories);

    console.log('📊 カテゴリ構成:');
    console.log(`  - トップレベルカテゴリ: ${topLevel.length}件`);
    console.log(`  - サブカテゴリ: ${subCategories.length}件\n`);

    // 確認プロンプト
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('📝 プレビュー:\n' +
        categories.map((cat, i) => `  ${i + 1}. ${cat.name} ${cat.parent ? `(親: ${cat.parent})` : '(トップレベル)'}`).join('\n') +
        '\n\n続行しますか？ (y/n): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('\n❌ キャンセルされました');
      process.exit(0);
    }

    // ログイン
    const sessionCookies = await login(username, password);

    // 戦略: トップレベルカテゴリを先に作成
    let createdCategories = [];
    let totalCreated = 0;

    if (topLevel.length > 0) {
      console.log(`\n📤 ステップ1: トップレベルカテゴリを作成中... (${topLevel.length}件)`);
      try {
        const result = await createCategories(topLevel, sessionCookies);
        createdCategories = createdCategories.concat(result);
        totalCreated += result.length;
        console.log(`✅ ${result.length}件のトップレベルカテゴリを作成しました\n`);

        // 作成されたカテゴリIDを表示
        result.forEach(cat => {
          console.log(`  ✓ ${cat.name} (ID: ${cat.id})`);
        });
      } catch (error) {
        console.error(`\n❌ トップレベルカテゴリの作成に失敗しました`);
        console.error(`エラー詳細: ${error.response?.data?.error || error.message}`);

        if (error.response?.data?.details) {
          console.error('Moodleエラー:', JSON.stringify(error.response.data.details, null, 2));
        }

        process.exit(1);
      }
    }

    // サブカテゴリがある場合
    if (subCategories.length > 0) {
      console.log(`\n⚠️  サブカテゴリが検出されました (${subCategories.length}件)`);
      console.log('注意: サブカテゴリの親IDは、既存のカテゴリIDである必要があります。\n');

      // 既存カテゴリを取得してIDマッピングを表示
      const existingCategories = await getCategories(sessionCookies);
      if (existingCategories.length > 0) {
        console.log('📋 現在のカテゴリ一覧:');
        existingCategories.forEach(cat => {
          console.log(`  ID ${cat.id}: ${cat.name} (親: ${cat.parent || 'なし'})`);
        });
      }

      const subAnswer = await new Promise(resolve => {
        const rl2 = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        rl2.question('\nサブカテゴリを作成しますか？ (y/n): ', answer => {
          rl2.close();
          resolve(answer);
        });
      });

      if (subAnswer.toLowerCase() === 'y') {
        console.log(`\n📤 ステップ2: サブカテゴリを作成中... (${subCategories.length}件)`);
        try {
          const result = await createCategories(subCategories, sessionCookies);
          createdCategories = createdCategories.concat(result);
          totalCreated += result.length;
          console.log(`✅ ${result.length}件のサブカテゴリを作成しました\n`);

          // 作成されたカテゴリIDを表示
          result.forEach(cat => {
            console.log(`  ✓ ${cat.name} (ID: ${cat.id}, 親: ${cat.parent})`);
          });
        } catch (error) {
          console.error(`\n⚠️  サブカテゴリの作成中にエラーが発生しました`);
          console.error(`エラー詳細: ${error.response?.data?.error || error.message}`);

          if (error.response?.data?.details) {
            console.error('Moodleエラー:', JSON.stringify(error.response.data.details, null, 2));
          }

          console.log(`\n✅ ${totalCreated}件のカテゴリが作成されました（一部失敗）`);
        }
      }
    }

    // 完了メッセージ
    console.log('\n=================================================');
    console.log('  ✅ カテゴリアップロード完了！');
    console.log('=================================================\n');
    console.log(`作成されたカテゴリ: ${totalCreated}件\n`);

    if (createdCategories.length > 0) {
      console.log('📋 作成されたカテゴリID一覧:\n');
      console.log('カテゴリ名,カテゴリID,親ID');
      console.log('─────────────────────────────────');
      createdCategories.forEach(cat => {
        console.log(`${cat.name},${cat.id},${cat.parent || 0}`);
      });

      console.log('\n💡 次のステップ:');
      console.log('   1. 上記のカテゴリIDをメモしてください');
      console.log('   2. コースCSVの "category" 列を実際のIDに更新してください');
      console.log('   3. コースをアップロードしてください\n');
    }

  } catch (error) {
    console.error(`\n❌ エラーが発生しました: ${error.message}`);
    if (error.stack && process.env.DEBUG) {
      console.error('\nスタックトレース:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// 実行
if (require.main === module) {
  main().catch(error => {
    console.error('予期しないエラー:', error);
    process.exit(1);
  });
}

module.exports = { parseCSV, validateCategory, transformCategory };
