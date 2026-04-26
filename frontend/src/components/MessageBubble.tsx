import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, CheckCheck, BookOpen, Scale, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ChatMessage, Language } from '../types';
import ReferenceCard from './ReferenceCard';
import ScholarComparisonTable from './ScholarComparisonTable';

interface MessageBubbleProps {
  message: ChatMessage;
  language: Language;
}

function ThinkingAnimation({ isArabic }: { isArabic: boolean }) {
  return (
    <div className={`flex items-center gap-3 p-4 ${isArabic ? 'flex-row-reverse' : ''}`}>
      {/* Spinning arabesque */}
      <div
        className="w-8 h-8 flex-shrink-0 spin-slow"
        style={{ color: '#C9A84C' }}
      >
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon
            points="16,2 18.9,9.8 26.9,9.8 20.5,14.5 22.9,22.4 16,17.9 9.1,22.4 11.5,14.5 5.1,9.8 13.1,9.8"
            fill="#C9A84C"
            fillOpacity="0.7"
          />
          <circle cx="16" cy="16" r="14" stroke="#C9A84C" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="3,4" />
        </svg>
      </div>
      <div className={`${isArabic ? 'text-right' : 'text-left'}`}>
        <p
          className="text-sm font-medium"
          style={{
            color: '#1B4332',
            fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
          }}
        >
          {isArabic ? 'يبحث في المصادر...' : 'Searching sources...'}
        </p>
        <div className="thinking-dots mt-1">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

export default function MessageBubble({ message, language }: MessageBubbleProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [refsExpanded, setRefsExpanded] = useState(false);
  const [comparisonExpanded, setComparisonExpanded] = useState(false);
  const isArabic = language === 'ar';
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success(t('chat.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(isArabic ? 'تعذر النسخ' : 'Copy failed');
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat(isArabic ? 'ar-SA' : 'en', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const hasRefs = message.references && message.references.length > 0;
  const hasComparison = message.comparison && message.comparison.opinions.length > 0;

  if (isUser) {
    return (
      <motion.div
        className={`flex ${isArabic ? 'justify-start' : 'justify-end'} mb-4`}
        initial={{ opacity: 0, y: 10, x: isArabic ? -10 : 10 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className={`max-w-[75%] sm:max-w-[65%] ${isArabic ? 'items-start' : 'items-end'} flex flex-col gap-1`}>
          <div className="chat-bubble-user px-4 py-3">
            <p
              className="text-sm sm:text-base leading-relaxed"
              style={{
                fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                lineHeight: isArabic ? '1.9' : '1.6',
                direction: isArabic ? 'rtl' : 'ltr',
                textAlign: isArabic ? 'right' : 'left',
              }}
            >
              {message.content}
            </p>
          </div>
          <span
            className="text-xs px-1"
            style={{ color: 'rgba(45, 27, 14, 0.4)', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
          >
            {formatTime(message.timestamp)}
          </span>
        </div>
      </motion.div>
    );
  }

  // Bot message
  return (
    <motion.div
      className={`flex ${isArabic ? 'justify-end' : 'justify-start'} mb-6`}
      initial={{ opacity: 0, y: 10, x: isArabic ? 10 : -10 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={`max-w-[85%] sm:max-w-[78%] flex flex-col gap-1 ${isArabic ? 'items-end' : 'items-start'}`}>
        {/* Bot avatar label */}
        <div
          className={`flex items-center gap-1.5 px-1 mb-0.5 ${isArabic ? 'flex-row-reverse' : ''}`}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: '#1B4332' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <polygon
                points="6,0.5 7.1,3.7 10.5,3.7 7.8,5.7 8.8,8.9 6,7 3.2,8.9 4.2,5.7 1.5,3.7 4.9,3.7"
                fill="#C9A84C"
              />
            </svg>
          </div>
          <span
            className="text-xs font-semibold"
            style={{ color: '#1B4332', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
          >
            {isArabic ? 'مساعد الفقيه' : 'Fiqh Assistant'}
          </span>
        </div>

        {/* Message card */}
        <div className="chat-bubble-bot w-full">
          {/* Content */}
          <div className="px-4 pt-4 pb-2">
            {message.isStreaming && !message.content ? (
              <ThinkingAnimation isArabic={isArabic} />
            ) : (
              <div
                className={isArabic ? 'prose-arabic' : 'prose-english'}
                dir={isArabic ? 'rtl' : 'ltr'}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => (
                      <p
                        style={{
                          marginBottom: '0.75em',
                          lineHeight: isArabic ? '2' : '1.65',
                          fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                          fontSize: isArabic ? '1rem' : '0.9375rem',
                          color: '#2D1B0E',
                          direction: isArabic ? 'rtl' : 'ltr',
                          textAlign: isArabic ? 'right' : 'left',
                        }}
                      >
                        {children}
                      </p>
                    ),
                    h1: ({ children }) => (
                      <h1
                        style={{
                          fontFamily: isArabic ? "'Scheherazade New', serif" : "'Inter', sans-serif",
                          color: '#1B4332',
                          fontSize: isArabic ? '1.4rem' : '1.25rem',
                          fontWeight: 700,
                          marginBottom: '0.5em',
                          marginTop: '1em',
                          direction: isArabic ? 'rtl' : 'ltr',
                          textAlign: isArabic ? 'right' : 'left',
                        }}
                      >
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2
                        style={{
                          fontFamily: isArabic ? "'Scheherazade New', serif" : "'Inter', sans-serif",
                          color: '#1B4332',
                          fontSize: isArabic ? '1.2rem' : '1.1rem',
                          fontWeight: 700,
                          marginBottom: '0.4em',
                          marginTop: '0.8em',
                          direction: isArabic ? 'rtl' : 'ltr',
                          textAlign: isArabic ? 'right' : 'left',
                        }}
                      >
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3
                        style={{
                          fontFamily: isArabic ? "'Scheherazade New', serif" : "'Inter', sans-serif",
                          color: '#1B4332',
                          fontSize: isArabic ? '1.1rem' : '1rem',
                          fontWeight: 600,
                          marginBottom: '0.3em',
                          marginTop: '0.7em',
                          direction: isArabic ? 'rtl' : 'ltr',
                          textAlign: isArabic ? 'right' : 'left',
                        }}
                      >
                        {children}
                      </h3>
                    ),
                    strong: ({ children }) => (
                      <strong style={{ color: '#1B4332', fontWeight: 700 }}>{children}</strong>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote
                        style={{
                          borderRight: isArabic ? '4px solid #C9A84C' : 'none',
                          borderLeft: isArabic ? 'none' : '4px solid #C9A84C',
                          background: '#F8F4ED',
                          borderRadius: '0.5rem',
                          padding: isArabic ? '0.75rem 1rem 0.75rem 0.75rem' : '0.75rem 0.75rem 0.75rem 1rem',
                          marginBottom: '0.75em',
                          fontFamily: isArabic ? "'Scheherazade New', serif" : "'Inter', sans-serif",
                          fontSize: isArabic ? '1.05rem' : '0.9rem',
                          lineHeight: isArabic ? '2' : '1.6',
                          color: '#2D1B0E',
                          direction: isArabic ? 'rtl' : 'ltr',
                          textAlign: isArabic ? 'right' : 'left',
                        }}
                      >
                        {children}
                      </blockquote>
                    ),
                    ul: ({ children }) => (
                      <ul
                        style={{
                          paddingRight: isArabic ? '1.25rem' : '0',
                          paddingLeft: isArabic ? '0' : '1.25rem',
                          marginBottom: '0.75em',
                          direction: isArabic ? 'rtl' : 'ltr',
                        }}
                      >
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol
                        style={{
                          paddingRight: isArabic ? '1.25rem' : '0',
                          paddingLeft: isArabic ? '0' : '1.25rem',
                          marginBottom: '0.75em',
                          direction: isArabic ? 'rtl' : 'ltr',
                        }}
                      >
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li
                        style={{
                          marginBottom: '0.35em',
                          lineHeight: isArabic ? '1.9' : '1.5',
                          fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                          fontSize: isArabic ? '1rem' : '0.9375rem',
                          color: '#2D1B0E',
                          direction: isArabic ? 'rtl' : 'ltr',
                          textAlign: isArabic ? 'right' : 'left',
                        }}
                      >
                        {children}
                      </li>
                    ),
                    code: ({ children, className }) => {
                      const isBlock = className?.includes('language-');
                      if (isBlock) {
                        return (
                          <pre
                            style={{
                              background: '#F3F4F6',
                              borderRadius: '0.5rem',
                              padding: '0.75rem 1rem',
                              overflowX: 'auto',
                              marginBottom: '0.75em',
                              direction: 'ltr',
                              textAlign: 'left',
                            }}
                          >
                            <code style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#1B4332' }}>
                              {children}
                            </code>
                          </pre>
                        );
                      }
                      return (
                        <code
                          style={{
                            background: '#F3F4F6',
                            borderRadius: '0.25rem',
                            padding: '0.1rem 0.35rem',
                            fontFamily: 'monospace',
                            fontSize: '0.85em',
                            color: '#1B4332',
                          }}
                        >
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>

                {/* Streaming cursor */}
                {message.isStreaming && message.content && (
                  <span
                    className="inline-block w-0.5 h-4 ml-0.5 animate-pulse"
                    style={{ background: '#C9A84C', verticalAlign: 'middle' }}
                  />
                )}
              </div>
            )}
          </div>

          {/* Bottom toolbar */}
          {!message.isStreaming && message.content && (
            <div
              className={`flex items-center gap-2 px-4 py-2 border-t ${isArabic ? 'flex-row-reverse' : ''}`}
              style={{ borderColor: '#F0E8D8' }}
            >
              {/* Timestamp */}
              <span
                className="text-xs flex-1"
                style={{
                  color: 'rgba(45, 27, 14, 0.35)',
                  fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                  textAlign: isArabic ? 'right' : 'left',
                }}
              >
                {formatTime(message.timestamp)}
              </span>

              {/* References toggle */}
              {hasRefs && (
                <button
                  onClick={() => setRefsExpanded(v => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isArabic ? 'flex-row-reverse' : ''}`}
                  style={{
                    background: refsExpanded ? 'rgba(27, 67, 50, 0.1)' : 'transparent',
                    color: '#1B4332',
                    border: '1px solid rgba(27, 67, 50, 0.15)',
                    fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                  }}
                >
                  <BookOpen size={12} />
                  <span>{t('references.title')}</span>
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
                    style={{ background: '#1B4332', color: '#C9A84C' }}
                  >
                    {message.references!.length}
                  </span>
                  {refsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              )}

              {/* Comparison toggle */}
              {hasComparison && (
                <button
                  onClick={() => setComparisonExpanded(v => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isArabic ? 'flex-row-reverse' : ''}`}
                  style={{
                    background: comparisonExpanded ? 'rgba(201, 168, 76, 0.12)' : 'transparent',
                    color: '#b8922e',
                    border: '1px solid rgba(201, 168, 76, 0.25)',
                    fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                  }}
                >
                  <Scale size={12} />
                  <span>{t('comparison.title')}</span>
                  {comparisonExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              )}

              {/* Copy button */}
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg transition-colors hover:bg-gray-50"
                style={{ color: 'rgba(45, 27, 14, 0.4)' }}
                title={t('chat.copy')}
                aria-label={t('chat.copy')}
              >
                {copied ? <CheckCheck size={14} style={{ color: '#1B4332' }} /> : <Copy size={14} />}
              </button>
            </div>
          )}
        </div>

        {/* References section */}
        <AnimatePresence>
          {refsExpanded && hasRefs && (
            <motion.div
              className="w-full space-y-2 mt-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-wide px-1 mb-1 ${isArabic ? 'text-right' : 'text-left'}`}
                style={{ color: 'rgba(27, 67, 50, 0.6)', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
              >
                {t('references.title')} ({message.references!.length})
              </p>
              {message.references!.map((ref, idx) => (
                <ReferenceCard
                  key={idx}
                  reference={ref}
                  index={idx}
                  language={language}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Comparison section */}
        <AnimatePresence>
          {comparisonExpanded && hasComparison && (
            <motion.div
              className="w-full mt-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ScholarComparisonTable
                comparison={message.comparison!}
                language={language}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timestamp (below card) */}
        <span
          className="text-xs px-1"
          style={{ color: 'rgba(45, 27, 14, 0.35)', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
        >
          {formatTime(message.timestamp)}
        </span>
      </div>
    </motion.div>
  );
}
