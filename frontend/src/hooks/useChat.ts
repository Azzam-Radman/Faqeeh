import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, Reference, ScholarComparison, Language } from '../types';

interface UseChatOptions {
  language: Language;
}

interface SendMessageOptions {
  includeComparison?: boolean;
  retries?: number;
}

export function useChat({ language }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId] = useState<string>(uuidv4());
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (query: string, options: SendMessageOptions = {}) => {
      if (!query.trim() || isLoading) return;

      // Cancel any in-progress streaming
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: query.trim(),
        timestamp: new Date(),
      };

      const botMessageId = uuidv4();
      const botMessage: ChatMessage = {
        id: botMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages(prev => [...prev, userMessage, botMessage]);
      setIsLoading(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            query: query.trim(),
            conversation_id: conversationId,
            language,
            stream: true,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';

        // Handle SSE streaming
        if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
          const reader = response.body?.getReader();
          if (!reader) throw new Error('No response body');

          const decoder = new TextDecoder();
          let accumulatedContent = '';
          let references: Reference[] = [];
          let comparison: ScholarComparison | undefined;
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') {
                  break;
                }
                try {
                  const parsed = JSON.parse(data);

                  if (parsed.type === 'token' || parsed.token !== undefined) {
                    accumulatedContent += parsed.token || parsed.content || '';
                  } else if (parsed.type === 'references') {
                    references = parsed.references || [];
                  } else if (parsed.type === 'comparison') {
                    comparison = parsed.comparison;
                  } else if (parsed.type === 'done' || parsed.answer !== undefined) {
                    // Final message
                    if (parsed.answer) accumulatedContent = parsed.answer;
                    if (parsed.references) references = parsed.references;
                    if (parsed.comparison) comparison = parsed.comparison;
                  } else if (typeof parsed === 'string') {
                    accumulatedContent += parsed;
                  } else if (parsed.content) {
                    accumulatedContent += parsed.content;
                  }

                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === botMessageId
                        ? {
                            ...msg,
                            content: accumulatedContent,
                            references: references.length > 0 ? references : msg.references,
                            comparison: comparison || msg.comparison,
                          }
                        : msg,
                    ),
                  );
                } catch {
                  // Plain text token
                  if (data && data !== '[DONE]') {
                    accumulatedContent += data;
                    setMessages(prev =>
                      prev.map(msg =>
                        msg.id === botMessageId
                          ? { ...msg, content: accumulatedContent }
                          : msg,
                      ),
                    );
                  }
                }
              }
            }
          }

          // Finalize the bot message
          setMessages(prev =>
            prev.map(msg =>
              msg.id === botMessageId
                ? {
                    ...msg,
                    content: accumulatedContent || msg.content,
                    references,
                    comparison,
                    isStreaming: false,
                  }
                : msg,
            ),
          );
        } else {
          // Fallback: JSON response (non-streaming)
          const data = await response.json();
          setMessages(prev =>
            prev.map(msg =>
              msg.id === botMessageId
                ? {
                    ...msg,
                    content: data.answer || '',
                    references: data.references || [],
                    comparison: data.comparison,
                    isStreaming: false,
                  }
                : msg,
            ),
          );
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          // User cancelled - keep whatever content was accumulated
          setMessages(prev =>
            prev.map(msg =>
              msg.id === botMessageId ? { ...msg, isStreaming: false } : msg,
            ),
          );
          return;
        }

        const errorMessage =
          language === 'ar'
            ? 'حدث خطأ أثناء معالجة سؤالك. يرجى المحاولة مرة أخرى.'
            : 'An error occurred while processing your question. Please try again.';

        if ((options.retries ?? 1) > 0) {
          await sendMessage(query, { ...options, retries: (options.retries ?? 1) - 1 });
          return;
        }
        setMessages(prev =>
          prev.map(msg =>
            msg.id === botMessageId
              ? { ...msg, content: errorMessage, isStreaming: false }
              : msg,
          ),
        );
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [isLoading, conversationId, language],
  );

  const clearConversation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setIsLoading(false);
  }, []);

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/chat/${conversationId}/history`);
    if (!res.ok) return;
    const data = await res.json();
    const history = (data.messages || []).map((m: ChatMessage, i: number) => ({
      ...m,
      id: `${conversationId}-${i}`,
      timestamp: new Date(m.timestamp),
    }));
    setMessages(history);
  }, [conversationId]);

  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    messages,
    isLoading,
    conversationId,
    sendMessage,
    clearConversation,
    cancelStreaming,
    loadHistory,
  };
}
