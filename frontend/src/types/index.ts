// ============================================================
// Core domain types matching the backend schemas
// ============================================================

export type Language = 'ar' | 'en';

export type Madhab = 'hanafi' | 'maliki' | 'shafii' | 'hanbali' | 'general';

export interface Scholar {
  id: string;
  name_ar: string;
  name_en?: string;
  madhab: Madhab;
  era?: string;
  death_year?: string;
  description_ar?: string;
  description_en?: string;
  books?: Book[];
}

export interface Book {
  id: string;
  title_ar: string;
  title_en?: string;
  author_id: string;
  author_name?: string;
  edition?: string;
  publisher?: string;
  year?: number;
  chunks_count?: number;
  uploaded_at?: string;
}

export interface Reference {
  scholar_name?: string;
  book_title?: string;
  madhab?: Madhab;
  juz?: string | number;
  volume?: string | number;
  page?: string | number;
  section?: string;
  chapter?: string;
  edition?: string;
  publisher?: string;
  text_excerpt?: string;
  chunk_id?: string;
  relevance_score?: number;
}

export interface ScholarOpinion {
  madhab: Madhab;
  scholar: string;
  scholar_arabic?: string;
  opinion: string;
  opinion_arabic?: string;
  evidence?: string;
  evidence_arabic?: string;
  reference?: string;
}

export interface ScholarComparison {
  topic: string;
  topic_arabic?: string;
  opinions: ScholarOpinion[];
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  references?: Reference[];
  comparison?: ScholarComparison;
  isStreaming?: boolean;
}

export interface ChatRequest {
  query: string;
  conversation_id?: string;
  language?: Language;
  include_comparison?: boolean;
}

export interface ChatResponse {
  answer: string;
  references: Reference[];
  comparison?: ScholarComparison;
  conversation_id: string;
  language: Language;
}

// ============================================================
// App state types
// ============================================================

export interface ConversationSummary {
  id: string;
  title: string;
  title_ar?: string;
  last_message: string;
  timestamp: Date;
  message_count: number;
}

export interface AppState {
  language: Language;
  sidebarOpen: boolean;
  currentConversationId: string | null;
  conversations: ConversationSummary[];
}

// ============================================================
// Upload types
// ============================================================

export interface BookUploadFormData {
  title_arabic: string;
  title_english: string;
  author_arabic: string;
  author_english: string;
  madhab: Madhab | '';
  edition: string;
  publisher: string;
  year: string;
  file: File | null;
}

export interface UploadProgress {
  percentage: number;
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  message?: string;
}

// ============================================================
// Utility types
// ============================================================

export type MadhabColors = Record<Madhab, { bg: string; text: string; border: string; label_ar: string; label_en: string }>;
