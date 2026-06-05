'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/store';
import { TrackedApplication } from '@/lib/types';

function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function scheduleInterviewNotification(company: string, role: string, interviewDate: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const interviewTime = new Date(interviewDate).getTime();
  const notifyTime = interviewTime - 24 * 60 * 60 * 1000; // 24h before
  const delay = notifyTime - Date.now();
  if (delay > 0 && delay < 7 * 24 * 60 * 60 * 1000) { // only schedule if within 7 days
    setTimeout(() => {
      new Notification('💼 Interview Tomorrow!', {
        body: `${role} at ${company} is tomorrow. Good luck!`,
        icon: '/favicon.ico',
      });
    }, delay);
  }
}

const COLUMNS: { key: TrackedApplication['status']; label: string; color: string }[] = [
  { key: 'saved',        label: '🔖 Saved',        color: 'var(--blue)' },
  { key: 'applied',      label: '📤 Applied',       color: 'var(--purple)' },
  { key: 'interviewing', label: '💬 Interviewing',  color: 'var(--yellow)' },
  { key: 'offer',        label: '🎉 Offer',         color: 'var(--green)' },
  { key: 'rejected',     label: '❌ Rejected',      color: 'var(--red)' },
];

interface Goal {
  id: string;
  text: string;
  deadline: string;
  done: boolean;
}

export default function TrackerView() {
  const { state, dispatch } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [newApp, setNewApp] = useState({ company: '', role: '', url: '' });
  const [activeTab, setActiveTab] = useState<'kanban' | 'goals'>('kanban');

  function downloadICS(company: string, role: string, dateTimeStr: string) {
    if (!dateTimeStr) return;
    const date = new Date(dateTimeStr);
    
    // Format to YYYYMMDDTHHmmSSZ
    const formatDate = (d: Date) => {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const start = formatDate(date);
    const end = formatDate(new Date(date.getTime() + 60 * 60 * 1000)); // 1 hour duration

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//চাকরির বাজার//Interview Scheduler//EN',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@chakrirbazar.com`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:Interview: ${role} at ${company}`,
      `DESCRIPTION:Interview preparation and discussion for the ${role} position at ${company}.`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `interview_${company.toLowerCase().replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  useEffect(() => { requestNotificationPermission(); }, []);

  // Goals state
  const [newGoal, setNewGoal] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');

  // Current Calendar Month
  const [currentDate, setCurrentDate] = useState(new Date());

  const goals = state.goals || [];

  function addGoal() {
    if (!newGoal.trim()) return;
    const goalId = 'goal-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
    dispatch({
      type: 'ADD_GOAL',
      payload: { id: goalId, text: newGoal, deadline: goalDeadline, done: false }
    });
    setNewGoal('');
    setGoalDeadline('');
  }

  function toggleGoal(id: string) {
    dispatch({ type: 'TOGGLE_GOAL', payload: id });
  }

  function deleteGoal(id: string) {
    dispatch({ type: 'DELETE_GOAL', payload: id });
  }

  // Streak calculation
  const appDates = state.applications
    .filter(a => a.status !== 'saved')
    .map(a => new Date(a.appliedDate).toDateString());
  const uniqueDays = [...new Set(appDates)];
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (uniqueDays.includes(d.toDateString())) streak++;
    else if (i > 0) break;
  }

  const overdueGoals = goals.filter(g => !g.done && g.deadline && new Date(g.deadline) < new Date());

  function updateStatus(id: string, status: TrackedApplication['status']) {
    dispatch({ type: 'UPDATE_APPLICATION', payload: { id, updates: { status, lastUpdated: new Date().toISOString() } } });
  }

  function addApplication() {
    if (!newApp.company || !newApp.role) return;
    dispatch({
      type: 'ADD_APPLICATION',
      payload: {
        id: Date.now().toString(),
        company: newApp.company,
        role: newApp.role,
        status: 'applied',
        appliedDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: '',
        source: 'Manual',
        url: newApp.url,
      },
    });
    setNewApp({ company: '', role: '', url: '' });
    setShowAdd(false);
  }

  function onDragStart(e: React.DragEvent, id: string) {
    setDragging(id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDrop(e: React.DragEvent, status: TrackedApplication['status']) {
    e.preventDefault();
    if (dragging) updateStatus(dragging, status);
    setDragging(null);
    setDragOver(null);
  }

  // Monthly calendar calculation
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDayOfWeek = startOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
  const totalDays = endOfMonth.getDate();

  const calendarDays: (Date | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= totalDays; day++) {
    calendarDays.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
  }

  function changeMonth(offset: number) {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>📋 Application Tracker</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Drag cards between columns to update status.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Application</button>
      </div>

      {/* Streak + stats bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200, padding: 16 }}>
          <div style={{ fontSize: 32 }}>🔥</div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--yellow)' }}>{streak} day streak</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Keep applying daily!</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200, padding: 16 }}>
          <div style={{ fontSize: 32 }}>📊</div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{state.applications.filter(a => a.status !== 'saved').length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total applications sent</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200, padding: 16 }}>
          <div style={{ fontSize: 32 }}>🎯</div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)' }}>{goals.filter(g => g.done).length}/{goals.length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Goals completed</div>
          </div>
        </div>
      </div>

      {/* Overdue nudge */}
      {overdueGoals.length > 0 && (
        <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14 }}>
          <span style={{ color: 'var(--red)' }}>⚠️ {overdueGoals.length} overdue goal{overdueGoals.length > 1 ? 's' : ''}: </span>
          <span style={{ color: 'var(--text-secondary)' }}>{overdueGoals.map(g => g.text).join(', ')}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button className={`tab ${activeTab === 'kanban' ? 'active' : ''}`} onClick={() => setActiveTab('kanban')}>📋 Kanban Board</button>
        <button className={`tab ${activeTab === 'goals' ? 'active' : ''}`} onClick={() => setActiveTab('goals')}>🎯 Goals & Calendar</button>
      </div>

      {/* Kanban Board */}
      {activeTab === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, overflowX: 'auto' }}>
          {COLUMNS.map(col => {
            const cards = state.applications.filter(a => a.status === col.key);
            return (
              <div
                key={col.key}
                onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => onDrop(e, col.key)}
                className={dragOver === col.key ? 'kanban-dropzone-active' : ''}
                style={{
                  background: dragOver === col.key ? 'rgba(255,255,255,0.04)' : 'var(--bg-secondary)',
                  border: `1px solid ${dragOver === col.key ? col.color : 'var(--border)'}`,
                  borderRadius: 12,
                  padding: 12,
                  minHeight: 350,
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: col.color }}>{col.label}</span>
                  <span style={{
                    background: 'var(--bg-glass)', color: 'var(--text-secondary)',
                    borderRadius: 20, padding: '2px 8px', fontSize: 12
                  }}>{cards.length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cards.map(app => (
                    <div
                      key={app.id}
                      draggable
                      onDragStart={e => onDragStart(e, app.id)}
                      className={dragging === app.id ? 'kanban-dragged' : ''}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        padding: '12px 14px',
                        cursor: 'grab',
                        opacity: dragging === app.id ? 0.5 : 1,
                        transition: 'opacity 0.2s, transform 0.2s',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{app.role}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{app.company}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(app.appliedDate).toLocaleDateString()}
                        </span>
                        <span className="badge badge-blue" style={{ fontSize: 10, padding: '2px 6px' }}>{app.source}</span>
                      </div>
                      {app.url && (
                        <a
                          href={app.url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: 'var(--accent)', display: 'block', marginTop: 6 }}
                          onClick={e => e.stopPropagation()}
                        >
                          View posting →
                        </a>
                      )}
                      
                      {/* Interview Date (shown for interviewing status) */}
                      {app.status === 'interviewing' && (
                        <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
                          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--yellow)', display: 'block', marginBottom: 4 }}>
                            📅 Interview Date
                          </label>
                          <input
                            type="datetime-local"
                            value={(app as any).interviewDate || ''}
                            onChange={e => {
                              const val = e.target.value;
                              dispatch({
                                type: 'UPDATE_APPLICATION',
                                payload: { id: app.id, updates: { ...(app as any), interviewDate: val, lastUpdated: new Date().toISOString() } }
                              });
                              if (val) scheduleInterviewNotification(app.company, app.role, val);
                            }}
                            style={{
                              width: '100%', background: 'rgba(0,0,0,0.2)',
                              border: '1px solid rgba(234,179,8,0.3)',
                              borderRadius: 6, padding: '5px 8px',
                              fontSize: 11, color: 'var(--text-primary)',
                              fontFamily: 'inherit', outline: 'none',
                            }}
                          />
                          {(app as any).interviewDate && (() => {
                            const diff = Math.ceil((new Date((app as any).interviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            let badge = null;
                            if (diff < 0) badge = <span style={{ fontSize: 10, color: 'var(--red)', marginTop: 4, display: 'block' }}>⚠️ Interview passed</span>;
                            else if (diff === 0) badge = <span style={{ fontSize: 10, color: 'var(--yellow)', fontWeight: 700, marginTop: 4, display: 'block' }}>🔥 Interview TODAY!</span>;
                            else badge = <span style={{ fontSize: 10, color: diff <= 2 ? 'var(--yellow)' : 'var(--green)', marginTop: 4, display: 'block' }}>⏰ In {diff} day{diff !== 1 ? 's' : ''}</span>;

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {badge}
                                <button
                                  onClick={() => downloadICS(app.company, app.role, (app as any).interviewDate)}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    marginTop: 4,
                                    padding: '4px 8px',
                                    fontSize: 10,
                                    fontWeight: 600,
                                    background: 'rgba(234,179,8,0.1)',
                                    border: '1px solid rgba(234,179,8,0.2)',
                                    color: 'var(--yellow)',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    textAlign: 'center'
                                  }}
                                >
                                  📅 Export Calendar File
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Editable Notes */}
                      <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
                        <textarea
                          placeholder="Add interview notes, contact person..."
                          value={app.notes || ''}
                          onChange={e => {
                            dispatch({
                              type: 'UPDATE_APPLICATION',
                              payload: {
                                id: app.id,
                                updates: { notes: e.target.value, lastUpdated: new Date().toISOString() }
                              }
                            });
                          }}
                          style={{
                            width: '100%',
                            minHeight: '40px',
                            maxHeight: '120px',
                            background: 'rgba(0, 0, 0, 0.15)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            padding: '6px 8px',
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            outline: 'none',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                        {COLUMNS.filter(c => c.key !== app.status).slice(0, 2).map(c => (
                          <button
                            key={c.key}
                            onClick={() => updateStatus(app.id, c.key)}
                            style={{
                              fontSize: 10, padding: '3px 8px', borderRadius: 20,
                              background: 'var(--bg-glass)', border: '1px solid var(--border)',
                              color: 'var(--text-secondary)', cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            → {c.key}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (window.confirm("Remove this application?")) {
                            dispatch({ type: 'DELETE_APPLICATION', payload: app.id });
                          }
                        }}
                        style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 20, marginTop: 6,
                          background: 'transparent', border: '1px solid var(--red)',
                          color: 'var(--red)', cursor: 'pointer', width: '100%',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  {cards.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px 8px', color: 'var(--text-muted)', fontSize: 12 }}>
                      Drop cards here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Goals & Calendar Tab */}
      {activeTab === 'goals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Section 1: Goals */}
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 16 }}>🎯 Career Goals</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                className="input"
                style={{ flex: 1, minWidth: 200 }}
                value={newGoal}
                onChange={e => setNewGoal(e.target.value)}
                placeholder="e.g. Apply to 5 jobs this week"
                onKeyDown={e => e.key === 'Enter' && addGoal()}
              />
              <input
                className="input"
                type="date"
                value={goalDeadline}
                onChange={e => setGoalDeadline(e.target.value)}
                style={{ width: 160 }}
              />
              <button className="btn btn-primary" onClick={addGoal}>Add Goal</button>
            </div>
            {goals.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 24 }}>
                No goals yet. Add your first career goal above.
              </div>
            )}
            {goals.map(goal => (
              <div key={goal.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <input
                  type="checkbox"
                  checked={goal.done}
                  onChange={() => toggleGoal(goal.id)}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
                <span style={{
                  flex: 1,
                  textDecoration: goal.done ? 'line-through' : 'none',
                  color: goal.done ? 'var(--text-muted)' : 'var(--text-primary)',
                  fontSize: 14,
                }}>
                  {goal.text}
                </span>
                {goal.deadline && (
                  <span style={{
                    fontSize: 12,
                    color: new Date(goal.deadline) < new Date() && !goal.done ? 'var(--red)' : 'var(--text-muted)',
                    padding: '2px 8px',
                    background: new Date(goal.deadline) < new Date() && !goal.done ? 'var(--red-bg)' : 'var(--bg-glass)',
                    borderRadius: 20,
                  }}>
                    {new Date(goal.deadline) < new Date() && !goal.done ? '⚠️ ' : ''}
                    {new Date(goal.deadline).toLocaleDateString()}
                  </span>
                )}
                <button
                  onClick={() => deleteGoal(goal.id)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    cursor: 'pointer', fontSize: 16, padding: '0 4px',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Section 2: Real Monthly Calendar View */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>📅 Calendar View & Reminders</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => changeMonth(-1)}>◀ Prev</button>
                <span style={{ minWidth: 120, textAlign: 'center', fontWeight: 600, fontSize: 14, alignSelf: 'center' }}>
                  {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => changeMonth(1)}>Next ▶</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
              {/* Day names headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  {d}
                </div>
              ))}

              {/* Day cells */}
              {calendarDays.map((dayDate, idx) => {
                if (!dayDate) {
                  return <div key={`empty-${idx}`} style={{ aspectRatio: '1.2', background: 'transparent' }} />;
                }

                const dayString = dayDate.toDateString();
                const isToday = dayString === new Date().toDateString();

                // Find goals matching this day deadline
                const dayGoals = goals.filter(g => g.deadline && new Date(g.deadline).toDateString() === dayString);

                // Find applications matching this day applied date
                const dayApps = state.applications.filter(a => new Date(a.appliedDate).toDateString() === dayString);

                return (
                  <div
                    key={dayString}
                    style={{
                      aspectRatio: '1.2',
                      background: isToday ? 'rgba(99,102,241,0.06)' : 'var(--bg-glass)',
                      border: isToday ? '1px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      overflow: 'hidden',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontWeight: 600,
                      fontSize: 12,
                      color: isToday ? 'var(--accent)' : 'var(--text-primary)',
                    }}>
                      <span>{dayDate.getDate()}</span>
                      {isToday && <span style={{ fontSize: 8, textTransform: 'uppercase', background: 'var(--accent)', color: 'white', padding: '1px 4px', borderRadius: 4 }}>Today</span>}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', flex: 1, marginTop: 4 }}>
                      {/* Reminders for Goals */}
                      {dayGoals.map(g => (
                        <div
                          key={g.id}
                          title={`Goal: ${g.text}`}
                          style={{
                            fontSize: 9,
                            padding: '2px 4px',
                            borderRadius: 4,
                            background: g.done ? 'var(--green-bg)' : 'var(--yellow-bg)',
                            color: g.done ? 'var(--green)' : 'var(--yellow)',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            textDecoration: g.done ? 'line-through' : 'none',
                          }}
                        >
                          🎯 {g.text}
                        </div>
                      ))}

                      {/* Reminders for applications */}
                      {dayApps.map(a => (
                        <div
                          key={a.id}
                          title={`Applied: ${a.role} at ${a.company}`}
                          style={{
                            fontSize: 9,
                            padding: '2px 4px',
                            borderRadius: 4,
                            background: 'var(--purple-bg)',
                            color: 'var(--purple)',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                          }}
                        >
                          📥 {a.company}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Heatmap Activity */}
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 16 }}>📊 Application Activity Heatmap (Last 28 Days)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 4 }}>{d}</div>
              ))}
              {Array.from({ length: 28 }).map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (27 - i));
                const dayStr = d.toDateString();
                const count = appDates.filter(ad => ad === dayStr).length;
                const intensity = count === 0 ? 'rgba(255,255,255,0.04)' :
                  count === 1 ? 'rgba(99,102,241,0.3)' :
                  count <= 3 ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.8)';
                return (
                  <div
                    key={i}
                    title={`${d.toLocaleDateString()}: ${count} application${count !== 1 ? 's' : ''}`}
                    style={{
                      aspectRatio: '1', borderRadius: 4, background: intensity,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: count > 0 ? 'white' : 'var(--text-muted)',
                      cursor: 'default',
                    }}
                  >
                    {count > 0 ? count : ''}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>Less</span>
              {[0.04, 0.3, 0.5, 0.8].map((op, i) => (
                <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: i === 0 ? `rgba(255,255,255,${op})` : `rgba(99,102,241,${op})` }} />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      )}

      {/* Add Application Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Add Application</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="input-group">
                <label>Company *</label>
                <input className="input" value={newApp.company} onChange={e => setNewApp({ ...newApp, company: e.target.value })} placeholder="e.g. Google" />
              </div>
              <div className="input-group">
                <label>Role *</label>
                <input className="input" value={newApp.role} onChange={e => setNewApp({ ...newApp, role: e.target.value })} placeholder="e.g. Software Engineer" />
              </div>
              <div className="input-group">
                <label>Job URL</label>
                <input className="input" value={newApp.url} onChange={e => setNewApp({ ...newApp, url: e.target.value })} placeholder="https://..." />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={addApplication}>Add Application</button>
                <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
