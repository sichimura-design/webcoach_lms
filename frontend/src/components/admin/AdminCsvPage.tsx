import React, { useState } from 'react';
import { DataType, UploadHistory as UploadHistoryType, UploadResult as UploadResultType } from '../../types/admin';
import { CsvUploader } from './CsvUploader';
import { UploadResult } from './UploadResult';
import { UploadHistory } from './UploadHistory';
import { bffClient } from '../../services/bffClient';
import { Button } from '../ui/button';

// ─── CSV テンプレート定義 ────────────────────────────────────────────────────

const CSV_TEMPLATES: Record<DataType, { filename: string; content: string }> = {
  'moodle-courses': {
    filename: 'template_moodle_courses.csv',
    content: [
      'id,fullname,shortname,categoryid,summary,format,visible,startdate,enddate,tag,imageUrl,updateFlag,deleteFlag',
      ',Introduction to Programming,PROG101,1,プログラミングの基礎を学ぶコースです,topics,1,2024-04-01,2025-03-31,Python,https://example.com/course.png,0,0',
    ].join('\n'),
  },
  courses: {
    filename: 'template_roadmaps.csv',
    content: [
      'roadmap_id,name,category,required_study_time,icon_url,updateFlag,deleteFlag',
      ',Webデザイン基礎,デザイン,1200,https://example.com/icons/webdesign.png,0,0',
    ].join('\n'),
  },
  enrollments: {
    filename: 'template_roadmap_steps.csv',
    content: [
      'roadmap_id,step_number,mdl_course_id,updateFlag,deleteFlag',
      '1,1,101,0,0',
      '1,2,102,0,0',
      '1,3,103,0,0',
    ].join('\n'),
  },
  categories: {
    filename: 'template_categories.csv',
    content: [
      'name,parent,idnumber,description,descriptionformat,imageUrl,updateFlag,deleteFlag',
      'プログラミング,0,CAT001,プログラミング関連のコース,1,https://example.com/category.png,0,0',
      'Python,1,CAT001-01,Pythonプログラミングコース,1,,0,0',
    ].join('\n'),
  },
  users: {
    filename: 'template_users.csv',
    content: [
      'mdl_user_id,nick_name,self_intro,target_job,ideal_work_style,monthly_goal,goal,updateFlag,deleteFlag',
      '1,山田さん,自己紹介文,エンジニア,リモート,React習得,スキルアップ,0,0',
    ].join('\n'),
  },
  'ai-applications': {
    filename: 'template_ai_applications.csv',
    content: [
      'id,name,category,description,url,icon_url,tags,updateFlag,deleteFlag',
      ',ChatGPT,生成AI,対話型AIチャットボット,https://chat.openai.com,https://example.com/chatgpt.png,"AI,チャット,自然言語処理",0,0',
      ',Midjourney,画像生成AI,テキストから画像を生成するAIツール,https://midjourney.com,,,0,0',
    ].join('\n'),
  },
  avatars: {
    filename: 'template_avatars.csv',
    content: [
      'avatar_id,url,updateFlag,deleteFlag',
      ',https://example.com/avatar1.png,0,0',
      '2,https://example.com/avatar2-new.png,1,0',
      '3,,0,1',
    ].join('\n'),
  },
  'coach-mapping': {
    filename: 'template_coach_mapping.csv',
    content: '',
  },
};

// ─── CSV カラム説明 ────────────────────────────────────────────────────────────

interface CsvColumn {
  col: string;
  required: boolean;
  desc: string;
}

const CSV_FORMAT: Record<DataType, CsvColumn[]> = {
  'moodle-courses': [
    { col: 'id',            required: false, desc: 'MoodleコースID（更新・削除時に指定、新規は空欄）' },
    { col: 'fullname',      required: true,  desc: 'コースのフルネーム' },
    { col: 'shortname',     required: true,  desc: 'コースの短縮名（URLやコード等に使用）' },
    { col: 'categoryid',    required: true,  desc: '所属カテゴリのID' },
    { col: 'summary',       required: false, desc: 'コース概要（HTML可）' },
    { col: 'format',        required: false, desc: 'コース形式（例: topics / weeks）' },
    { col: 'visible',       required: false, desc: '表示フラグ（1: 表示, 0: 非表示）' },
    { col: 'startdate',     required: false, desc: 'コース開始日（例: 2024-04-01）' },
    { col: 'enddate',       required: false, desc: 'コース終了日' },
    { col: 'tag',           required: false, desc: 'Moodleタグ名' },
    { col: 'imageUrl',      required: false, desc: 'コースサムネイル画像のURL' },
    { col: 'updateFlag',    required: false, desc: '1 の場合、既存コースを更新する' },
    { col: 'deleteFlag',    required: false, desc: '1 の場合、該当コースを削除する（id必須）' },
  ],
  courses: [
    { col: 'roadmap_id',          required: false, desc: 'ロードマップID（更新・削除時に指定、新規は空欄）' },
    { col: 'name',                required: true,  desc: 'ロードマップ名' },
    { col: 'category',            required: false, desc: 'カテゴリ名' },
    { col: 'required_study_time', required: false, desc: '必要学習時間（分）' },
    { col: 'icon_url',            required: false, desc: 'アイコン画像のURL' },
    { col: 'updateFlag',          required: false, desc: '1 の場合、既存レコードを更新する' },
    { col: 'deleteFlag',          required: false, desc: '1 の場合、該当レコードを削除する（roadmap_id必須）' },
  ],
  enrollments: [
    { col: 'roadmap_id',    required: true,  desc: 'ロードマップID' },
    { col: 'step_number',   required: true,  desc: 'ステップ番号（コース内の順番）' },
    { col: 'mdl_course_id', required: true,  desc: 'MoodleコースID' },
    { col: 'updateFlag',    required: false, desc: '1 の場合、既存レコードを更新する' },
    { col: 'deleteFlag',    required: false, desc: '1 の場合、該当レコードを削除する' },
  ],
  categories: [
    { col: 'name',              required: true,  desc: 'カテゴリ名' },
    { col: 'parent',            required: false, desc: '親カテゴリID（0 = ルート直下）' },
    { col: 'idnumber',          required: false, desc: '管理用識別子（任意の文字列）' },
    { col: 'description',       required: false, desc: 'カテゴリの説明文' },
    { col: 'descriptionformat', required: false, desc: 'テキスト形式（1 = HTML）' },
    { col: 'imageUrl',          required: false, desc: 'カテゴリ画像のURL' },
    { col: 'updateFlag',        required: false, desc: '1 の場合、既存レコードを更新する' },
    { col: 'deleteFlag',        required: false, desc: '1 の場合、該当レコードを削除する' },
  ],
  users: [
    { col: 'mdl_user_id',      required: true,  desc: 'MoodleユーザーID' },
    { col: 'nick_name',        required: false, desc: 'ニックネーム' },
    { col: 'self_intro',       required: false, desc: '自己紹介文' },
    { col: 'target_job',       required: false, desc: '目指す職種' },
    { col: 'ideal_work_style', required: false, desc: '理想の働き方' },
    { col: 'monthly_goal',     required: false, desc: '今月の目標' },
    { col: 'goal',             required: false, desc: '長期目標' },
    { col: 'updateFlag',       required: false, desc: '1 の場合、既存レコードを更新する' },
    { col: 'deleteFlag',       required: false, desc: '1 の場合、該当レコードを削除する（mdl_user_id必須）' },
  ],
  'ai-applications': [
    { col: 'id',          required: false, desc: 'AIアプリID（更新・削除時に指定、新規は空欄）' },
    { col: 'name',        required: true,  desc: 'AIアプリ名' },
    { col: 'category',    required: false, desc: 'カテゴリ名（例: 生成AI / 画像生成AI）' },
    { col: 'description', required: false, desc: 'アプリの説明文' },
    { col: 'url',         required: false, desc: 'アクセスURL' },
    { col: 'icon_url',    required: false, desc: 'アイコン画像のURL' },
    { col: 'tags',        required: false, desc: 'タグ（カンマ区切り、複数の場合はダブルクォートで囲む）' },
    { col: 'updateFlag',  required: false, desc: '1 の場合、既存レコードを更新する' },
    { col: 'deleteFlag',  required: false, desc: '1 の場合、該当レコードを削除する（id必須）' },
  ],
  avatars: [
    { col: 'avatar_id', required: false, desc: 'アバターID（更新・削除時に指定、新規は空欄）' },
    { col: 'url',       required: false, desc: 'アバター画像のURL（新規・更新時に必須）' },
    { col: 'updateFlag', required: false, desc: '1 の場合、既存レコードを更新する（avatar_id必須）' },
    { col: 'deleteFlag', required: false, desc: '1 の場合、該当レコードを削除する（avatar_id必須）' },
  ],
  'coach-mapping': [],
};

// ─── ページ設定 ───────────────────────────────────────────────────────────────

const dataTypeConfig: Record<DataType, { title: string; description: string }> = {
  'moodle-courses': {
    title: 'Moodleコース作成',
    description: 'CSVからMoodleにコースを一括作成します',
  },
  courses: {
    title: 'コース管理',
    description: '学習ロードマップの一括登録・更新を行います',
  },
  categories: {
    title: 'カテゴリ管理',
    description: 'カテゴリの一括登録・更新を行います',
  },
  enrollments: {
    title: '受講登録',
    description: 'ロードマップに紐づくコース情報の一括登録・更新を行います',
  },
  users: {
    title: 'ユーザー管理',
    description: 'ユーザープロフィール・コースアクセス履歴の一括登録・更新を行います',
  },
  'ai-applications': {
    title: 'AIアプリ登録',
    description: 'AIアプリケーションの一括登録・更新を行います',
  },
  avatars: {
    title: 'アバター登録',
    description: 'ユーザーが選択できるアバター画像の一括登録・更新・削除を行います',
  },
  'coach-mapping': {
    title: 'コーチ割り当て',
    description: 'CSVからコーチと受講生のマッピングを一括登録します',
  },
};

// ─── ユーティリティ ────────────────────────────────────────────────────────────

function toUnixTimestamp(dateStr: string): number | undefined {
  if (!dateStr) return undefined;
  const ts = Math.floor(new Date(dateStr).getTime() / 1000);
  return isNaN(ts) ? undefined : ts;
}

function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(values: unknown[]): string {
  return values.map(escapeCsvValue).join(',');
}

function downloadCsvContent(content: string, filename: string) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── コンポーネント ───────────────────────────────────────────────────────────

interface AdminCsvPageProps {
  dataType: DataType;
}

const DOWNLOADABLE_ALL_TYPES: DataType[] = ['moodle-courses', 'courses', 'categories', 'ai-applications', 'avatars'];

export const AdminCsvPage: React.FC<AdminCsvPageProps> = ({ dataType }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResultType | null>(null);
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryType[]>([]);

  const config = dataTypeConfig[dataType];

  const handleDownloadTemplate = () => {
    const t = CSV_TEMPLATES[dataType];
    downloadCsvContent(t.content, t.filename);
  };

  const handleDownloadAll = async () => {
    setIsDownloadingAll(true);
    const today = new Date().toISOString().split('T')[0];
    try {
      if (dataType === 'moodle-courses') {
        const courses = await bffClient.getCourses();
        const header = 'id,fullname,shortname,categoryid,summary,format,visible,startdate,enddate,tag,imageUrl,updateFlag,deleteFlag';
        const rows = courses.map((c: any) => toCsvRow([
          c.id ?? '', c.fullname ?? '', c.shortname ?? '',
          c.categoryid ?? c.category?.id ?? '', c.summary ?? '', c.format ?? '', c.visible ?? '',
          c.startdate ? new Date(c.startdate * 1000).toISOString().split('T')[0] : '',
          c.enddate ? new Date(c.enddate * 1000).toISOString().split('T')[0] : '',
          c.tag ?? '', c.imageUrl ?? '', 0, 0,
        ]));
        downloadCsvContent([header, ...rows].join('\n'), `all_moodle_courses_${today}.csv`);
      } else if (dataType === 'courses') {
        const roadmaps = await bffClient.getRoadmaps();
        const header = 'roadmap_id,name,category,required_study_time,icon_url,updateFlag,deleteFlag';
        const rows = roadmaps.map((r: any) => toCsvRow([
          r.id ?? '', r.name ?? r.title ?? '', r.category ?? '',
          r.required_study_time ?? '', r.icon_url ?? '', 0, 0,
        ]));
        downloadCsvContent([header, ...rows].join('\n'), `all_roadmaps_${today}.csv`);
      } else if (dataType === 'categories') {
        const categories = await bffClient.getCategories();
        const header = 'id,name,parent,idnumber,description,descriptionformat,imageUrl,updateFlag,deleteFlag';
        const rows = categories.map((c: any) => toCsvRow([
          c.id ?? '', c.name ?? '', c.parent ?? 0, c.idnumber ?? '',
          c.description ?? '', c.descriptionformat ?? 1,
          c.categoryimage ?? '', 0, 0,
        ]));
        downloadCsvContent([header, ...rows].join('\n'), `all_categories_${today}.csv`);
      } else if (dataType === 'ai-applications') {
        const apps = await bffClient.getAIApplications();
        const header = 'id,name,category,description,url,icon_url,tags,updateFlag,deleteFlag';
        const rows = apps.map((a: any) => toCsvRow([
          a.id ?? '', a.name ?? '', a.category ?? '', a.description ?? '',
          a.url ?? '', a.icon_url ?? '', a.tags ?? '', 0, 0,
        ]));
        downloadCsvContent([header, ...rows].join('\n'), `all_ai_applications_${today}.csv`);
      } else if (dataType === 'avatars') {
        const avatars = await bffClient.getAvatars();
        const header = 'avatar_id,url,updateFlag,deleteFlag';
        const rows = avatars.map((a) => toCsvRow([a.avatar_id, a.url, 0, 0]));
        downloadCsvContent([header, ...rows].join('\n'), `all_avatars_${today}.csv`);
      }
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadResult(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length === 0) throw new Error('CSVファイルが空です');

      const headers = lines[0].split(',').map(h => h.trim());
      const records = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const record: Record<string, string> = {};
        headers.forEach((header, index) => { record[header] = values[index] || ''; });
        records.push(record);
      }

      // updateFlag と deleteFlag の両方が 1 の行をチェック
      const conflictRows = records
        .map((r, i) => ({ row: i + 2, updateFlag: r.updateFlag, deleteFlag: r.deleteFlag }))
        .filter(r => r.updateFlag === '1' && r.deleteFlag === '1');
      if (conflictRows.length > 0) {
        const rowNums = conflictRows.map(r => `行${r.row}`).join('、');
        throw new Error(`updateFlag と deleteFlag の両方が 1 になっている行があります（${rowNums}）。どちらか一方のみ 1 にしてください。`);
      }

      let result: any;
      if (dataType === 'moodle-courses') {
        const courses = records.map((r) => {
          const course: Record<string, any> = {
            fullname: r.fullname, shortname: r.shortname, categoryid: parseInt(r.categoryid, 10),
          };
          if (r.id !== undefined && r.id !== '') course.id = parseInt(r.id, 10);
          if (r.summary)  course.summary = r.summary;
          if (r.format)   course.format = r.format;
          if (r.visible !== undefined && r.visible !== '') course.visible = parseInt(r.visible, 10);
          const start = toUnixTimestamp(r.startdate);
          if (start) course.startdate = start;
          const end = toUnixTimestamp(r.enddate);
          if (end) course.enddate = end;
          if (r.tag)      course.tag = r.tag;
          if (r.imageUrl) course.imageUrl = r.imageUrl;
          if (r.updateFlag !== undefined && r.updateFlag !== '') course.updateFlag = parseInt(r.updateFlag, 10);
          if (r.deleteFlag !== undefined && r.deleteFlag !== '') course.deleteFlag = parseInt(r.deleteFlag, 10);
          return course;
        });
        result = await bffClient.createCourse(courses);
      } else if (dataType === 'categories') {
        const categories = records.map((r) => {
          const cat: Record<string, any> = { name: r.name };
          if (r.id !== undefined && r.id !== '') cat.id = parseInt(r.id, 10);
          if (r.parent !== undefined && r.parent !== '') cat.parent = parseInt(r.parent, 10);
          if (r.idnumber)    cat.idnumber = r.idnumber;
          if (r.description) cat.description = r.description;
          if (r.descriptionformat !== undefined && r.descriptionformat !== '') cat.descriptionformat = parseInt(r.descriptionformat, 10);
          if (r.imageUrl) cat.imageUrl = r.imageUrl;
          if (r.updateFlag !== undefined && r.updateFlag !== '') cat.updateFlag = parseInt(r.updateFlag, 10);
          if (r.deleteFlag !== undefined && r.deleteFlag !== '') cat.deleteFlag = parseInt(r.deleteFlag, 10);
          return cat;
        });
        result = await bffClient.createCategories(categories);
      } else if (dataType === 'avatars') {
        const avatars = records.map((r) => {
          const item: Record<string, any> = {};
          if (r.avatar_id !== undefined && r.avatar_id !== '') item.avatar_id = parseInt(r.avatar_id, 10);
          if (r.url) item.url = r.url;
          if (r.updateFlag !== undefined && r.updateFlag !== '') item.updateFlag = parseInt(r.updateFlag, 10) === 1;
          if (r.deleteFlag !== undefined && r.deleteFlag !== '') item.deleteFlag = parseInt(r.deleteFlag, 10) === 1;
          return item;
        });
        result = await bffClient.upsertAvatars(avatars);
      } else {
        const apiDataType = dataType.replace(/-/g, '_');
        result = await bffClient.updateDatabase({ data_type: apiDataType, records });
      }

      const processedCount = (result.created ?? 0) + (result.updated ?? 0) + (result.deleted ?? 0);
      const failedCount = (result.errors?.length ?? 0) > 0
        ? result.errors.length
        : records.length - processedCount;
      const newResult: UploadResultType = (dataType === 'moodle-courses' || dataType === 'categories' || dataType === 'avatars')
        ? {
            success: result.success,
            recordsProcessed: processedCount,
            recordsFailed: Math.max(0, failedCount),
            message: result.success
              ? `作成:${result.created ?? 0}件 / 更新:${result.updated ?? 0}件 / 削除:${result.deleted ?? 0}件`
              : dataType === 'categories' ? 'カテゴリの処理に失敗しました'
              : dataType === 'avatars' ? 'アバターの処理に失敗しました'
              : 'コースの処理に失敗しました',
          }
        : {
            success: result.success,
            recordsProcessed: result.recordsProcessed,
            recordsFailed: result.recordsFailed,
            message: result.message,
            errors: result.errors?.map((e: any) => ({ row: e.row, message: e.message })),
          };

      setUploadResult(newResult);
      setUploadHistory(prev => [{
        id: Date.now().toString(),
        dataType,
        filename: file.name,
        uploadedAt: new Date(),
        status: newResult.success ? 'success' : 'failed',
        recordsProcessed: newResult.recordsProcessed,
        recordsFailed: newResult.recordsFailed,
        errorMessage: newResult.success ? undefined : newResult.message,
      }, ...prev]);
    } catch (error) {
      setUploadResult({
        success: false,
        recordsProcessed: 0,
        recordsFailed: 0,
        message: error instanceof Error ? error.message : 'アップロード中にエラーが発生しました',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2 text-brand-text">{config.title}</h1>
        <p className="text-sm text-brand-muted">{config.description}</p>
      </div>

      <div
        className="rounded-3xl p-6 sm:p-8"
        style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        {/* CSVフォーマット解説 */}
        <div className="mb-6 p-4 rounded-xl bg-brand-bg" style={{ border: '1px solid #E8E0DA' }}>
          <h3 className="text-sm font-bold mb-2 text-brand-text">CSVフォーマット</h3>
          <div className="text-xs mb-3 text-brand-muted overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E8E0DA]">
                  <th className="text-left py-1 pr-4 whitespace-nowrap">カラム</th>
                  <th className="text-left py-1 pr-4 whitespace-nowrap">必須</th>
                  <th className="text-left py-1">説明</th>
                </tr>
              </thead>
              <tbody>
                {CSV_FORMAT[dataType].map((row, i) => (
                  <tr key={row.col} className={i < CSV_FORMAT[dataType].length - 1 ? 'border-b border-[#E8E0DA]' : ''}>
                    <td className="py-1 pr-4 font-mono whitespace-nowrap">{row.col}</td>
                    <td className="py-1 pr-4 whitespace-nowrap">
                      {row.required
                        ? <span className="text-[#E86D78] font-semibold">必須</span>
                        : '任意'}
                    </td>
                    <td className="py-1">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleDownloadTemplate} variant="brand-outline" size="pill-sm">
              📥 テンプレート
            </Button>
            {DOWNLOADABLE_ALL_TYPES.includes(dataType) && (
              <Button
                onClick={handleDownloadAll}
                disabled={isDownloadingAll}
                variant="brand-outline"
                size="pill-sm"
                className="text-green-700 border-green-600 hover:bg-green-50"
              >
                {isDownloadingAll ? '取得中...' : '📤 全件ダウンロード'}
              </Button>
            )}
          </div>
        </div>

        <UploadResult result={uploadResult} onClose={() => setUploadResult(null)} />
        <CsvUploader onUpload={handleUpload} isUploading={isUploading} />
        <UploadHistory history={uploadHistory} />
      </div>
    </div>
  );
};
