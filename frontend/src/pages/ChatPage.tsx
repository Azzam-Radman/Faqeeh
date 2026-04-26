import React, { useState } from 'react';
import type { Language } from '../types';
import ChatInterface from '../components/ChatInterface';

interface ChatPageProps {
  language: Language;
}

export default function ChatPage({ language }: ChatPageProps) {
  const [prefillQuestion, setPrefillQuestion] = useState<string | undefined>();

  return (
    <div className="h-full flex flex-col">
      <ChatInterface
        language={language}
        prefillQuestion={prefillQuestion}
      />
    </div>
  );
}
