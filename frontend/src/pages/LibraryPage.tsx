import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BookOpen, Trash2, Upload, Search, Filter, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import type { Language, Book } from '../types';
import BookUpload from '../components/BookUpload';

interface LibraryPageProps {
  language: Language;
}

const MADHABS = ['all', 'hanafi', 'maliki', 'shafii', 'hanbali'];

const MADHAB_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  hanafi: { bg: '#EFF6FF', text: '#1d4ed8', border: '#bfdbfe' },
  maliki: { bg: '#F0FDFA', text: '#0f766e', border: '#99f6e4' },
  shafii: { bg: '#ECFDF5', text: '#059669', border: '#a7f3d0' },
  hanbali: { bg: '#FFFBEB', text: '#d97706', border: '#fde68a' },
  default: { bg: '#F3F4F6', text: '#6b7280', border: '#e5e7eb' },
};

function getMadhabColor(madhab?: string) {
  return MADHAB_COLORS[madhab?.toLowerCase() || ''] || MADHAB_COLORS.default;
}

export default function LibraryPage({ language }: LibraryPageProps) {
  const { t } = useTranslation();
  const isArabic = language === 'ar';
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [madhabFilter, setMadhabFilter] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [scholarMadhabs, setScholarMadhabs] = useState<Record<string, string>>({});

  const font = isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif";

  const fetchBooks = useCallback(async () => {
    try {
      setLoading(true);
      const [{ data: booksData }, { data: scholarsData }] = await Promise.all([
        axios.get('/api/books'),
        axios.get('/api/scholars'),
      ]);
      setBooks(booksData.books || []);
      const map: Record<string, string> = {};
      (scholarsData.scholars || []).forEach((s: { id: string; madhab: string }) => {
        map[s.id] = s.madhab;
      });
      setScholarMadhabs(map);
    } catch {
      toast.error(isArabic ? 'فشل تحميل الكتب' : 'Failed to load books');
    } finally {
      setLoading(false);
    }
  }, [isArabic]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  const handleDelete = async (bookId: string) => {
    try {
      await axios.delete(`/api/books/${bookId}`);
      setBooks(prev => prev.filter(b => b.id !== bookId));
      toast.success(isArabic ? 'تم حذف الكتاب' : 'Book deleted');
      setDeleteConfirm(null);
    } catch {
      toast.error(isArabic ? 'فشل حذف الكتاب' : 'Failed to delete book');
    }
  };

  const filteredBooks = books.filter(book => {
    const matchSearch = !searchTerm ||
      book.title_ar.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (book.title_en || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (book.author_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchMadhab = madhabFilter === 'all' || scholarMadhabs[book.author_id] === madhabFilter;
    return matchSearch && matchMadhab;
  });

  const madhabLabel = (m: string) => {
    if (m === 'all') return isArabic ? 'الكل' : 'All';
    return t(`madhab.${m}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8" style={{ fontFamily: font }}>
      {/* Header */}
      <div className={`flex items-center justify-between mb-8 ${isArabic ? 'flex-row-reverse' : ''}`}>
        <div>
          <h1
            className="text-2xl font-bold"
            style={{
              color: '#1B4332',
              fontFamily: isArabic ? "'Scheherazade New', serif" : "'Inter', sans-serif",
              direction: isArabic ? 'rtl' : 'ltr',
            }}
          >
            {t('library.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(45, 27, 14, 0.55)' }}>
            {isArabic ? `${books.length} كتاب في المكتبة` : `${books.length} book${books.length !== 1 ? 's' : ''} in library`}
          </p>
        </div>
        <motion.button
          onClick={() => setShowUpload(true)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm ${isArabic ? 'flex-row-reverse' : ''}`}
          style={{
            background: 'linear-gradient(135deg, #1B4332 0%, #0F2419 100%)',
            color: '#C9A84C',
            boxShadow: '0 4px 16px rgba(27, 67, 50, 0.3)',
          }}
          whileHover={{ scale: 1.02, boxShadow: '0 6px 20px rgba(27, 67, 50, 0.4)' }}
          whileTap={{ scale: 0.98 }}
        >
          <Upload size={16} />
          <span>{t('library.upload')}</span>
        </motion.button>
      </div>

      {/* Search + Filter */}
      <div className={`flex flex-col sm:flex-row gap-3 mb-6 ${isArabic ? 'sm:flex-row-reverse' : ''}`}>
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute top-1/2 -translate-y-1/2"
            style={{
              [isArabic ? 'right' : 'left']: '12px',
              color: 'rgba(45, 27, 14, 0.4)',
            }}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={isArabic ? 'ابحث عن كتاب...' : 'Search books...'}
            className="w-full py-2.5 rounded-xl outline-none text-sm"
            style={{
              [isArabic ? 'paddingRight' : 'paddingLeft']: '36px',
              [isArabic ? 'paddingLeft' : 'paddingRight']: '12px',
              background: '#FFFFFF',
              border: '1.5px solid #E8DDD0',
              color: '#2D1B0E',
              fontFamily: font,
              direction: isArabic ? 'rtl' : 'ltr',
            }}
          />
        </div>

        <div className={`flex gap-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
          {MADHABS.map(m => (
            <button
              key={m}
              onClick={() => setMadhabFilter(m)}
              className="px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap"
              style={{
                background: madhabFilter === m ? '#1B4332' : '#FFFFFF',
                color: madhabFilter === m ? '#C9A84C' : 'rgba(45, 27, 14, 0.6)',
                border: '1.5px solid',
                borderColor: madhabFilter === m ? '#1B4332' : '#E8DDD0',
                fontFamily: font,
              }}
            >
              {madhabLabel(m)}
            </button>
          ))}
        </div>
      </div>

      {/* Books grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="book-card h-44 shimmer" />
          ))}
        </div>
      ) : filteredBooks.length === 0 ? (
        <motion.div
          className="flex flex-col items-center justify-center py-20 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <BookOpen size={48} strokeWidth={1} style={{ color: 'rgba(27, 67, 50, 0.2)', marginBottom: '1rem' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: '#1B4332', fontFamily: font }}>
            {books.length === 0 ? t('library.empty') : (isArabic ? 'لا توجد نتائج' : 'No results found')}
          </h3>
          <p className="text-sm" style={{ color: 'rgba(45, 27, 14, 0.5)', fontFamily: font }}>
            {books.length === 0
              ? (isArabic ? 'ارفع كتاباً للبدء' : 'Upload a book to get started')
              : (isArabic ? 'جرب بحثاً مختلفاً' : 'Try a different search')}
          </p>
          {books.length === 0 && (
            <motion.button
              onClick={() => setShowUpload(true)}
              className="mt-4 px-6 py-2.5 rounded-xl font-semibold text-sm"
              style={{
                background: 'linear-gradient(135deg, #1B4332 0%, #0F2419 100%)',
                color: '#C9A84C',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {t('library.upload')}
            </motion.button>
          )}
        </motion.div>
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {filteredBooks.map(book => {
            const mc = getMadhabColor(book.author_id);
            return (
              <motion.div
                key={book.id}
                className="book-card relative group"
                variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.3 }}
                style={{ direction: isArabic ? 'rtl' : 'ltr' }}
              >
                {/* Madhab accent bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                  style={{ background: mc.text }}
                />

                <div className="pt-2">
                  {/* Title */}
                  <h3
                    className="font-bold text-base leading-snug mb-1 line-clamp-2"
                    style={{
                      color: '#1B4332',
                      fontFamily: isArabic ? "'Scheherazade New', serif" : "'Inter', sans-serif",
                      fontSize: isArabic ? '1.1rem' : '0.95rem',
                    }}
                  >
                    {isArabic ? book.title_ar : (book.title_en || book.title_ar)}
                  </h3>

                  {/* Author */}
                  <p className="text-sm mb-3" style={{ color: 'rgba(45, 27, 14, 0.6)', fontFamily: font }}>
                    {book.author_name || book.author_id}
                  </p>

                  {/* Meta */}
                  <div className={`flex flex-wrap gap-2 mb-4 ${isArabic ? 'flex-row-reverse' : ''}`}>
                    {book.author_id && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: mc.bg,
                          color: mc.text,
                          border: `1px solid ${mc.border}`,
                          fontFamily: font,
                        }}
                      >
                        {t(`madhab.${book.author_id.split('-')[0]}`) || book.author_id}
                      </span>
                    )}
                    {book.edition && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F8F4ED', color: 'rgba(45, 27, 14, 0.55)', fontFamily: font }}>
                        {isArabic ? `ط. ${book.edition}` : `Ed. ${book.edition}`}
                      </span>
                    )}
                  </div>

                  {/* Publisher + year */}
                  {(book.publisher || book.year) && (
                    <p className="text-xs mb-3" style={{ color: 'rgba(45, 27, 14, 0.4)', fontFamily: font }}>
                      {[book.publisher, book.year].filter(Boolean).join(' • ')}
                    </p>
                  )}

                  {/* Delete button */}
                  <div className={`flex ${isArabic ? 'justify-start' : 'justify-end'}`}>
                    {deleteConfirm === book.id ? (
                      <div className={`flex items-center gap-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
                        <span className="text-xs" style={{ color: 'rgba(45, 27, 14, 0.5)', fontFamily: font }}>
                          {isArabic ? 'هل أنت متأكد؟' : 'Confirm?'}
                        </span>
                        <button
                          onClick={() => handleDelete(book.id)}
                          className="text-xs px-2 py-1 rounded-lg font-medium"
                          style={{ background: '#dc2626', color: 'white', fontFamily: font }}
                        >
                          {isArabic ? 'نعم' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-xs px-2 py-1 rounded-lg"
                          style={{ background: '#F3F4F6', color: '#6b7280', fontFamily: font }}
                        >
                          {isArabic ? 'لا' : 'No'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(book.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all"
                        style={{ color: 'rgba(220, 38, 38, 0.7)' }}
                        title={isArabic ? 'حذف الكتاب' : 'Delete book'}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Upload modal */}
      <AnimatePresence>
        {showUpload && (
          <BookUpload
            language={language}
            onClose={() => setShowUpload(false)}
            onSuccess={() => { setShowUpload(false); fetchBooks(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
