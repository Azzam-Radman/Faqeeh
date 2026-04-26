import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { MessageCircle, BookOpen, Users, X, ChevronLeft, ChevronRight } from 'lucide-react';
import IslamicPattern from './IslamicPattern';
import type { Language } from '../types';

interface SidebarProps {
  language: Language;
  onClose: () => void;
}

const TOPICS = [
  { key: 'taharah', icon: '💧' },
  { key: 'salah', icon: '🕌' },
  { key: 'zakah', icon: '⚖️' },
  { key: 'sawm', icon: '🌙' },
  { key: 'hajj', icon: '🕋' },
  { key: 'buyoo', icon: '📜' },
  { key: 'nikah', icon: '💍' },
  { key: 'talaq', icon: '⚡' },
] as const;

const navItems = [
  { to: '/', labelKey: 'nav.chat', icon: MessageCircle },
  { to: '/library', labelKey: 'nav.library', icon: BookOpen },
  { to: '/scholars', labelKey: 'nav.scholars', icon: Users },
];

export default function Sidebar({ language, onClose }: SidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isArabic = language === 'ar';
  const ChevronIcon = isArabic ? ChevronLeft : ChevronRight;

  const handleTopicClick = (topicKey: string) => {
    const question = isArabic
      ? t(`chat.topics.${topicKey}`)
      : t(`chat.topics.${topicKey}`);
    // Navigate to chat and pass topic as state
    navigate('/', { state: { prefillQuestion: question } });
    onClose();
  };

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #1B4332 0%, #0F2419 100%)',
        borderInlineEnd: '1px solid rgba(201, 168, 76, 0.2)',
      }}
    >
      {/* Pattern overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <IslamicPattern opacity={0.06} color="#C9A84C" size={80} />
      </div>

      {/* Header section */}
      <div
        className="relative flex items-center justify-between px-4 py-4"
        style={{ borderBottom: '1px solid rgba(201, 168, 76, 0.15)' }}
      >
        <div
          className="flex items-center gap-2"
          style={{
            color: '#C9A84C',
            fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <polygon
              points="9,1 10.8,6.2 16.2,6.2 11.9,9.5 13.5,14.8 9,11.7 4.5,14.8 6.1,9.5 1.8,6.2 7.2,6.2"
              fill="#C9A84C"
              fillOpacity="0.8"
            />
          </svg>
          {isArabic ? 'مساعد الفقيه' : 'Fiqh Assistant'}
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors text-islamic-gold-400"
          style={{ color: 'rgba(201, 168, 76, 0.7)' }}
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="relative flex-1 overflow-y-auto px-3 py-4 space-y-6">

        {/* Navigation Links */}
        <nav>
          <p
            className="text-xs font-semibold mb-2 px-2 uppercase tracking-wider"
            style={{ color: 'rgba(201, 168, 76, 0.5)', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
          >
            {isArabic ? 'التنقل' : 'Navigation'}
          </p>
          <ul className="space-y-1">
            {navItems.map(({ to, labelKey, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'active' : ''} ${isArabic ? 'flex-row-reverse' : ''}`
                  }
                  onClick={onClose}
                >
                  <Icon size={18} />
                  <span
                    style={{
                      fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                      fontSize: '0.9rem',
                    }}
                  >
                    {t(labelKey)}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(201, 168, 76, 0.15)' }} />

        {/* Quick Topics */}
        <div>
          <p
            className="text-xs font-semibold mb-3 px-2 uppercase tracking-wider"
            style={{
              color: 'rgba(201, 168, 76, 0.5)',
              fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
            }}
          >
            {isArabic ? 'الأبواب الفقهية' : 'Fiqh Topics'}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {TOPICS.map(({ key, icon }) => (
              <motion.button
                key={key}
                onClick={() => handleTopicClick(key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${isArabic ? 'flex-row-reverse' : ''}`}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(201, 168, 76, 0.1)',
                  color: 'rgba(212, 230, 217, 0.8)',
                  fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                }}
                whileHover={{
                  background: 'rgba(201, 168, 76, 0.12)',
                  borderColor: 'rgba(201, 168, 76, 0.3)',
                  color: '#C9A84C',
                }}
                whileTap={{ scale: 0.97 }}
              >
                <span className="text-base leading-none">{icon}</span>
                <span className="leading-tight">{t(`topics.${key}`)}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(201, 168, 76, 0.15)' }} />

        {/* Suggested Questions */}
        <div>
          <p
            className="text-xs font-semibold mb-3 px-2 uppercase tracking-wider"
            style={{
              color: 'rgba(201, 168, 76, 0.5)',
              fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
            }}
          >
            {t('chat.suggested_questions')}
          </p>
          <div className="space-y-1.5">
            {(['q1', 'q2', 'q3'] as const).map((qKey) => (
              <motion.button
                key={qKey}
                onClick={() => {
                  navigate('/', { state: { prefillQuestion: t(`suggested.${qKey}`) } });
                  onClose();
                }}
                className={`w-full text-start px-3 py-2 rounded-lg text-xs leading-relaxed transition-all ${isArabic ? 'text-right' : 'text-left'}`}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(201, 168, 76, 0.08)',
                  color: 'rgba(212, 230, 217, 0.65)',
                  fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                }}
                whileHover={{
                  background: 'rgba(201, 168, 76, 0.08)',
                  color: 'rgba(212, 230, 217, 0.9)',
                }}
                whileTap={{ scale: 0.98 }}
              >
                <div className={`flex items-start gap-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
                  <ChevronIcon size={12} className="mt-0.5 flex-shrink-0 opacity-50" />
                  <span>{t(`suggested.${qKey}`)}</span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="relative px-4 py-3"
        style={{ borderTop: '1px solid rgba(201, 168, 76, 0.15)' }}
      >
        <p
          className="text-center text-xs"
          style={{
            color: 'rgba(201, 168, 76, 0.3)',
            fontFamily: isArabic ? "'Scheherazade New', serif" : "'Inter', sans-serif",
          }}
        >
          {isArabic ? 'وَفَوْقَ كُلِّ ذِي عِلْمٍ عَلِيمٌ' : t('app.version')}
        </p>
      </div>
    </div>
  );
}
