import React, { useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { bffClient } from '../../services/bffClient';
import { Button } from '../../components/ui/button';

interface CourseForm {
  fullname: string;
  shortname: string;
  categoryid: string;
  summary: string;
  format: string;
  visible: '1' | '0';
  startdate: string;
  enddate: string;
  imageUrl: string;
}

interface CreateResult {
  success: boolean;
  message: string;
  courses?: Array<{ id: number; shortname: string }>;
}

const INITIAL_FORM: CourseForm = {
  fullname: '',
  shortname: '',
  categoryid: '',
  summary: '',
  format: 'topics',
  visible: '1',
  startdate: '',
  enddate: '',
  imageUrl: '',
};

const FORMAT_OPTIONS = [
  { value: 'topics', label: 'トピック形式' },
  { value: 'weeks', label: '週形式' },
  { value: 'social', label: 'ソーシャル形式' },
  { value: 'singleactivity', label: '単一アクティビティ形式' },
];

function toUnixTimestamp(dateStr: string): number | undefined {
  if (!dateStr) return undefined;
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

export const AdminCreateCoursePage: React.FC = () => {
  const [form, setForm] = useState<CourseForm>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    const course: Record<string, any> = {
      fullname: form.fullname,
      shortname: form.shortname,
      categoryid: parseInt(form.categoryid, 10),
      visible: parseInt(form.visible, 10),
      format: form.format,
    };
    if (form.summary) course.summary = form.summary;
    if (form.imageUrl) course.imageUrl = form.imageUrl;
    const start = toUnixTimestamp(form.startdate);
    if (start) course.startdate = start;
    const end = toUnixTimestamp(form.enddate);
    if (end) course.enddate = end;

    try {
      const data = await bffClient.createCourse([course]);

      setResult({
        success: true,
        message: `コースを作成しました（ID: ${data.courses?.[0]?.id}）`,
        courses: data.courses,
      });
      setForm(INITIAL_FORM);
    } catch (err: any) {
      setResult({ success: false, message: err.message || '通信エラーが発生しました' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #E8E0DA',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#4B3A33',
    backgroundColor: '#FAFAF8',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#7E6E68',
    marginBottom: '6px',
  };

  return (
    <div>
      <div className="mb-8">
        <h1
          className="text-2xl font-bold mb-2 text-brand-text"
        >
          コース作成
        </h1>
        <p className="text-sm text-brand-muted">
          Moodleに新しいコースを作成します
        </p>
      </div>

      {/* Result */}
      {result && (
        <div
          className="flex items-start gap-3 p-4 rounded-2xl mb-6"
          style={{
            backgroundColor: result.success ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${result.success ? '#86EFAC' : '#FCA5A5'}`,
          }}
        >
          {result.success ? (
            <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#16A34A' }} />
          ) : (
            <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#DC2626' }} />
          )}
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: result.success ? '#15803D' : '#B91C1C' }}
            >
              {result.success ? '作成成功' : '作成失敗'}
            </p>
            <p className="text-sm mt-0.5" style={{ color: result.success ? '#166534' : '#991B1B' }}>
              {result.message}
            </p>
          </div>
          <button
            onClick={() => setResult(null)}
            className="ml-auto text-sm"
            style={{ color: '#9CA3AF' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Form */}
      <div
        className="rounded-3xl p-6 sm:p-8"
        style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* 必須フィールド */}
          <div
            className="pb-5 border-b border-brand-border"
          >
            <p className="text-xs font-bold uppercase tracking-wider mb-4 text-brand-subtle">
              必須項目
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label style={labelStyle}>
                  コース名（完全名）<span className="text-brand">*</span>
                </label>
                <input
                  type="text"
                  name="fullname"
                  value={form.fullname}
                  onChange={handleChange}
                  required
                  placeholder="例: Introduction to Programming"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  短縮名<span className="text-brand">*</span>
                </label>
                <input
                  type="text"
                  name="shortname"
                  value={form.shortname}
                  onChange={handleChange}
                  required
                  placeholder="例: PROG101"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  カテゴリID<span className="text-brand">*</span>
                </label>
                <input
                  type="number"
                  name="categoryid"
                  value={form.categoryid}
                  onChange={handleChange}
                  required
                  min="1"
                  placeholder="例: 1"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* オプションフィールド */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-4 text-brand-subtle">
              オプション項目
            </p>
            <div className="flex flex-col gap-5">
              <div>
                <label style={labelStyle}>コース概要</label>
                <textarea
                  name="summary"
                  value={form.summary}
                  onChange={handleChange}
                  rows={3}
                  placeholder="コースの説明を入力してください"
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={labelStyle}>コース画像URL</label>
                <input
                  type="url"
                  name="imageUrl"
                  value={form.imageUrl}
                  onChange={handleChange}
                  placeholder="例: https://cdn.example.com/course-images/img.png"
                  style={inputStyle}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label style={labelStyle}>コースフォーマット</label>
                  <select
                    name="format"
                    value={form.format}
                    onChange={handleChange}
                    style={inputStyle}
                  >
                    {FORMAT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>表示設定</label>
                  <select
                    name="visible"
                    value={form.visible}
                    onChange={handleChange}
                    style={inputStyle}
                  >
                    <option value="1">表示</option>
                    <option value="0">非表示</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label style={labelStyle}>開始日</label>
                  <input
                    type="date"
                    name="startdate"
                    value={form.startdate}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>終了日</label>
                  <input
                    type="date"
                    name="enddate"
                    value={form.enddate}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              variant="brand-gradient"
              size="pill"
              className="flex items-center gap-2 px-8"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? '作成中...' : 'コースを作成'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
