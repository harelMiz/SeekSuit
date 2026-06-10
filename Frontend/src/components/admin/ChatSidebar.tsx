import { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, User, Loader2, Zap, RotateCcw } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import { sendChatMessage, type ChatMessage } from "../../services/insights.service";

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

const SUGGESTED = [
  "כמה מוצרים חסרים תמונות?",
  "אילו צבעים מבוקשים שלא במלאי?",
  "מה המוצרים הנצפים ביותר?",
];

export default function ChatSidebar({ open, onClose }: ChatSidebarProps) {
  const { t, lang } = useLang();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput("");
    setLoading(true);

    const optimisticHistory: ChatMessage[] = [
      ...messages,
      { role: "user", text: msg },
    ];
    setMessages(optimisticHistory);

    try {
      const { history } = await sendChatMessage(msg, messages, lang);
      setMessages(history);
    } catch (err: any) {
      const apiMsg: string = err?.response?.data?.error ?? null;
      const displayMsg = apiMsg ?? t("insights.error");
      setMessages([...optimisticHistory, { role: "model", text: displayMsg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-surface border-l border-outline-variant z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="relative overflow-hidden px-6 py-5 border-b border-outline-variant shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 to-zinc-800" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_0%_50%,_rgba(253,220,160,0.10),_transparent)]" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gold-shimmer flex items-center justify-center shrink-0">
                <Sparkles size={18} className="text-on-tertiary-fixed" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{t("insights.chatTitle")}</p>
                <p className="text-xs text-white/50">SeekSuit AI · Business Agent</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
                >
                  <RotateCcw size={11} />
                  נקה שיחה
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white">
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-6 py-10">
              <div className="w-16 h-16 rounded-2xl gold-shimmer flex items-center justify-center">
                <Zap size={26} className="text-on-tertiary-fixed" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-on-surface mb-1">{t("insights.chatPlaceholder")}</p>
                <p className="text-xs text-secondary">שאל שאלות על המלאי, חיפושים, מגמות ועוד</p>
              </div>
              <div className="w-full space-y-2.5">
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="w-full text-start px-4 py-3.5 rounded-xl bg-surface-container-low border border-outline-variant text-sm text-on-surface hover:border-primary hover:text-primary transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                msg.role === "user"
                  ? "bg-primary text-on-primary"
                  : "gold-shimmer text-on-tertiary-fixed"
              }`}>
                {msg.role === "user" ? <User size={14} /> : <Sparkles size={13} />}
              </div>
              <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-on-primary rounded-tr-sm"
                  : "bg-surface-container-low text-on-surface border border-outline-variant rounded-tl-sm"
              }`}>
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl gold-shimmer flex items-center justify-center shrink-0">
                <Sparkles size={13} className="text-on-tertiary-fixed" />
              </div>
              <div className="bg-surface-container-low border border-outline-variant rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-secondary" />
                <span className="text-xs text-secondary">מנתח נתונים...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-5 border-t border-outline-variant bg-surface-container shrink-0">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={t("insights.chatPlaceholder")}
              disabled={loading}
              className="flex-1 bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-secondary focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="px-5 py-3 rounded-xl gold-shimmer text-on-tertiary-fixed font-semibold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
