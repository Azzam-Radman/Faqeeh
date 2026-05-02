import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, BookOpen, Quote } from 'lucide-react';
import type { Reference, Language, Madhab } from '../types';

interface ReferenceCardProps {
  reference: Reference;
  index: number;
  language: Language;
}

const MADHAB_STYLES: Record<Madhab, { bg: string; text: string; border: string }> = {
  hanafi: { bg: '#EFF6FF', text: '#1d4ed8', border: '#bfdbfe' },
  maliki: { bg: '#F0FDFA', text: '#0f766e', border: '#99f6e4' },
  shafii: { bg: '#ECFDF5', text: '#059669', border: '#a7f3d0' },
  hanbali: { bg: '#FFFBEB', text: '#d97706', border: '#fde68a' },
  general: { bg: '#F3F4F6', text: '#6b7280', border: '#e5e7eb' },
};

interface DetailItemProps {
  label: string;
  value: string | number;
  isArabic: boolean;
}

function DetailItem({ label, value, isArabic }: DetailItemProps) {
  return (
    <div
      className={`flex flex-col gap-0.5 ${isArabic ? 'items-end' : 'items-start'}`}
    >
      <span
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'rgba(27, 67, 50, 0.5)', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
      >
        {label}
      </span>
      <span
        className="text-sm font-medium"
        style={{ color: '#2D1B0E', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
      >
        {value}
      </span>
    </div>
  );
}

export default function ReferenceCard({ reference, index, language }: ReferenceCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isArabic = language === 'ar';

  const madhab = (reference.madhab as Madhab) || 'general';
  const madhabStyle = MADHAB_STYLES[madhab] || MADHAB_STYLES.general;

  const madhabLabel =
    madhab === 'general' ? t('madhab.general') :
    madhab === 'hanafi' ? t('madhab.hanafi') :
    madhab === 'maliki' ? t('madhab.maliki') :
    madhab === 'shafii' ? t('madhab.shafii') :
    t('madhab.hanbali');

  const bookTitle = reference.book_title || '';
  const scholarName = reference.scholar_name || '';
  const excerptText = reference.text_excerpt;

  const hasDetails =
    reference.juz || reference.volume || reference.page ||
    reference.section || reference.chapter || reference.edition ||
    reference.publisher;

  const detailItems = [
    reference.juz && { label: t('references.juz'), value: reference.juz },
    reference.volume && { label: t('references.volume'), value: reference.volume },
    reference.page && { label: t('references.page'), value: reference.page },
    reference.section && { label: t('references.section'), value: reference.section },
    reference.chapter && { label: t('references.chapter'), value: reference.chapter },
    reference.edition && { label: t('references.edition'), value: reference.edition },
    reference.publisher && { label: t('references.publisher'), value: reference.publisher },
  ].filter(Boolean) as { label: string; value: string | number }[];

  return (
    <motion.div
      className="reference-card overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
    >
      {/* Card Header */}
      <div
        className={`flex items-start gap-3 p-4 ${isArabic ? 'flex-row-reverse' : ''}`}
      >
        {/* Citation number badge */}
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: '#1B4332', color: '#C9A84C' }}
        >
          {index + 1}
        </div>

        {/* Main info */}
        <div className={`flex-1 min-w-0 ${isArabic ? 'text-right' : 'text-left'}`}>
          {/* Scholar + Madhab row */}
          {(scholarName || reference.madhab) && (
            <div
              className={`flex items-center gap-2 mb-1.5 flex-wrap ${isArabic ? 'flex-row-reverse' : ''}`}
            >
              {scholarName && (
                <span
                  className="text-sm font-semibold"
                  style={{
                    color: '#1B4332',
                    fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                  }}
                >
                  {scholarName}
                </span>
              )}
              {reference.madhab && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: madhabStyle.bg,
                    color: madhabStyle.text,
                    border: `1px solid ${madhabStyle.border}`,
                    fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                  }}
                >
                  {madhabLabel}
                </span>
              )}
            </div>
          )}

          {/* Book title */}
          <div className={`flex items-center gap-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
            <BookOpen size={14} style={{ color: '#C9A84C', flexShrink: 0 }} />
            <span
              className="font-bold text-base leading-tight"
              style={{
                color: '#2D1B0E',
                fontFamily: isArabic ? "'Scheherazade New', serif" : "'Inter', sans-serif",
                fontSize: isArabic ? '1.05rem' : '0.95rem',
              }}
            >
              {bookTitle}
            </span>
          </div>
        </div>

        {/* Expand toggle */}
        {(hasDetails || excerptText) && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-islamic-accent"
            style={{ color: '#1B4332' }}
            aria-label={expanded ? t('references.show_less') : t('references.show_more')}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {/* Quick info strip (always visible) */}
      {(reference.juz || reference.page || reference.volume) && (
        <div
          className={`flex items-center gap-3 px-4 pb-3 flex-wrap ${isArabic ? 'flex-row-reverse' : ''}`}
        >
          {reference.juz && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: '#F8F4ED', color: '#2D1B0E', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
            >
              {t('references.juz')}: {reference.juz}
            </span>
          )}
          {reference.volume && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: '#F8F4ED', color: '#2D1B0E', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
            >
              {t('references.volume')}: {reference.volume}
            </span>
          )}
          {reference.page && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: '#F8F4ED', color: '#2D1B0E', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
            >
              {t('references.page')}: {reference.page}
            </span>
          )}
        </div>
      )}

      {/* Expandable section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="px-4 pb-4"
              style={{ borderTop: '1px solid #E8DDD0' }}
            >
              {/* Details grid */}
              {detailItems.length > 0 && (
                <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 mb-3`}>
                  {detailItems.map(({ label, value }) => (
                    <DetailItem
                      key={label}
                      label={label}
                      value={value}
                      isArabic={isArabic}
                    />
                  ))}
                </div>
              )}

              {/* Excerpt / original text */}
              {excerptText && (
                <div className="mt-3">
                  <div
                    className={`flex items-center gap-2 mb-2 ${isArabic ? 'flex-row-reverse' : ''}`}
                  >
                    <Quote size={14} style={{ color: '#C9A84C' }} />
                    <span
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{
                        color: 'rgba(27, 67, 50, 0.6)',
                        fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                      }}
                    >
                      {t('references.excerpt')}
                    </span>
                  </div>
                  <blockquote className="reference-excerpt" dir={isArabic ? 'rtl' : 'ltr'}>
                    {excerptText}
                  </blockquote>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
