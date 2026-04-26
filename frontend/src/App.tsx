import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import type { Language } from './types';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatPage from './pages/ChatPage';
import LibraryPage from './pages/LibraryPage';
import ScholarsPage from './pages/ScholarsPage';

export default function App() {
  const { i18n } = useTranslation();
  const location = useLocation();
  const [language, setLanguage] = useState<Language>('ar');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Initialize language from storage
  useEffect(() => {
    const stored = localStorage.getItem('faqeeh-language') as Language | null;
    if (stored && (stored === 'ar' || stored === 'en')) {
      setLanguage(stored);
      applyLanguage(stored);
    }
  }, []);

  const applyLanguage = useCallback((lang: Language) => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.body.style.fontFamily =
      lang === 'ar' ? "'Cairo', sans-serif" : "'Inter', 'Cairo', sans-serif";
  }, []);

  const toggleLanguage = useCallback(() => {
    const newLang: Language = language === 'ar' ? 'en' : 'ar';
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
    localStorage.setItem('faqeeh-language', newLang);
    applyLanguage(newLang);
  }, [language, i18n, applyLanguage]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#F8F4ED', fontFamily: language === 'ar' ? "'Cairo', sans-serif" : "'Inter', 'Cairo', sans-serif" }}
    >
      <Toaster
        position={language === 'ar' ? 'top-left' : 'top-right'}
        toastOptions={{
          style: {
            background: '#FFFFFF',
            color: '#2D1B0E',
            border: '1px solid #E8DDD0',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 25px rgba(45, 27, 14, 0.1)',
            fontFamily: language === 'ar' ? "'Cairo', sans-serif" : "'Inter', sans-serif",
            direction: language === 'ar' ? 'rtl' : 'ltr',
          },
          success: {
            iconTheme: { primary: '#1B4332', secondary: '#C9A84C' },
          },
          error: {
            iconTheme: { primary: '#dc2626', secondary: '#fee2e2' },
          },
          duration: 3000,
        }}
      />

      <Header language={language} onToggleLanguage={toggleLanguage} onMenuToggle={() => setSidebarOpen(v => !v)} />

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 64px)', marginTop: '64px' }}>
        {/* Sidebar overlay for mobile */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              className="fixed inset-0 z-40 md:hidden sidebar-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <div
          className={`
            fixed md:relative z-50 md:z-auto h-full
            transition-transform duration-300 ease-in-out
            ${language === 'ar'
              ? `right-0 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`
              : `left-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`
            }
          `}
          style={{ width: '280px', flexShrink: 0 }}
        >
          <Sidebar language={language} onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route
                path="/"
                element={
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="h-full"
                  >
                    <ChatPage language={language} />
                  </motion.div>
                }
              />
              <Route
                path="/library"
                element={
                  <motion.div
                    key="library"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="h-full overflow-auto"
                  >
                    <LibraryPage language={language} />
                  </motion.div>
                }
              />
              <Route
                path="/scholars"
                element={
                  <motion.div
                    key="scholars"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="h-full overflow-auto"
                  >
                    <ScholarsPage language={language} />
                  </motion.div>
                }
              />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
