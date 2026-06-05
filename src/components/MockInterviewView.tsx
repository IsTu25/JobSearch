'use client';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/lib/store';

type SessionPhase = 'setup' | 'questioning' | 'complete';
type Difficulty = 'Easy' | 'Medium' | 'Hard';

interface Question {
  question: string;
  type: 'behavioral' | 'technical' | 'situational';
  hint: string;
}

interface Feedback {
  score: number;
  label: string;
  strengths: string[];
  improvements: string[];
  starAnalysis: { situation: string; task: string; action: string; result: string };
  modelAnswer: string;
}

interface SessionEntry {
  question: Question;
  answer: string;
  feedback: Feedback;
}

const TOTAL_QUESTIONS = 8;

function scoreColor(score: number) {
  if (score >= 8) return 'var(--green)';
  if (score >= 6) return 'var(--yellow)';
  if (score >= 4) return '#f97316';
  return 'var(--red)';
}

function StarBadge({ status }: { status: string }) {
  const color = status === 'present' ? 'var(--green)' : status === 'vague' ? 'var(--yellow)' : 'var(--red)';
  const icon = status === 'present' ? '✓' : status === 'vague' ? '~' : '✗';
  return (
    <span style={{ fontSize: 10, background: `${color}18`, color, padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
      {icon}
    </span>
  );
}

export default function MockInterviewView() {
  const { state } = useApp();
  const [phase, setPhase] = useState<SessionPhase>('setup');
  const [role, setRole] = useState(state.profile.targetRole || '');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [currentFeedback, setCurrentFeedback] = useState<Feedback | null>(null);
  const [session, setSession] = useState<SessionEntry[]>([]);
  const [loadingQ, setLoadingQ] = useState(false);
  const [loadingF, setLoadingF] = useState(false);
  const [timer, setTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Timer logic
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  function toggleSpeech() {
    if (typeof window === 'undefined') return;
    const SpeechObj = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechObj) {
      alert('Speech recognition is not supported in this browser. Try Chrome/Safari.');
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const rec = new SpeechObj();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onresult = (event: any) => {
      const resultText = event.results[event.results.length - 1][0].transcript;
      setAnswer(prev => (prev ? prev + ' ' + resultText.trim() : resultText.trim()));
    };

    rec.onend = () => {
      setIsRecording(false);
    };

    rec.onerror = () => {
      setIsRecording(false);
    };

    recognitionRef.current = rec;
    rec.start();
    setIsRecording(true);
  }

  const cvContext = state.profile.cvText?.substring(0, 600) || '';

  async function fetchQuestion(idx: number) {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
    setLoadingQ(true);
    setCurrentFeedback(null);
    setAnswer('');
    setTimer(0);
    setTimerRunning(false);
    setShowModel(false);
    try {
      const res = await fetch('/api/mock-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'question', role, questionIndex: idx, difficulty, cvContext }),
      });
      const data = await res.json();
      setCurrentQuestion(data);
      setTimerRunning(true);
      answerRef.current?.focus();
    } catch {
      setCurrentQuestion({ question: 'Tell me about yourself and your background.', type: 'behavioral', hint: 'Keep it under 90 seconds. Cover: who you are, key experience, why this role.' });
      setTimerRunning(true);
    } finally {
      setLoadingQ(false);
    }
  }

  async function submitAnswer() {
    if (!answer.trim() || !currentQuestion) return;
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
    setTimerRunning(false);
    setLoadingF(true);
    try {
      const res = await fetch('/api/mock-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'feedback', role, question: currentQuestion.question, answer: answer.trim(), cvContext }),
      });
      const fb: Feedback = await res.json();
      setCurrentFeedback(fb);
      setSession(prev => [...prev, { question: currentQuestion, answer: answer.trim(), feedback: fb }]);
    } catch {
      setCurrentFeedback({ score: 5, label: 'Good', strengths: ['Answer received'], improvements: ['Could not evaluate — check API key'], starAnalysis: { situation: 'vague', task: 'vague', action: 'vague', result: 'vague' }, modelAnswer: '' });
    } finally {
      setLoadingF(false);
    }
  }

  function nextQuestion() {
    const next = questionIndex + 1;
    if (next >= TOTAL_QUESTIONS) {
      setPhase('complete');
    } else {
      setQuestionIndex(next);
      fetchQuestion(next);
    }
  }

  function startSession() {
    if (!role.trim()) return;
    setSession([]);
    setQuestionIndex(0);
    setPhase('questioning');
    fetchQuestion(0);
  }

  const avgScore = session.length > 0 ? Math.round(session.reduce((s, e) => s + e.feedback.score, 0) / session.length * 10) : 0;
  const timerStr = `${String(Math.floor(timer / 60)).padStart(2, '0')}:${String(timer % 60).padStart(2, '0')}`;

  // ─── SETUP SCREEN ───
  if (phase === 'setup') {
    return (
      <div className="fade-in" style={{ maxWidth: 640, margin: '0 auto', padding: '8px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🎤</div>
          <h2 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 8px' }}>Mock Interview Mode</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 480, margin: '0 auto' }}>
            AI asks questions, you answer, AI gives instant STAR-format feedback with a score.
            {!state.cvUploaded && <span style={{ color: 'var(--yellow)' }}> Upload your CV for personalised questions.</span>}
          </p>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>
              Target Role
            </label>
            <input
              className="input"
              style={{ width: '100%', height: 44, fontSize: 15 }}
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="e.g. Frontend Engineer, Product Manager, Data Analyst…"
              onKeyDown={e => e.key === 'Enter' && startSession()}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>
              Difficulty
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    border: difficulty === d ? '2px solid var(--accent)' : '2px solid var(--border)',
                    background: difficulty === d ? 'rgba(99,102,241,0.12)' : 'var(--bg-glass)',
                    color: difficulty === d ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {d === 'Easy' ? '🟢' : d === 'Medium' ? '🟡' : '🔴'} {d}
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: 16, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[['8', 'Questions'], ['STAR', 'Format'], ['AI', 'Feedback'], ['Score', '/10']].map(([val, lbl]) => (
              <div key={lbl} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{val}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lbl}</div>
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={startSession}
            disabled={!role.trim()}
            style={{ width: '100%', height: 48, fontSize: 15, fontWeight: 700, justifyContent: 'center' }}
          >
            🎤 Start Interview →
          </button>
        </div>
      </div>
    );
  }

  // ─── RESULTS SCREEN ───
  if (phase === 'complete') {
    return (
      <div className="fade-in" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🏆</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>Interview Complete!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Role: <strong>{role}</strong> · Difficulty: {difficulty}</p>
        </div>

        {/* Overall Score */}
        <div className="card" style={{ marginBottom: 24, textAlign: 'center', background: `${scoreColor(avgScore / 10)}0d`, border: `1px solid ${scoreColor(avgScore / 10)}30` }}>
          <div style={{ fontSize: 64, fontWeight: 900, color: scoreColor(avgScore / 10), lineHeight: 1 }}>{avgScore}%</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Overall Interview Score</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--green)' }}>✅ Strong: {session.filter(e => e.feedback.score >= 7).length} questions</span>
            <span style={{ fontSize: 13, color: 'var(--yellow)' }}>⚠️ OK: {session.filter(e => e.feedback.score >= 5 && e.feedback.score < 7).length} questions</span>
            <span style={{ fontSize: 13, color: 'var(--red)' }}>❌ Weak: {session.filter(e => e.feedback.score < 5).length} questions</span>
          </div>
        </div>

        {/* Q&A Recap */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {session.map((entry, idx) => (
            <div key={idx} className="card" style={{ border: `1px solid ${scoreColor(entry.feedback.score)}25` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Q{idx + 1}</span>
                  <span style={{ fontSize: 11, background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 10, fontWeight: 600, textTransform: 'capitalize' }}>{entry.question.type}</span>
                </div>
                <span style={{ fontSize: 22, fontWeight: 900, color: scoreColor(entry.feedback.score) }}>{entry.feedback.score}/10</span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{entry.question.question}</p>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: 8, marginBottom: 10, fontStyle: 'italic' }}>
                "{entry.answer.substring(0, 120)}{entry.answer.length > 120 ? '…' : ''}"
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {entry.feedback.strengths.slice(0, 1).map((s, i) => <span key={i} style={{ fontSize: 11, color: 'var(--green)', background: 'rgba(34,197,94,0.08)', padding: '3px 10px', borderRadius: 10 }}>✓ {s}</span>)}
                {entry.feedback.improvements.slice(0, 1).map((s, i) => <span key={i} style={{ fontSize: 11, color: 'var(--yellow)', background: 'rgba(234,179,8,0.08)', padding: '3px 10px', borderRadius: 10 }}>↑ {s}</span>)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={() => { setPhase('setup'); setSession([]); }} style={{ flex: 1, justifyContent: 'center' }}>
            🔄 New Session
          </button>
          <button className="btn btn-primary" onClick={() => { setSession([]); setQuestionIndex(0); setPhase('questioning'); fetchQuestion(0); }} style={{ flex: 1, justifyContent: 'center' }}>
            🎤 Retry Same Role
          </button>
        </div>
      </div>
    );
  }

  // ─── INTERVIEW SCREEN ───
  const progress = ((questionIndex) / TOTAL_QUESTIONS) * 100;
  return (
    <div className="fade-in" style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🎤 Mock Interview — <span style={{ color: 'var(--accent)' }}>{role}</span></h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Question {questionIndex + 1} of {TOTAL_QUESTIONS} · {difficulty}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {timerRunning && (
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: timer > 90 ? 'var(--red)' : 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '4px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
              ⏱ {timerStr}
            </div>
          )}
          <button onClick={() => setPhase('setup')} style={{ fontSize: 12, background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '4px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✕ Exit
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent), var(--purple))', borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>

      {/* Question card */}
      {loadingQ ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</div>
          <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>AI interviewer is preparing your question…</p>
        </div>
      ) : currentQuestion && (
        <div className="card" style={{ marginBottom: 20, background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
            <span style={{ fontSize: 11, background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', padding: '3px 10px', borderRadius: 10, fontWeight: 700, textTransform: 'capitalize' }}>
              {currentQuestion.type}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Q{questionIndex + 1}</span>
          </div>
          <p style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5, marginBottom: 12 }}>{currentQuestion.question}</p>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(0,0,0,0.15)', padding: '10px 14px', borderRadius: 10 }}>
            <span style={{ fontSize: 14 }}>💡</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{currentQuestion.hint}</span>
          </div>
        </div>
      )}

      {/* Answer area — only when no feedback yet */}
      {currentQuestion && !currentFeedback && (
        <div className="card" style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 10 }}>
            Your Answer
          </label>
          <textarea
            ref={answerRef}
            className="input"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Type your answer here… Use the STAR format: Situation → Task → Action → Result"
            rows={6}
            disabled={loadingF}
            style={{ width: '100%', resize: 'vertical', lineHeight: 1.6, fontSize: 14 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                onClick={toggleSpeech}
                className="btn btn-secondary"
                style={{
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 600,
                  background: isRecording ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                  border: isRecording ? '1px solid var(--red)' : '1px solid var(--border)',
                  color: isRecording ? 'var(--red)' : 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                {isRecording ? '🔴 Stop Mic' : '🎙️ Speak Answer'}
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{answer.trim().split(/\s+/).filter(Boolean).length} words</span>
            </div>
            <button
              className="btn btn-primary"
              onClick={submitAnswer}
              disabled={!answer.trim() || loadingF}
              style={{ fontWeight: 700 }}
            >
              {loadingF ? '⏳ Evaluating…' : '📤 Submit Answer'}
            </button>
          </div>
        </div>
      )}

      {/* Feedback panel */}
      {currentFeedback && (
        <div className="fade-in card" style={{ marginBottom: 20, border: `1px solid ${scoreColor(currentFeedback.score)}30` }}>
          {/* Score */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 2 }}>AI Feedback</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor(currentFeedback.score) }}>
                {currentFeedback.label}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: scoreColor(currentFeedback.score), lineHeight: 1 }}>
                {currentFeedback.score}<span style={{ fontSize: 16, fontWeight: 500 }}>/10</span>
              </div>
            </div>
          </div>

          {/* STAR Analysis */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {(['situation', 'task', 'action', 'result'] as const).map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.15)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{k}</span>
                <StarBadge status={currentFeedback.starAnalysis[k]} />
              </div>
            ))}
          </div>

          {/* Strengths & Improvements */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>✅ Strengths</div>
              {currentFeedback.strengths.map((s, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>• {s}</div>)}
            </div>
            <div style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.15)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--yellow)', marginBottom: 8 }}>↑ To Improve</div>
              {currentFeedback.improvements.map((s, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>• {s}</div>)}
            </div>
          </div>

          {/* Model Answer toggle */}
          {currentFeedback.modelAnswer && (
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={() => setShowModel(v => !v)}
                style={{ fontSize: 12, fontWeight: 600, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--accent)', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {showModel ? '▲ Hide' : '▼ Show'} Model Answer
              </button>
              {showModel && (
                <div style={{ marginTop: 10, background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                  {currentFeedback.modelAnswer}
                </div>
              )}
            </div>
          )}

          {/* Next button */}
          <button
            className="btn btn-primary"
            onClick={nextQuestion}
            style={{ width: '100%', justifyContent: 'center', height: 44, fontWeight: 700, fontSize: 14 }}
          >
            {questionIndex + 1 >= TOTAL_QUESTIONS ? '🏆 View Results' : `Next Question →  (${questionIndex + 2}/${TOTAL_QUESTIONS})`}
          </button>
        </div>
      )}
    </div>
  );
}
