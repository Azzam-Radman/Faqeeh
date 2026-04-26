import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Copy, CheckCheck, Scale } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ScholarComparison, Language, Madhab } from '../types';

interface ScholarComparisonTableProps {
  comparison: ScholarComparison;
  language: Language;
}

const MADHAB_STYLES: Record<Madhab, { bg: string; text: string; border: string; row: string }> = {
  hanafi: { bg: '#EFF6FF', text: '#1d4ed8', border: '#bfdbfe', row: '#f8fbff' },
  maliki: { bg: '#F0FDFA', text: '#0f766e', border: '#99f6e4', row: '#f7fffe' },
  shafii: { bg: '#ECFDF5', text: '#059669', border: '#a7f3d0', row: '#f5fdf9' },
  hanbali: { bg: '#FFFBEB', text: '#d97706', border: '#fde68a', row: '#fffdf5' },
  general: { bg: '#F3F4F6', text: '#6b7280', border: '#e5e7eb', row: '#f9fafb' },
};

export default function ScholarComparisonTable({ comparison, language }: ScholarComparisonTableProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const isArabic = language === 'ar';

  const topicLabel = isArabic && comparison.topic_arabic ? comparison.topic_arabic : comparison.topic;

  const handleExport = async () => {
    const rows = comparison.opinions.map(op => {
      const madhab = isArabic ? t(`madhab.${op.madhab}`) : op.madhab;
      const scholar = isArabic && op.scholar_arabic ? op.scholar_arabic : op.scholar;
      const opinion = isArabic && op.opinion_arabic ? op.opinion_arabic : op.opinion;
      const evidence = isArabic && op.evidence_arabic ? op.evidence_arabic : (op.evidence || '');
      const ref = op.reference || '';
      return `${madhab}\t${scholar}\t${opinion}\t${evidence}\t${ref}`;
    });

    const header = isArabic
      ? `المذهب\tالعالم\tالقول\tالدليل\tالمرجع`
      : `School\tScholar\tOpinion\tEvidence\tReference`;

    const text = `${topicLabel}\n\n${header}\n${rows.join('\n')}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t('comparison.exported'));
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error(isArabic ? 'تعذر النسخ' : 'Copy failed');
    }
  };

  const columns = isArabic
    ? [
        { key: 'madhab', label: t('comparison.madhab_col') },
        { key: 'scholar', label: t('comparison.scholar_col') },
        { key: 'opinion', label: t('comparison.opinion_col') },
        { key: 'evidence', label: t('comparison.evidence_col') },
        { key: 'reference', label: t('comparison.reference_col') },
      ]
    : [
        { key: 'madhab', label: t('comparison.madhab_col') },
        { key: 'scholar', label: t('comparison.scholar_col') },
        { key: 'opinion', label: t('comparison.opinion_col') },
        { key: 'evidence', label: t('comparison.evidence_col') },
        { key: 'reference', label: t('comparison.reference_col') },
      ];

  return (
    <motion.div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid #E8DDD0', boxShadow: '0 4px 16px rgba(45, 27, 14, 0.08)' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Table header */}
      <div
        className={`flex items-center justify-between px-4 py-3 ${isArabic ? 'flex-row-reverse' : ''}`}
        style={{ background: 'linear-gradient(135deg, #1B4332 0%, #0F2419 100%)', borderBottom: '2px solid rgba(201, 168, 76, 0.3)' }}
      >
        <div className={`flex items-center gap-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
          <Scale size={16} style={{ color: '#C9A84C' }} />
          <div className={isArabic ? 'text-right' : 'text-left'}>
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-0.5"
              style={{ color: 'rgba(201, 168, 76, 0.6)', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
            >
              {t('comparison.title')}
            </p>
            <p
              className="font-bold"
              style={{
                color: '#C9A84C',
                fontFamily: isArabic ? "'Scheherazade New', serif" : "'Inter', sans-serif",
                fontSize: isArabic ? '1.05rem' : '0.95rem',
              }}
            >
              {topicLabel}
            </p>
          </div>
        </div>

        <button
          onClick={handleExport}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isArabic ? 'flex-row-reverse' : ''}`}
          style={{
            background: 'rgba(201, 168, 76, 0.15)',
            border: '1px solid rgba(201, 168, 76, 0.3)',
            color: '#C9A84C',
            fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
          }}
        >
          {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
          <span>{copied ? t('comparison.exported') : t('comparison.export')}</span>
        </button>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto">
        <table
          className="comparison-table"
          dir={isArabic ? 'rtl' : 'ltr'}
          style={{ fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
        >
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`text-sm ${isArabic ? 'text-right' : 'text-left'}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ background: '#FFFFFF' }}>
            {comparison.opinions.map((opinion, idx) => {
              const madhab = (opinion.madhab as Madhab) || 'general';
              const style = MADHAB_STYLES[madhab] || MADHAB_STYLES.general;
              const scholar = isArabic && opinion.scholar_arabic ? opinion.scholar_arabic : opinion.scholar;
              const opinionText = isArabic && opinion.opinion_arabic ? opinion.opinion_arabic : opinion.opinion;
              const evidenceText = isArabic && opinion.evidence_arabic ? opinion.evidence_arabic : (opinion.evidence || '—');
              const madhabLabel = t(`madhab.${madhab}`);

              return (
                <tr
                  key={idx}
                  style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#FEFCF9' }}
                >
                  {/* Madhab */}
                  <td>
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                      style={{
                        background: style.bg,
                        color: style.text,
                        border: `1px solid ${style.border}`,
                      }}
                    >
                      {madhabLabel}
                    </span>
                  </td>

                  {/* Scholar */}
                  <td>
                    <span
                      className="text-sm font-semibold whitespace-nowrap"
                      style={{ color: '#1B4332' }}
                    >
                      {scholar}
                    </span>
                  </td>

                  {/* Opinion */}
                  <td className="max-w-xs">
                    <p
                      className="text-sm leading-relaxed"
                      style={{
                        color: '#2D1B0E',
                        lineHeight: isArabic ? '1.9' : '1.5',
                        fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                      }}
                    >
                      {opinionText}
                    </p>
                  </td>

                  {/* Evidence */}
                  <td className="max-w-xs">
                    <p
                      className="text-sm"
                      style={{
                        color: '#4a5568',
                        lineHeight: isArabic ? '1.8' : '1.4',
                        fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                      }}
                    >
                      {evidenceText}
                    </p>
                  </td>

                  {/* Reference */}
                  <td>
                    {opinion.reference ? (
                      <span
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          background: '#F8F4ED',
                          color: '#2D1B0E',
                          fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                          display: 'inline-block',
                          maxWidth: '140px',
                          wordBreak: 'break-word',
                        }}
                      >
                        {opinion.reference}
                      </span>
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <div
        className={`px-4 py-2 text-xs ${isArabic ? 'text-right' : 'text-left'}`}
        style={{
          borderTop: '1px solid #E8DDD0',
          background: '#FEFCF9',
          color: 'rgba(45, 27, 14, 0.4)',
          fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
        }}
      >
        {isArabic
          ? `${comparison.opinions.length} مذاهب • للاستزادة يرجى مراجعة المصادر الأصلية`
          : `${comparison.opinions.length} schools of thought • Please consult original sources for further study`}
      </div>
    </motion.div>
  );
}
