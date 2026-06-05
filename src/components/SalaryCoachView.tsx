'use client';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/lib/store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SalaryMessage { role: 'user' | 'assistant'; content: string; }

const STARTER_PROMPTS = [
  "I got an offer for $85k as a React Developer. Is this good and how do I negotiate?",
  "They offered me $95k but I was expecting $115k. How do I counter?",
  "The company said the salary is non-negotiable. What can I do?",
  "I have two competing offers. How do I use them to negotiate?",
  "What other benefits should I negotiate besides salary?",
];

export default function SalaryCoachView() {
  const { state } = useApp();
  const [messages, setMessages] = useState<SalaryMessage[]>([]);
  const [input, setInput] = useState('');
  const [currentOffer, setCurrentOffer] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  async function sendMessage(text?: string) {
    const msg = text || input.trim();
    if (!msg || isTyping) return;

    const userMsg: SalaryMessage = { role: 'user', content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    const assistantMsg: SalaryMessage = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMsg]);

    try {
      const res = await fetch('/api/salary-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          chatHistory: messages.slice(-10),
          cvContext: state.profile.cvText?.substring(0, 400) || '',
          targetRole: state.profile.targetRole || '',
          currentOffer,
        }),
      });

      if (!res.ok || !res.body) throw new Error('Stream failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: accumulated };
          return updated;
        });
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: '⚠️ Error connecting. Check your GEMINI_API_KEY.' };
        return updated;
      });
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>💰 Salary Negotiation Coach</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          AI coach that gives you specific counter-offer numbers, market data, and word-for-word negotiation scripts.
        </p>
      </div>

      {/* Offer input strip */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexShrink: 0, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200, height: 40, fontSize: 13 }}
          value={currentOffer}
          onChange={e => setCurrentOffer(e.target.value)}
          placeholder="Paste your offer details (e.g. '$95k base, 10% bonus, NYC')"
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', whiteSpace: 'nowrap' }}>
          Optional context for better advice
        </span>
      </div>

      {/* Chat messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Your Personal Negotiation Coach</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, maxWidth: 480, margin: '0 auto 24px' }}>
              {state.profile.targetRole
                ? `Ready to coach you on ${state.profile.targetRole} salary negotiation.`
                : 'Tell me about your offer and I\'ll give you specific numbers and scripts.'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 600, margin: '0 auto' }}>
              {STARTER_PROMPTS.map(p => (
                <button key={p} className="btn btn-secondary btn-sm" onClick={() => sendMessage(p)}
                  style={{ fontSize: 12, textAlign: 'left' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '82%',
            padding: '14px 18px',
            borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            background: msg.role === 'user'
              ? 'linear-gradient(135deg, var(--accent), #818cf8)'
              : 'var(--bg-card)',
            border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
            color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
            fontSize: 14,
            lineHeight: 1.7,
          }}>
            {msg.role === 'assistant' ? (
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children }) => <h2 style={{ fontSize: 15, fontWeight: 700, margin: '14px 0 6px', color: 'var(--accent)' }}>{children}</h2>,
                    h3: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 600, margin: '10px 0 4px' }}>{children}</h3>,
                    strong: ({ children }) => <strong style={{ color: 'var(--text-primary)' }}>{children}</strong>,
                    p: ({ children }) => <p style={{ margin: '6px 0' }}>{children}</p>,
                    ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: '6px 0' }}>{children}</ul>,
                    li: ({ children }) => <li style={{ marginBottom: 3, color: 'var(--text-secondary)' }}>{children}</li>,
                    blockquote: ({ children }) => (
                      <blockquote style={{ borderLeft: '3px solid var(--green)', paddingLeft: 12, margin: '10px 0', background: 'rgba(34,197,94,0.05)', borderRadius: '0 8px 8px 0', padding: '8px 12px' }}>
                        {children}
                      </blockquote>
                    ),
                    hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '10px 0' }} />,
                  }}
                >{msg.content}</ReactMarkdown>
              </div>
            ) : (
              <span>{msg.content}</span>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="typing-indicator"><span /><span /><span /></div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="chat-input-bar" style={{ flexShrink: 0, marginTop: 8 }}>
        <textarea
          className="input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Describe your offer or ask a negotiation question…"
          rows={1}
          disabled={isTyping}
          style={{ resize: 'none', lineHeight: 1.6, minHeight: 42, overflow: 'hidden', padding: '10px 14px' }}
        />
        <button className="btn btn-primary" onClick={() => sendMessage()} disabled={isTyping}>
          {isTyping ? '...' : '💬 Ask'}
        </button>
      </div>
    </div>
  );
}
