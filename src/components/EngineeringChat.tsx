import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Send, 
  Trash2, 
  MessageSquare, 
  Sparkles, 
  User, 
  BookOpen, 
  BadgeHelp,
  CornerDownLeft,
  Construction
} from 'lucide-react';
import { ChatMessage, PdfPageImage, PDFRequirementsFile, AiModelConfig, PDFDrawingFile } from '../types';
import { encryptWithPublicKey } from '../utils/crypto';
import { auth } from '../utils/firebase';

interface EngineeringChatProps {
  pageImage: PdfPageImage | null;
  uploadedRequirements: PDFRequirementsFile | null;
  aiConfig: AiModelConfig;
  publicKey?: string;
  uploadedFile: PDFDrawingFile | null;
}

export default function EngineeringChat({
  pageImage,
  uploadedRequirements,
  aiConfig,
  publicKey,
  uploadedFile,
}: EngineeringChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);



  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;
    setChatError(null);

    const userMsg: ChatMessage = {
      id: `m-${Date.now()}-u`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let securedApiKey = aiConfig.customKey || '';
      if (securedApiKey && publicKey) {
        try {
          securedApiKey = await encryptWithPublicKey(publicKey, securedApiKey);
        } catch (err) {
          console.warn("Client encryption failed, falling back to secure channel transit:", err);
        }
      }

      let requirementsText = '';
      if (uploadedRequirements) {
        requirementsText = uploadedRequirements.pagesText
          .map(p => `[Standard Page ${p.pageNumber}]\n${p.text}`)
          .join('\n\n');
        
        if (requirementsText.length > 35000) {
          requirementsText = requirementsText.substring(0, 35000) + '\n\n... [Text truncated] ...';
        }
      }

      // Prepare previous conversation history format for API endpoint
      const historyPayload = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      let drawingText = '';
      if (uploadedFile) {
        const activePageText = pageImage ? `[CURRENT ACTIVE VIEWED SHEET - Page ${pageImage.pageNumber}]\n${pageImage.extractedText || ''}\n\n` : '';
        const allSheetsText = uploadedFile.pages
          .map(p => `[Drawing Sheet Page ${p.pageNumber} - name: ${p.name}]\n${p.extractedText || ''}`)
          .join('\n\n');
        
        drawingText = activePageText + '[ALL DRAWING SHEETS EXTRACTED TEXT]\n' + allSheetsText;

        if (drawingText.length > 35000) {
          drawingText = drawingText.substring(0, 35000) + '\n\n... [Drawing text truncated] ...';
        }
      } else if (pageImage) {
        drawingText = pageImage.extractedText || '';
      }

      let token = '';
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        signal: controller.signal,
        body: JSON.stringify({
          image: pageImage?.base64 || null,
          provider: aiConfig.provider,
          apiKey: securedApiKey,
          model: aiConfig.modelName,
          message: textToSend,
          history: historyPayload,
          drawingText,
          requirementsText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Server error while replying to your engineering query.');
      }

      const assistantMsg: ChatMessage = {
        id: `m-${Date.now()}-a`,
        role: 'assistant',
        content: data.reply || "I was unable to retrieve a response from the engineering model.",
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMsg]);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setChatError('Chat response generation stopped by user.');
      } else {
        console.error(err);
        setChatError(err.message || 'Connecting with the structural review model failed.');
      }
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
    }
  };

  const handleClear = () => {
    setMessages([]);
    setChatError(null);
  };

  const currentSheetName = pageImage ? `Sheet ${pageImage.pageNumber}` : 'General Session';

  return (
    <div className="bg-white dark:bg-tokyo-panel border border-slate-200 dark:border-tokyo-border rounded-lg shadow-sm flex flex-col h-[520px] transition-colors duration-150" id="engineering-chat-box">
      {/* Chat header */}
      <div className="bg-slate-900 dark:bg-tokyo-card text-white rounded-t-lg px-4 py-3 flex items-center justify-between shrink-0 border-b dark:border-tokyo-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4.5 w-4.5 text-blue-400 dark:text-tokyo-blue" />
          <div>
            <h4 className="font-semibold text-xs uppercase tracking-wider font-mono">Drawing Co-Pilot Chat</h4>
            <span className="text-[10px] text-slate-400 dark:text-tokyo-muted font-mono">
              Discussing: {currentSheetName}
            </span>
          </div>
        </div>
        
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="text-[10px] text-slate-400 dark:text-tokyo-muted hover:text-red-400 dark:hover:text-tokyo-red font-mono transition-colors border border-slate-700 dark:border-tokyo-border hover:border-red-500/20 dark:hover:border-tokyo-red/20 px-2 py-1 rounded cursor-pointer flex items-center gap-1.5"
            title="Clear Chat Thread"
          >
            <Trash2 className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Messages layout */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40 dark:bg-tokyo-bg/10">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 px-4">
            <span className="p-3 bg-blue-50 dark:bg-tokyo-blue/10 border border-blue-100 dark:border-tokyo-blue/20 rounded-full text-blue-600 dark:text-tokyo-blue animate-pulse">
              <Construction className="h-6 w-6" />
            </span>
            <div className="space-y-1.5 max-w-sm">
              <h5 className="font-semibold text-xs uppercase tracking-widest text-slate-800 dark:text-tokyo-text font-mono">Interactive Blueprint Co-Pilot</h5>
              <p className="text-xs text-slate-555 dark:text-tokyo-muted leading-normal font-sans">
                Ask specific questions about joint details, spacing, material notes, and compare the current sheet directly against reference specification documents.
              </p>
            </div>


          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div 
                  key={msg.id} 
                  className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div className={`h-7 w-7 rounded-sm flex items-center justify-center shrink-0 border text-xs font-semibold ${
                    isUser 
                      ? 'bg-slate-800 dark:bg-tokyo-input text-white dark:text-tokyo-text border-slate-900 dark:border-tokyo-border' 
                      : 'bg-blue-50 dark:bg-tokyo-blue/10 border-blue-200 dark:border-tokyo-blue/20 text-blue-600 dark:text-tokyo-blue'
                  }`}>
                    {isUser ? <User className="h-3.5 w-3.5" /> : <Construction className="h-3.5 w-3.5" />}
                  </div>

                  {/* Bubble wrapper */}
                  <div className="space-y-1">
                    <div className={`rounded-lg px-3.5 py-2.5 text-xs inline-block leading-relaxed font-sans shadow-xs ${
                      isUser
                        ? 'bg-blue-600 dark:bg-tokyo-blue text-white font-medium'
                        : 'bg-white dark:bg-tokyo-input border border-slate-200 dark:border-tokyo-border text-slate-805 dark:text-tokyo-text'
                    }`}>
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="prose prose-sm prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-tokyo-text space-y-2">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                    {/* Timestamp */}
                    <span className={`block text-[9px] font-mono text-slate-400 dark:text-tokyo-comment ${isUser ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* AI thinking state */}
            {isSending && (
              <div className="flex flex-col gap-1.5 max-w-[80%]">
                <div className="flex gap-3">
                  <div className="h-7 w-7 rounded-sm bg-blue-50 dark:bg-tokyo-blue/10 border border-blue-200 dark:border-tokyo-border text-blue-600 dark:text-tokyo-blue flex items-center justify-center shrink-0 animate-spin">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div className="bg-slate-100 dark:bg-tokyo-input border border-slate-200 dark:border-tokyo-border rounded-lg px-4 py-3 text-xs text-slate-550 dark:text-tokyo-muted font-mono italic animate-pulse flex items-center gap-2">
                    <span>Independent Design Reviewer is analyzing...</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => abortControllerRef.current?.abort()}
                  className="ml-10 self-start text-[10px] text-red-500 dark:text-tokyo-red hover:underline font-semibold cursor-pointer"
                >
                  Stop Thinking
                </button>
              </div>
            )}

            {/* Chat API failure notifications */}
            {chatError && (
              <div className="bg-red-50 dark:bg-tokyo-red/10 border border-red-200 dark:border-tokyo-red/20 text-red-700 dark:text-tokyo-red p-3 rounded-lg text-xs leading-normal font-sans">
                <span className="font-bold text-[10px] uppercase block font-mono text-red-800 mb-1">Co-Pilot Exception</span>
                {chatError}
              </div>
            )}

            {/* Anchor scroll reference element */}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      {/* Input box section */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="p-3 border-t border-slate-200 dark:border-tokyo-border bg-white dark:bg-tokyo-panel rounded-b-lg shrink-0"
      >
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSending}
            placeholder={
              pageImage 
                ? "Ask a civil engineering question about this drawing page..." 
                : "Upload a structural blueprint above to begin chatting..."
            }
            className="w-full bg-slate-50 dark:bg-tokyo-input border border-slate-200 dark:border-tokyo-border rounded-lg pl-3 pr-12 py-3 text-xs text-slate-800 dark:text-tokyo-text outline-none focus:border-blue-500 dark:focus:border-tokyo-blue focus:ring-1 focus:ring-blue-500 dark:focus:ring-tokyo-blue transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
            id="chat-input-field"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="absolute right-2 text-white dark:text-tokyo-text bg-slate-900 dark:bg-tokyo-panel hover:bg-black dark:hover:bg-tokyo-card border border-transparent dark:border-tokyo-border p-2 rounded-md disabled:bg-slate-100 dark:disabled:bg-tokyo-input disabled:text-slate-450 dark:disabled:text-tokyo-muted transition-all cursor-pointer font-mono font-bold uppercase shrink-0"
            title="Submit query"
            id="chat-submit-btn"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 px-1 text-[9px] text-slate-400 dark:text-tokyo-comment font-mono">
          <span>Engine: {aiConfig.provider} • {aiConfig.modelName}</span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-2 w-2" /> Enter key sends message
          </span>
        </div>
      </form>
    </div>
  );
}
