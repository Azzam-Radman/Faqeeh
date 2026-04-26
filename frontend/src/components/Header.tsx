import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Menu, BookOpen, Globe } from 'lucide-react';
import IslamicPattern from './IslamicPattern';
import type { Language } from '../types';

interface HeaderProps {
  language: Language;
  onToggleLanguage: () => void;
  onMenuToggle: () => void;
}

export default function Header({ language, onToggleLanguage, onMenuToggle }: HeaderProps) {
  const { t } = useTranslation();
  const isArabic = language === 'ar';

  return (
    <header
      className="fixed top-0 left-0 right-0 z-30 islamic-pattern-header"
      style={{
        height: '64px',
        background: 'linear-gradient(135deg, #1B4332 0%, #0F2419 100%)',
        borderBottom: '2px solid rgba(201, 168, 76, 0.3)',
      }}
    >
      {/* Decorative pattern overlay */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <IslamicPattern opacity={0.12} color="#C9A84C" size={60} />
      </div>

      <div className="relative flex items-center h-full px-4 gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg text-islamic-gold-400 hover:bg-white/10 transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={22} />
        </button>

        {/* Logo / Title */}
        <div className={`flex items-center gap-3 flex-1 ${isArabic ? 'flex-row-reverse md:flex-row' : 'flex-row'}`}>
          {/* Icon */}
          <motion.div
            className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{ background: 'rgba(201, 168, 76, 0.2)', border: '1px solid rgba(201, 168, 76, 0.4)' }}
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <BookOpen size={20} color="#C9A84C" />
          </motion.div>

          {/* Title block */}
          <div className={`flex flex-col ${isArabic ? 'items-end md:items-start' : 'items-start'}`}>
            {/* Bismillah (tiny, above title) */}
            <span
              className="hidden sm:block text-[10px] leading-none mb-0.5"
              style={{
                color: 'rgba(201, 168, 76, 0.7)',
                fontFamily: "'Scheherazade New', serif",
                letterSpacing: '0.05em',
              }}
            >
              {t('app.bismillah')}
            </span>

            {/* Main title */}
            <h1
              className="text-lg sm:text-xl font-bold leading-tight"
              style={{
                color: '#C9A84C',
                fontFamily: isArabic ? "'Scheherazade New', serif" : "'Inter', sans-serif",
                textShadow: '0 2px 8px rgba(201, 168, 76, 0.3)',
              }}
            >
              {t('app.title')}
            </h1>

            {/* Subtitle */}
            <p
              className="hidden sm:block text-[11px] leading-none"
              style={{
                color: 'rgba(212, 230, 217, 0.7)',
                fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
              }}
            >
              {t('app.subtitle')}
            </p>
          </div>
        </div>

        {/* Right side: decorative divider + language toggle */}
        <div className="flex items-center gap-3">
          {/* Decorative star */}
          <div
            className="hidden md:flex items-center justify-center w-8 h-8"
            style={{ color: 'rgba(201, 168, 76, 0.4)' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <polygon
                points="10,1 12.2,7.2 18.5,7.2 13.5,11.1 15.4,17.5 10,13.8 4.6,17.5 6.5,11.1 1.5,7.2 7.8,7.2"
                fill="#C9A84C"
                fillOpacity="0.5"
              />
            </svg>
          </div>

          {/* Language Toggle Button */}
          <motion.button
            onClick={onToggleLanguage}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-all"
            style={{
              background: 'rgba(201, 168, 76, 0.15)',
              border: '1px solid rgba(201, 168, 76, 0.4)',
              color: '#C9A84C',
              fontFamily: isArabic ? "'Inter', sans-serif" : "'Cairo', sans-serif",
            }}
            whileHover={{
              background: 'rgba(201, 168, 76, 0.25)',
              scale: 1.03,
            }}
            whileTap={{ scale: 0.97 }}
          >
            <Globe size={15} />
            <span>{t('app.language_toggle')}</span>
          </motion.button>
        </div>
      </div>
    </header>
  );
}
