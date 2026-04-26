import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BookOpen, MessageCircle, User } from 'lucide-react';
import axios from 'axios';
import type { Language, Scholar, Book } from '../types';

interface ScholarsPageProps {
  language: Language;
}

const MADHAB_TABS = ['all', 'hanafi', 'maliki', 'shafii', 'hanbali'];

const MADHAB_COLORS: Record<string, { bg: string; text: string; border: string; headerBg: string }> = {
  hanafi: { bg: '#EFF6FF', text: '#1d4ed8', border: '#bfdbfe', headerBg: '#DBEAFE' },
  maliki: { bg: '#F0FDFA', text: '#0f766e', border: '#99f6e4', headerBg: '#CCFBF1' },
  shafii: { bg: '#ECFDF5', text: '#059669', border: '#a7f3d0', headerBg: '#D1FAE5' },
  hanbali: { bg: '#FFFBEB', text: '#d97706', border: '#fde68a', headerBg: '#FEF3C7' },
  default: { bg: '#F9FAFB', text: '#6b7280', border: '#e5e7eb', headerBg: '#F3F4F6' },
};

function getMadhabStyle(madhab?: string) {
  return MADHAB_COLORS[madhab?.toLowerCase() || ''] || MADHAB_COLORS.default;
}

interface ScholarWithBooks extends Scholar {
  books?: Book[];
}

export default function ScholarsPage({ language }: ScholarsPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isArabic = language === 'ar';
  const font = isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif";

  const [scholars, setScholars] = useState<ScholarWithBooks[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    const fetchScholars = async () => {
      try {
        const { data } = await axios.get('/api/scholars');
        setScholars(data.scholars || []);
      } catch {
        // silently fail — use empty state
      } finally {
        setLoading(false);
      }
    };
    fetchScholars();
  }, []);

  const filtered = activeTab === 'all'
    ? scholars
    : scholars.filter(s => s.madhab === activeTab);

  const handleAskScholar = (scholar: Scholar) => {
    const q = isArabic
      ? `ما قول ${scholar.name_ar} في مسألة...`
      : `What is the opinion of ${scholar.name_en || scholar.name_ar} regarding...`;
    navigate('/', { state: { prefillQuestion: q } });
  };

  const tabLabel = (tab: string) =>
    tab === 'all' ? (isArabic ? 'الكل' : 'All') : t(`madhab.${tab}`);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8" style={{ fontFamily: font }}>
      {/* Header */}
      <div className="mb-8" style={{ direction: isArabic ? 'rtl' : 'ltr' }}>
        <h1
          className="text-2xl font-bold mb-1"
          style={{
            color: '#1B4332',
            fontFamily: isArabic ? "'Scheherazade New', serif" : "'Inter', sans-serif",
          }}
        >
          {t('nav.scholars')}
        </h1>
        <p className="text-sm" style={{ color: 'rgba(45, 27, 14, 0.55)' }}>
          {isArabic
            ? 'أئمة ومجتهدو الفقه الإسلامي عبر العصور'
            : 'Imams and jurists of Islamic law across the ages'}
        </p>
      </div>

      {/* Tabs */}
      <div className={`flex gap-2 mb-6 ${isArabic ? 'flex-row-reverse' : ''}`} style={{ overflowX: 'auto' }}>
        {MADHAB_TABS.map(tab => {
          const mc = getMadhabStyle(tab === 'all' ? undefined : tab);
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
              style={{
                background: isActive ? '#1B4332' : '#FFFFFF',
                color: isActive ? '#C9A84C' : 'rgba(45, 27, 14, 0.65)',
                border: `1.5px solid ${isActive ? '#1B4332' : '#E8DDD0'}`,
                fontFamily: font,
              }}
            >
              {tabLabel(tab)}
              {tab !== 'all' && (
                <span
                  className="ml-1.5 text-xs opacity-70"
                  style={{ marginLeft: isArabic ? '0' : '6px', marginRight: isArabic ? '6px' : '0' }}
                >
                  ({scholars.filter(s => s.madhab === tab).length})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="scholar-card h-52 shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <User size={48} strokeWidth={1} style={{ color: 'rgba(27, 67, 50, 0.2)', marginBottom: '1rem' }} />
          <p className="text-sm" style={{ color: 'rgba(45, 27, 14, 0.5)', fontFamily: font }}>
            {isArabic ? 'لا يوجد علماء في هذا المذهب' : 'No scholars in this school'}
          </p>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
        >
          {filtered.map(scholar => {
            const mc = getMadhabStyle(scholar.madhab);
            return (
              <motion.div
                key={scholar.id}
                className="scholar-card overflow-hidden"
                style={{ direction: isArabic ? 'rtl' : 'ltr' }}
                variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.3 }}
              >
                {/* Colored header strip */}
                <div
                  className="px-5 pt-5 pb-4 relative overflow-hidden"
                  style={{ background: mc.headerBg }}
                >
                  {/* Subtle geometric watermark */}
                  <svg
                    className="absolute opacity-10 pointer-events-none"
                    style={{ [isArabic ? 'left' : 'right']: '-10px', top: '-10px', width: '80px', height: '80px' }}
                    viewBox="0 0 80 80"
                  >
                    <polygon points="40,8 46,26 64,26 50,38 55,56 40,45 25,56 30,38 16,26 34,26" fill={mc.text} />
                  </svg>

                  <div className={`flex items-start gap-3 ${isArabic ? 'flex-row-reverse' : ''}`}>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold"
                      style={{ background: mc.bg, color: mc.text, border: `2px solid ${mc.border}` }}
                    >
                      {(isArabic ? scholar.name_ar : (scholar.name_en || scholar.name_ar))[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-bold text-base leading-snug"
                        style={{
                          color: '#1B4332',
                          fontFamily: isArabic ? "'Scheherazade New', serif" : "'Inter', sans-serif",
                          fontSize: isArabic ? '1.05rem' : '0.95rem',
                        }}
                      >
                        {isArabic ? scholar.name_ar : (scholar.name_en || scholar.name_ar)}
                      </h3>
                      {scholar.era && (
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(45, 27, 14, 0.55)', fontFamily: font }}>
                          {scholar.era}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-5 py-4">
                  {/* Madhab + dates */}
                  <div className={`flex items-center gap-2 mb-3 ${isArabic ? 'flex-row-reverse' : ''}`}>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: mc.bg, color: mc.text, border: `1px solid ${mc.border}`, fontFamily: font }}
                    >
                      {t(`madhab.${scholar.madhab}`)}
                    </span>
                    {(scholar.birth_year || scholar.death_year) && (
                      <span className="text-xs" style={{ color: 'rgba(45, 27, 14, 0.4)', fontFamily: font }}>
                        {scholar.birth_year && scholar.death_year
                          ? `${scholar.birth_year} – ${scholar.death_year} هـ`
                          : scholar.death_year
                          ? `ت. ${scholar.death_year} هـ`
                          : ''}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {scholar.description_ar && (
                    <p
                      className="text-xs leading-relaxed mb-4 line-clamp-2"
                      style={{
                        color: 'rgba(45, 27, 14, 0.6)',
                        fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                        lineHeight: isArabic ? '1.9' : '1.6',
                      }}
                    >
                      {isArabic ? scholar.description_ar : (scholar.description_en || scholar.description_ar)}
                    </p>
                  )}

                  {/* Books list */}
                  {scholar.books && scholar.books.length > 0 && (
                    <div className="mb-4">
                      <p
                        className="text-xs font-semibold mb-1.5"
                        style={{ color: 'rgba(27, 67, 50, 0.6)', fontFamily: font }}
                      >
                        {isArabic ? 'من مؤلفاته:' : 'Works:'}
                      </p>
                      <ul className={`space-y-1 ${isArabic ? 'text-right' : 'text-left'}`}>
                        {scholar.books.slice(0, 3).map(b => (
                          <li
                            key={b.id}
                            className="text-xs flex items-center gap-1"
                            style={{ color: 'rgba(45, 27, 14, 0.6)', fontFamily: font, justifyContent: isArabic ? 'flex-end' : 'flex-start' }}
                          >
                            <BookOpen size={10} style={{ flexShrink: 0 }} />
                            {isArabic ? b.title_ar : (b.title_en || b.title_ar)}
                          </li>
                        ))}
                        {scholar.books.length > 3 && (
                          <li className="text-xs" style={{ color: 'rgba(45, 27, 14, 0.4)', fontFamily: font }}>
                            {isArabic ? `+ ${scholar.books.length - 3} كتب أخرى` : `+ ${scholar.books.length - 3} more`}
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Ask button */}
                  <motion.button
                    onClick={() => handleAskScholar(scholar)}
                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all ${isArabic ? 'flex-row-reverse' : ''}`}
                    style={{
                      background: 'rgba(27, 67, 50, 0.06)',
                      color: '#1B4332',
                      border: '1px solid rgba(27, 67, 50, 0.15)',
                      fontFamily: font,
                    }}
                    whileHover={{ background: 'rgba(27, 67, 50, 0.1)', borderColor: 'rgba(27, 67, 50, 0.3)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <MessageCircle size={13} />
                    <span>{isArabic ? `اسأل عن قول ${scholar.name_ar.split(' ')[0]}` : `Ask about ${(scholar.name_en || scholar.name_ar).split(' ').slice(-1)[0]}'s opinion`}</span>
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
