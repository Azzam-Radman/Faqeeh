import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Send, Trash2, Plus, StopCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Language } from '../types';
import { useChat } from '../hooks/useChat';
import MessageBubble from './MessageBubble';

interface ChatInterfaceProps {
  language: Language;
  prefillQuestion?: string;
}

const SUGGESTED_QUESTIONS_AR = [
  'ما حكم صلاة الجماعة؟',
  'ما هي شروط صحة الوضوء؟',
  'ما نصاب الزكاة في الذهب والفضة؟',
  'ما حكم صيام من أفطر ناسياً؟',
  'ما شروط صحة عقد النكاح؟',
  'ما الفرق بين الطلاق الرجعي والبائن؟',
];

const SUGGESTED_QUESTIONS_EN = [
  'What is the ruling on congregational prayer?',
  'What are the conditions for a valid ablution (wudu)?',
  'What is the nisab for gold and silver zakat?',
  'What is the ruling for one who breaks fast forgetfully?',
  'What are the conditions for a valid marriage contract?',
  'What is the difference between revocable and irrevocable divorce?',
];

export default function ChatInterface({ language, prefillQuestion }: ChatInterfaceProps) {
  const { t } = useTranslation();
  const isArabic = language === 'ar';
  const [input, setInput] = useState('');
  const [includeComparison, setIncludeComparison] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { messages, isLoading, sendMessage, clearConversation, cancelStreaming } = useChat({ language });

  const suggestedQuestions = isArabic ? SUGGESTED_QUESTIONS_AR : SUGGESTED_QUESTIONS_EN;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle prefill from sidebar
  useEffect(() => {
    if (prefillQuestion) {
      setInput(prefillQuestion);
      textareaRef.current?.focus();
    }
  }, [prefillQuestion]);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  const handleSend = async () => {
    const q = input.trim();
    if (!q || isLoading) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessage(q, { includeComparison });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    clearConversation();
    toast.success(isArabic ? 'تم مسح المحادثة' : 'Conversation cleared');
  };

  const handleSuggestedQuestion = (q: string) => {
    setInput(q);
    textareaRef.current?.focus();
    adjustTextareaHeight();
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full" style={{ background: '#F8F4ED' }}>
      {/* Top bar */}
      {!isEmpty && (
        <div
          className={`flex items-center justify-between px-4 py-2 border-b ${isArabic ? 'flex-row-reverse' : ''}`}
          style={{ borderColor: '#E8DDD0', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)' }}
        >
          <span
            className="text-sm font-medium"
            style={{ color: 'rgba(45, 27, 14, 0.5)', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
          >
            {isArabic ? `${messages.filter(m => m.role === 'user').length} سؤال` : `${messages.filter(m => m.role === 'user').length} question${messages.filter(m => m.role === 'user').length !== 1 ? 's' : ''}`}
          </span>
          <div className={`flex items-center gap-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
            <button
              onClick={handleClear}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isArabic ? 'flex-row-reverse' : ''}`}
              style={{
                color: 'rgba(45, 27, 14, 0.5)',
                fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                border: '1px solid #E8DDD0',
                background: 'white',
              }}
            >
              <Trash2 size={12} />
              <span>{t('chat.clear')}</span>
            </button>
            <button
              onClick={() => { clearConversation(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isArabic ? 'flex-row-reverse' : ''}`}
              style={{
                color: '#1B4332',
                fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                border: '1px solid rgba(27, 67, 50, 0.2)',
                background: 'rgba(27, 67, 50, 0.05)',
              }}
            >
              <Plus size={12} />
              <span>{t('chat.new_conversation')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6" style={{ minHeight: 0 }}>
        {/* Empty state */}
        <AnimatePresence>
          {isEmpty && (
            <motion.div
              className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
            >
              {/* Decorative star */}
              <motion.div
                className="mb-6"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              >
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                  <polygon
                    points="32,4 36.2,18.4 50.9,18.4 39.4,27.2 43.7,41.6 32,33 20.3,41.6 24.6,27.2 13.1,18.4 27.8,18.4"
                    fill="#C9A84C"
                    fillOpacity="0.8"
                  />
                  <circle cx="32" cy="32" r="29" stroke="#1B4332" strokeOpacity="0.12" strokeWidth="1.5" strokeDasharray="4,6" />
                  <circle cx="32" cy="32" r="20" stroke="#C9A84C" strokeOpacity="0.15" strokeWidth="1" />
                </svg>
              </motion.div>

              {/* Bismillah */}
              <p
                className="text-xl mb-3"
                style={{
                  fontFamily: "'Scheherazade New', serif",
                  color: 'rgba(27, 67, 50, 0.5)',
                  direction: 'rtl',
                }}
              >
                {t('app.bismillah')}
              </p>

              {/* Title */}
              <h2
                className="text-2xl sm:text-3xl font-bold mb-2"
                style={{
                  fontFamily: isArabic ? "'Scheherazade New', serif" : "'Inter', sans-serif",
                  color: '#1B4332',
                }}
              >
                {t('chat.empty_title')}
              </h2>

              <p
                className="text-sm mb-8 max-w-md leading-relaxed"
                style={{
                  color: 'rgba(45, 27, 14, 0.55)',
                  fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                  lineHeight: isArabic ? '2' : '1.6',
                }}
              >
                {t('chat.empty_subtitle')}
              </p>

              {/* Suggested questions */}
              <div className={`w-full max-w-xl ${isArabic ? 'text-right' : 'text-left'}`}>
                <p
                  className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isArabic ? 'text-right' : 'text-left'}`}
                  style={{ color: 'rgba(27, 67, 50, 0.5)', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
                >
                  {t('chat.suggested_questions')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {suggestedQuestions.map((q, i) => (
                    <motion.button
                      key={i}
                      onClick={() => handleSuggestedQuestion(q)}
                      className={`text-sm px-4 py-3 rounded-xl transition-all ${isArabic ? 'text-right' : 'text-left'}`}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E8DDD0',
                        color: '#2D1B0E',
                        fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                        lineHeight: isArabic ? '1.9' : '1.5',
                        boxShadow: '0 2px 8px rgba(45, 27, 14, 0.04)',
                        direction: isArabic ? 'rtl' : 'ltr',
                      }}
                      whileHover={{
                        borderColor: '#C9A84C',
                        boxShadow: '0 4px 16px rgba(201, 168, 76, 0.15)',
                        y: -1,
                      }}
                      whileTap={{ scale: 0.98 }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 + 0.3 }}
                    >
                      {q}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message list */}
        {!isEmpty && (
          <div className="max-w-3xl mx-auto">
            {messages.map(message => (
              <MessageBubble
                key={message.id}
                message={message}
                language={language}
              />
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="px-4 pb-4 pt-3"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid #E8DDD0',
        }}
      >
        <div className="max-w-3xl mx-auto">
          {/* Comparison toggle */}
          <div className={`flex items-center gap-2 mb-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
            <button
              onClick={() => setIncludeComparison(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isArabic ? 'flex-row-reverse' : ''}`}
              style={{
                background: includeComparison ? 'rgba(201, 168, 76, 0.15)' : 'transparent',
                border: `1px solid ${includeComparison ? 'rgba(201, 168, 76, 0.4)' : '#E8DDD0'}`,
                color: includeComparison ? '#b8922e' : 'rgba(45, 27, 14, 0.45)',
                fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
              }}
            >
              <span>{isArabic ? 'مقارنة المذاهب' : 'Compare Schools'}</span>
            </button>
          </div>

          {/* Input row */}
          <div
            className={`flex items-end gap-3 ${isArabic ? 'flex-row-reverse' : ''}`}
          >
            <div
              className="flex-1 relative"
              style={{
                background: '#FFFFFF',
                border: '1.5px solid #E8DDD0',
                borderRadius: '1rem',
                boxShadow: '0 2px 12px rgba(45, 27, 14, 0.06)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocusCapture={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = '#C9A84C';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(201, 168, 76, 0.12)';
              }}
              onBlurCapture={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = '#E8DDD0';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(45, 27, 14, 0.06)';
              }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.placeholder')}
                rows={1}
                className="w-full px-4 py-3 bg-transparent border-0 outline-none resize-none"
                style={{
                  fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                  fontSize: isArabic ? '1rem' : '0.9375rem',
                  lineHeight: isArabic ? '1.9' : '1.6',
                  color: '#2D1B0E',
                  direction: isArabic ? 'rtl' : 'ltr',
                  textAlign: isArabic ? 'right' : 'left',
                  maxHeight: '160px',
                  minHeight: '48px',
                }}
                disabled={isLoading}
              />
            </div>

            {/* Send / Stop button */}
            <motion.button
              onClick={isLoading ? cancelStreaming : handleSend}
              disabled={!isLoading && !input.trim()}
              className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all"
              style={{
                background:
                  isLoading
                    ? 'rgba(220, 38, 38, 0.9)'
                    : input.trim()
                    ? 'linear-gradient(135deg, #1B4332 0%, #0F2419 100%)'
                    : '#E8DDD0',
                color: input.trim() || isLoading ? '#C9A84C' : 'rgba(45, 27, 14, 0.3)',
                boxShadow: (input.trim() || isLoading) ? '0 4px 16px rgba(27, 67, 50, 0.3)' : 'none',
                cursor: !isLoading && !input.trim() ? 'not-allowed' : 'pointer',
              }}
              whileHover={input.trim() || isLoading ? { scale: 1.05 } : {}}
              whileTap={input.trim() || isLoading ? { scale: 0.95 } : {}}
            >
              {isLoading ? <StopCircle size={20} /> : <Send size={18} style={{ transform: isArabic ? 'scaleX(-1)' : 'none' }} />}
            </motion.button>
          </div>

          {/* Footer note */}
          <p
            className={`text-xs mt-2 ${isArabic ? 'text-right' : 'text-left'}`}
            style={{ color: 'rgba(45, 27, 14, 0.35)', fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
          >
            {isArabic
              ? 'المعلومات للاسترشاد فقط • استشر عالماً متخصصاً للمسائل الجوهرية'
              : 'For guidance only • Consult a qualified scholar for important matters'}
          </p>
        </div>
      </div>
    </div>
  );
}
