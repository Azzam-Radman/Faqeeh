import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import type { Language, Madhab, BookUploadFormData, UploadProgress } from '../types';

interface BookUploadProps {
  language: Language;
  onClose: () => void;
  onSuccess: () => void;
}

const ACCEPTED_TYPES = ['.pdf', '.docx', '.txt', '.md'];
const ACCEPTED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
];

const MADHABS: Array<{ value: Madhab; label_ar: string; label_en: string }> = [
  { value: 'hanafi', label_ar: 'حنفي', label_en: 'Hanafi' },
  { value: 'maliki', label_ar: 'مالكي', label_en: 'Maliki' },
  { value: 'shafii', label_ar: 'شافعي', label_en: "Shafi'i" },
  { value: 'hanbali', label_ar: 'حنبلي', label_en: 'Hanbali' },
  { value: 'general', label_ar: 'عام', label_en: 'General' },
];

const INITIAL_FORM: BookUploadFormData = {
  title_arabic: '',
  title_english: '',
  author_arabic: '',
  author_english: '',
  madhab: '',
  edition: '',
  publisher: '',
  year: '',
  file: null,
};

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  isArabic: boolean;
  error?: string;
}

function Field({ label, required, children, isArabic, error }: FieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${isArabic ? 'items-end' : 'items-start'}`}>
      <label
        className="text-sm font-medium"
        style={{ color: '#2D1B0E', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
      >
        {label}
        {required && <span style={{ color: '#dc2626', marginRight: isArabic ? '0' : '0', marginLeft: isArabic ? '4px' : '2px' }}>*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-500" style={{ fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default function BookUpload({ language, onClose, onSuccess }: BookUploadProps) {
  const { t } = useTranslation();
  const isArabic = language === 'ar';
  const [form, setForm] = useState<BookUploadFormData>(INITIAL_FORM);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({ percentage: 0, status: 'idle' });
  const [errors, setErrors] = useState<Partial<Record<keyof BookUploadFormData, string>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inputStyle = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1.5px solid #E8DDD0',
    background: '#FFFFFF',
    color: '#2D1B0E',
    fontSize: '0.875rem',
    fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
    outline: 'none',
    direction: isArabic ? 'rtl' as const : 'ltr' as const,
    textAlign: isArabic ? 'right' as const : 'left' as const,
  };

  const handleFileSelect = useCallback((file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_TYPES.includes(ext) && !ACCEPTED_MIME.includes(file.type)) {
      toast.error(isArabic ? 'نوع الملف غير مدعوم' : 'Unsupported file type');
      return;
    }
    setForm(prev => ({ ...prev, file }));
    setErrors(prev => ({ ...prev, file: undefined }));

    // Auto-fill title from filename
    if (!form.title_arabic && !form.title_english) {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      setForm(prev => ({ ...prev, file, title_english: baseName }));
    }
  }, [form.title_arabic, form.title_english, isArabic]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!form.file) newErrors.file = t('upload.file_required');
    if (!form.title_arabic.trim()) newErrors.title_arabic = t('upload.required');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const formData = new FormData();
    formData.append('file', form.file!);
    formData.append('title_arabic', form.title_arabic);
    if (form.title_english) formData.append('title_english', form.title_english);
    if (form.author_arabic) formData.append('author_arabic', form.author_arabic);
    if (form.author_english) formData.append('author_english', form.author_english);
    if (form.madhab) formData.append('madhab', form.madhab);
    if (form.edition) formData.append('edition', form.edition);
    if (form.publisher) formData.append('publisher', form.publisher);
    if (form.year) formData.append('year', form.year);

    setProgress({ percentage: 0, status: 'uploading' });

    try {
      await axios.post('/api/books/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => {
          if (ev.total) {
            const pct = Math.round((ev.loaded / ev.total) * 80);
            setProgress({ percentage: pct, status: 'uploading' });
          }
        },
      });

      setProgress({ percentage: 90, status: 'processing', message: t('upload.processing') });
      await new Promise(r => setTimeout(r, 800));
      setProgress({ percentage: 100, status: 'success', message: t('upload.success') });
      toast.success(t('upload.success'));

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      setProgress({ percentage: 0, status: 'error', message: t('upload.error') });
      toast.error(t('upload.error'));
    }
  };

  const isUploading = progress.status === 'uploading' || progress.status === 'processing';
  const isDone = progress.status === 'success';

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(15, 36, 25, 0.55)', backdropFilter: 'blur(4px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget && !isUploading) onClose(); }}
      >
        <motion.div
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
          style={{
            background: '#FFFFFF',
            boxShadow: '0 25px 60px rgba(15, 36, 25, 0.25), 0 8px 20px rgba(15, 36, 25, 0.15)',
          }}
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {/* Modal header */}
          <div
            className={`flex items-center justify-between px-6 py-4 ${isArabic ? 'flex-row-reverse' : ''}`}
            style={{
              background: 'linear-gradient(135deg, #1B4332 0%, #0F2419 100%)',
              borderRadius: '1rem 1rem 0 0',
              borderBottom: '2px solid rgba(201, 168, 76, 0.3)',
            }}
          >
            <div className={isArabic ? 'text-right' : 'text-left'}>
              <h2
                className="font-bold text-lg"
                style={{
                  color: '#C9A84C',
                  fontFamily: isArabic ? "'Scheherazade New', serif" : "'Inter', sans-serif",
                }}
              >
                {t('upload.title')}
              </h2>
              <p
                className="text-xs mt-0.5"
                style={{ color: 'rgba(212, 230, 217, 0.6)', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
              >
                {t('upload.subtitle')}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isUploading}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(201, 168, 76, 0.7)' }}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5" dir={isArabic ? 'rtl' : 'ltr'}>
            {/* Drop zone */}
            <div
              className={`drop-zone p-6 text-center cursor-pointer ${isDragging ? 'active' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
              />
              {form.file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText size={28} style={{ color: '#1B4332', flexShrink: 0 }} />
                  <div className={isArabic ? 'text-right' : 'text-left'}>
                    <p className="font-semibold text-sm" style={{ color: '#2D1B0E', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}>
                      {form.file.name}
                    </p>
                    <p className="text-xs" style={{ color: 'rgba(45, 27, 14, 0.5)', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}>
                      {(form.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setForm(prev => ({ ...prev, file: null })); }}
                    className="p-1 rounded hover:bg-red-50"
                    style={{ color: '#dc2626' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={32} className="mx-auto mb-3" style={{ color: isDragging ? '#C9A84C' : 'rgba(27, 67, 50, 0.4)' }} />
                  <p className="font-medium text-sm" style={{ color: '#2D1B0E', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}>
                    {isDragging ? t('upload.drop_zone_active') : t('upload.drop_zone')}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(45, 27, 14, 0.45)', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}>
                    {t('upload.accepted_files')}
                  </p>
                </>
              )}
            </div>
            {errors.file && (
              <p className="text-xs text-red-500" style={{ fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}>
                {errors.file}
              </p>
            )}

            {/* Form fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('upload.title_arabic')} required isArabic={isArabic} error={errors.title_arabic}>
                <input
                  type="text"
                  value={form.title_arabic}
                  onChange={e => setForm(p => ({ ...p, title_arabic: e.target.value }))}
                  style={{ ...inputStyle, fontFamily: "'Cairo', sans-serif", direction: 'rtl', textAlign: 'right' }}
                  placeholder="المدوّنة الكبرى"
                />
              </Field>
              <Field label={t('upload.title_english')} isArabic={isArabic}>
                <input
                  type="text"
                  value={form.title_english}
                  onChange={e => setForm(p => ({ ...p, title_english: e.target.value }))}
                  style={{ ...inputStyle, fontFamily: "'Inter', sans-serif", direction: 'ltr', textAlign: 'left' }}
                  placeholder="Al-Mudawwana al-Kubra"
                />
              </Field>
              <Field label={t('upload.author_arabic')} isArabic={isArabic}>
                <input
                  type="text"
                  value={form.author_arabic}
                  onChange={e => setForm(p => ({ ...p, author_arabic: e.target.value }))}
                  style={{ ...inputStyle, fontFamily: "'Cairo', sans-serif", direction: 'rtl', textAlign: 'right' }}
                  placeholder="الإمام مالك بن أنس"
                />
              </Field>
              <Field label={t('upload.author_english')} isArabic={isArabic}>
                <input
                  type="text"
                  value={form.author_english}
                  onChange={e => setForm(p => ({ ...p, author_english: e.target.value }))}
                  style={{ ...inputStyle, fontFamily: "'Inter', sans-serif", direction: 'ltr', textAlign: 'left' }}
                  placeholder="Imam Malik ibn Anas"
                />
              </Field>
              <Field label={t('upload.madhab_label')} isArabic={isArabic}>
                <select
                  value={form.madhab}
                  onChange={e => setForm(p => ({ ...p, madhab: e.target.value as Madhab | '' }))}
                  style={inputStyle}
                >
                  <option value="">{t('upload.select_madhab')}</option>
                  {MADHABS.map(m => (
                    <option key={m.value} value={m.value}>
                      {isArabic ? m.label_ar : m.label_en}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('upload.edition_label')} isArabic={isArabic}>
                <input
                  type="text"
                  value={form.edition}
                  onChange={e => setForm(p => ({ ...p, edition: e.target.value }))}
                  style={inputStyle}
                  placeholder={isArabic ? 'الأولى' : '1st'}
                />
              </Field>
              <Field label={t('upload.publisher_label')} isArabic={isArabic}>
                <input
                  type="text"
                  value={form.publisher}
                  onChange={e => setForm(p => ({ ...p, publisher: e.target.value }))}
                  style={inputStyle}
                  placeholder={isArabic ? 'دار الكتب العلمية' : 'Dar al-Kutub al-Ilmiyya'}
                />
              </Field>
              <Field label={t('upload.year_label')} isArabic={isArabic}>
                <input
                  type="number"
                  value={form.year}
                  onChange={e => setForm(p => ({ ...p, year: e.target.value }))}
                  style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }}
                  placeholder="2020"
                  min="600"
                  max="2030"
                />
              </Field>
            </div>

            {/* Progress bar */}
            {progress.status !== 'idle' && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  {progress.status === 'uploading' || progress.status === 'processing' ? (
                    <Loader size={16} className="animate-spin" style={{ color: '#1B4332' }} />
                  ) : progress.status === 'success' ? (
                    <CheckCircle size={16} style={{ color: '#059669' }} />
                  ) : (
                    <AlertCircle size={16} style={{ color: '#dc2626' }} />
                  )}
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: progress.status === 'error' ? '#dc2626' : progress.status === 'success' ? '#059669' : '#1B4332',
                      fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                    }}
                  >
                    {progress.message || (progress.status === 'uploading' ? t('upload.uploading') : '')}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full" style={{ background: '#E8DDD0' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: progress.status === 'error'
                        ? '#dc2626'
                        : progress.status === 'success'
                        ? '#059669'
                        : 'linear-gradient(90deg, #1B4332, #C9A84C)',
                    }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress.percentage}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className={`flex gap-3 pt-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm transition-all"
                style={{
                  border: '1.5px solid #E8DDD0',
                  color: '#2D1B0E',
                  background: '#FFFFFF',
                  fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                  opacity: isUploading ? 0.5 : 1,
                }}
              >
                {t('upload.cancel')}
              </button>
              <button
                type="submit"
                disabled={isUploading || isDone}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                style={{
                  background: isUploading || isDone ? 'rgba(27, 67, 50, 0.6)' : 'linear-gradient(135deg, #1B4332 0%, #0F2419 100%)',
                  color: '#C9A84C',
                  fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                  boxShadow: isUploading ? 'none' : '0 4px 16px rgba(27, 67, 50, 0.25)',
                  cursor: isUploading || isDone ? 'not-allowed' : 'pointer',
                }}
              >
                {isUploading ? (
                  <><Loader size={16} className="animate-spin" /><span>{t('upload.uploading')}</span></>
                ) : isDone ? (
                  <><CheckCircle size={16} /><span>{t('upload.success')}</span></>
                ) : (
                  <><Upload size={16} /><span>{t('upload.submit')}</span></>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
