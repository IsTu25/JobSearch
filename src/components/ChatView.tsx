'use client';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/lib/store';
import { ChatMessage } from '@/lib/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const suggestions = [
  'Am I ready for a Software Engineer role?',
  'What skills am I missing for ML Engineer?',
  'Write a cover letter for a React Developer position',
  'Build me a 3-month learning roadmap',
  'Analyze my CV and give me a score',
  'Prep me for a frontend interview',
];

export default function ChatView() {
  const { state, dispatch } = useApp();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.chatMessages, isTyping]);

  async function sendMessage(text?: string) {
    const msg = text || input.trim();
    if (!msg || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: userMsg });
    setInput('');
    setIsTyping(true);

    // Add empty assistant message FIRST — before any async work
    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: assistantMsg });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          cvChunks: state.profile.cvChunks,
          profileSummary: `Name: ${state.profile.name}, Target Role: ${state.profile.targetRole}, Location: ${state.profile.targetLocation}, Experience: ${state.profile.experienceLevel}`,
          chatHistory: state.chatMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
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
        dispatch({ type: 'UPDATE_LAST_MESSAGE', payload: accumulated });
      }
    } catch {
      dispatch({ type: 'UPDATE_LAST_MESSAGE', payload: '\n\n⚠️ Error: Could not get a response. Check your GEMINI_API_KEY.' });
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {state.chatMessages.length === 0 && (
          <div className="empty-state" style={{ marginTop: 60 }}>
            <div className="empty-icon">🚀</div>
            <h3>চাকরির বাজার AI Assistant</h3>
            <p style={{ marginBottom: 24 }}>
              {state.cvUploaded
                ? 'Your CV is loaded. Ask me anything about your career — I\'ll give you honest, evidence-based answers.'
                : 'Upload your CV first for personalized insights. I can still help with general career advice!'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 600, margin: '0 auto' }}>
              {suggestions.map(s => (
                <button
                  key={s}
                  className="btn btn-secondary btn-sm"
                  onClick={() => sendMessage(s)}
                  style={{ fontSize: 12 }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {state.chatMessages.map(msg => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            {msg.role === 'assistant' ? (
              <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.7 }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ children }) {
                      return (
                        <code style={{
                          background: 'rgba(0,0,0,0.3)', padding: '2px 6px',
                          borderRadius: 4, fontSize: 13, fontFamily: 'monospace'
                        }}>
                          {children}
                        </code>
                      );
                    },
                    pre({ children }) {
                      return (
                        <pre style={{
                          background: 'rgba(0,0,0,0.3)', padding: 12,
                          borderRadius: 8, overflowX: 'auto', margin: '8px 0', fontSize: 13
                        }}>
                          {children}
                        </pre>
                      );
                    },
                    strong({ children }) {
                      return <strong style={{ color: 'var(--text-primary)' }}>{children}</strong>;
                    },
                    ul({ children }) {
                      return <ul style={{ paddingLeft: 20, margin: '8px 0' }}>{children}</ul>;
                    },
                    ol({ children }) {
                      return <ol style={{ paddingLeft: 20, margin: '8px 0' }}>{children}</ol>;
                    },
                    li({ children }) {
                      return <li style={{ marginBottom: 4 }}>{children}</li>;
                    },
                    h1({ children }) {
                      return <h1 style={{ fontSize: 20, fontWeight: 700, margin: '16px 0 8px' }}>{children}</h1>;
                    },
                    h2({ children }) {
                      return <h2 style={{ fontSize: 17, fontWeight: 600, margin: '14px 0 6px' }}>{children}</h2>;
                    },
                    h3({ children }) {
                      return <h3 style={{ fontSize: 15, fontWeight: 600, margin: '12px 0 4px' }}>{children}</h3>;
                    },
                    p({ children }) {
                      return <p style={{ margin: '6px 0' }}>{children}</p>;
                    },
                    table({ children }) {
                      return (
                        <div style={{ 
                          overflowX: 'auto', 
                          margin: '16px 0', 
                          borderRadius: '8px', 
                          border: '1px solid var(--border)',
                          background: 'rgba(255, 255, 255, 0.01)'
                        }}>
                          <table style={{ 
                            borderCollapse: 'separate', 
                            borderSpacing: 0,
                            width: '100%', 
                            fontSize: '13px',
                            textAlign: 'left'
                          }}>
                            {children}
                          </table>
                        </div>
                      );
                    },
                    th({ children }) {
                      return (
                        <th style={{ 
                          padding: '12px 16px', 
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderBottom: '2px solid var(--border)', 
                          fontWeight: 600,
                          color: 'var(--text-primary)'
                        }}>
                          {children}
                        </th>
                      );
                    },
                    td({ children }) {
                      return (
                        <td style={{ 
                          padding: '12px 16px', 
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-secondary)'
                        }}>
                          {children}
                        </td>
                      );
                    },
                    blockquote({ children }) {
                      return (
                        <blockquote style={{
                          borderLeft: '3px solid var(--accent)', paddingLeft: 12,
                          margin: '8px 0', color: 'var(--text-secondary)'
                        }}>
                          {children}
                        </blockquote>
                      );
                    },
                    hr() {
                      return <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />;
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
                {msg.role === 'assistant' && msg.content.length > 20 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, gap: 6 }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                      }}
                      style={{
                        fontSize: 11, padding: '3px 12px', borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)',
                        color: 'var(--text-muted)', cursor: 'pointer', transition: 'var(--transition)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      📋 Copy
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <span>{msg.content}</span>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="typing-indicator">
            <span /><span /><span />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-bar">
        <textarea
          className="input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask চাকরির বাজার anything... (Shift+Enter for new line)"
          rows={1}
          disabled={isTyping}
          style={{ resize: 'none', lineHeight: 1.6, minHeight: 42, overflow: 'hidden', padding: '10px 14px' }}
        />
        <button className="btn btn-primary" onClick={() => sendMessage()} disabled={isTyping}>
          {isTyping ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
