'use client';
import { useState } from 'react';
import { useApp } from '@/lib/store';

export default function RoadmapView() {
  const { state, dispatch } = useApp();
  const { roadmap, profile } = state;
  const [generating, setGenerating] = useState(false);
  const [targetRole, setTargetRole] = useState(profile.targetRole || '');
  const [months, setMonths] = useState('3');

  async function generateRoadmap() {
    if (!targetRole) return;
    setGenerating(true);

    try {
      const res = await fetch('/api/generate-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRole,
          months,
          cvText: profile.cvText,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      dispatch({ type: 'SET_ROADMAP', payload: data.roadmap });
      
      // Update targetRole in profile
      dispatch({ type: 'SET_PROFILE', payload: { targetRole } });

      dispatch({
        type: 'ADD_CHAT_MESSAGE',
        payload: {
          id: Date.now().toString(),
          role: 'assistant',
          content: `🗺️ **Personalized ${months}-Month Roadmap generated for ${targetRole}!** Check the "Learning Roadmap" tab to track your progress.`,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error(err);
      alert('Failed to generate roadmap. Please check your API key.');
    } finally {
      setGenerating(false);
    }
  }

  function parseHours(hoursStr: string): number {
    const matches = hoursStr.match(/\d+/g);
    if (!matches) return 0;
    if (matches.length === 2) {
      return (parseInt(matches[0]) + parseInt(matches[1])) / 2;
    }
    return parseInt(matches[0]);
  }

  function scheduleWeekDayByDay(week: any) {
    week.topics.forEach((topic: any, index: number) => {
      const goalId = `roadmap-${topic.id}`;
      // Check if goal already exists
      if (state.goals.some(g => g.id === goalId)) return;

      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + index);
      const dateStr = scheduledDate.toISOString().split('T')[0];

      dispatch({
        type: 'ADD_GOAL',
        payload: {
          id: goalId,
          text: `[Roadmap] ${topic.text}`,
          deadline: dateStr,
          done: topic.completed
        }
      });
    });
  }

  // Calculate statistics
  let totalTopics = 0;
  let completedTopics = 0;
  let totalHours = 0;
  let completedHours = 0;
  let syncedCount = 0;
  const todayStr = new Date().toDateString();
  const todayFocusTopics: { id: string; text: string; completed: boolean }[] = [];

  if (roadmap) {
    roadmap.forEach(month => {
      month.weeks.forEach(week => {
        week.topics.forEach(topic => {
          totalTopics++;
          const hrs = parseHours(topic.hours);
          totalHours += hrs;
          if (topic.completed) {
            completedTopics++;
            completedHours += hrs;
          }

          const goalId = `roadmap-${topic.id}`;
          const goal = state.goals.find(g => g.id === goalId);
          if (goal) {
            syncedCount++;
            if (new Date(goal.deadline).toDateString() === todayStr) {
              todayFocusTopics.push({
                id: topic.id,
                text: topic.text,
                completed: topic.completed
              });
            }
          }
        });
      });
    });
  }
  const percentComplete = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>🗺️ Learning Roadmap</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            AI-generated personalized timeline checklist based on your CV gaps and target role.
          </p>
        </div>
        {roadmap && (
          <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: 12, padding: '12px 18px', textAlign: 'right' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>PROGRESS</span>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{percentComplete}% Complete</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{completedTopics} of {totalTopics} tasks done</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="input-group" style={{ flex: 2, minWidth: 200 }}>
            <label style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Target Role</label>
            <input
              className="input"
              value={targetRole}
              onChange={e => setTargetRole(e.target.value)}
              placeholder="e.g. ML Engineer, Full-Stack Developer"
            />
          </div>
          <div className="input-group" style={{ flex: 1, minWidth: 100 }}>
            <label style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Duration</label>
            <select className="input" value={months} onChange={e => setMonths(e.target.value)}>
              <option value="1">1 month</option>
              <option value="2">2 months</option>
              <option value="3">3 months</option>
              <option value="6">6 months</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={generateRoadmap} disabled={generating || !targetRole} style={{ cursor: 'pointer' }}>
            {generating ? '⏳ Generating...' : '🗺️ Generate Roadmap'}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {generating && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 16, animation: 'pulse 1.5s infinite' }}>🧠</div>
          <h3 style={{ fontSize: 16, marginBottom: 8, fontWeight: 600 }}>Analyzing your CV & mapping career paths...</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            This takes 10-20 seconds. The AI is scanning your CV to skip technologies you know, planning milestones, and writing instructions.
          </p>
        </div>
      )}

      {/* Interactive Checklist Timeline */}
      {roadmap && !generating && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Learning Progression Report */}
          <div className="card" style={{ padding: 24, background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📊 Learning Progression Report</span>
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 20 }}>
              {/* Metric 1: Overall Progress */}
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>CHECKLIST PROGRESS</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>{percentComplete}%</div>
                <div className="progress-bar" style={{ height: 6, marginTop: 8, background: 'rgba(255, 255, 255, 0.05)' }}>
                  <div className="progress-fill" style={{ width: `${percentComplete}%`, background: 'var(--accent)' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{completedTopics} of {totalTopics} tasks completed</div>
              </div>

              {/* Metric 2: Logged Study Hours */}
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>ESTIMATED STUDY HOURS</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)' }}>{Math.round(completedHours)} hrs</div>
                <div className="progress-bar" style={{ height: 6, marginTop: 8, background: 'rgba(255, 255, 255, 0.05)' }}>
                  <div className="progress-fill" style={{ width: `${totalHours > 0 ? (completedHours / totalHours) * 100 : 0}%`, background: 'var(--green)' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Estimated target: {Math.round(totalHours)} total hours</div>
              </div>

              {/* Metric 3: Goals Sync Status */}
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>CALENDAR & GOALS SYNC</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--purple)' }}>{syncedCount} Synced</div>
                <div className="progress-bar" style={{ height: 6, marginTop: 8, background: 'rgba(255, 255, 255, 0.05)' }}>
                  <div className="progress-fill" style={{ width: `${totalTopics > 0 ? (syncedCount / totalTopics) * 100 : 0}%`, background: 'var(--purple)' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{totalTopics - syncedCount} unscheduled tasks remaining</div>
              </div>
            </div>

            {/* Today's Focus Schedule */}
            <div style={{ background: 'rgba(99, 102, 241, 0.03)', border: '1px solid rgba(99, 102, 241, 0.1)', padding: 16, borderRadius: 12 }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: 13.5, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📅 Today&apos;s Focus & Day-by-Day Schedule</span>
              </h4>

              {todayFocusTopics.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {todayFocusTopics.map(topic => (
                    <div key={topic.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input 
                        type="checkbox"
                        checked={topic.completed}
                        onChange={() => dispatch({ type: 'TOGGLE_ROADMAP_TOPIC', payload: { topicId: topic.id } })}
                        style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--accent)' }}
                      />
                      <span style={{ 
                        fontSize: 13, 
                        color: topic.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                        textDecoration: topic.completed ? 'line-through' : 'none'
                      }}>
                        {topic.text}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  No roadmap tasks scheduled for today. Click the &quot;+ Schedule Day&quot; button on any topic below to add it to today&apos;s calendar, or click &quot;📅 Schedule Week Day-by-Day&quot; to plan out a week instantly!
                </div>
              )}
            </div>
          </div>

          {/* Month Iteration */}
          {roadmap.map((month, mIdx) => (
            <div key={mIdx} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Month Header Banner */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.04) 100%)',
                borderLeft: '4px solid var(--accent)',
                borderRadius: '0 12px 12px 0',
                padding: '16px 20px'
              }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{month.title}</h3>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, fontSize: 13, color: 'var(--green)' }}>
                  <span>🎯 Month Milestone:</span>
                  <span style={{ fontWeight: 500 }}>{month.milestone}</span>
                </div>
              </div>

              {/* Weeks Iteration */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingLeft: 8 }}>
                {month.weeks.map((week, wIdx) => (
                  <div key={wIdx} className="card" style={{ padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--accent)' }}>{week.title}</h4>
                      <button
                        onClick={() => scheduleWeekDayByDay(week)}
                        className="btn btn-sm btn-secondary"
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, cursor: 'pointer' }}
                      >
                        📅 Schedule Week Day-by-Day
                      </button>
                    </div>
                    
                    {/* Topics/Tasks Iteration */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {week.topics.map((topic) => (
                        <div 
                          key={topic.id} 
                          style={{ 
                            display: 'flex', 
                            gap: 12, 
                            alignItems: 'flex-start',
                            padding: '10px 12px',
                            background: topic.completed ? 'rgba(16, 185, 129, 0.02)' : 'rgba(255, 255, 255, 0.01)',
                            border: `1px solid ${topic.completed ? 'rgba(16, 185, 129, 0.1)' : 'var(--border)'}`,
                            borderRadius: 8,
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <input 
                            type="checkbox"
                            checked={topic.completed}
                            onChange={() => dispatch({ type: 'TOGGLE_ROADMAP_TOPIC', payload: { topicId: topic.id } })}
                            style={{ 
                              marginTop: 3,
                              width: 16, 
                              height: 16, 
                              cursor: 'pointer',
                              accentColor: 'var(--accent)'
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              fontSize: 14, 
                              color: topic.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                              textDecoration: topic.completed ? 'line-through' : 'none',
                              lineHeight: 1.4,
                              fontWeight: 500
                            }}>
                              {topic.text}
                            </div>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 12 }}>
                                ⏳ {topic.hours}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>
                                📚 {topic.resource}
                              </span>
                            </div>

                            {/* Daily Scheduler controls */}
                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 8 }}>
                              {(() => {
                                const goalId = `roadmap-${topic.id}`;
                                const existingGoal = state.goals.find(g => g.id === goalId);
                                if (existingGoal) {
                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ fontSize: 11, color: 'var(--green)', background: 'rgba(16, 185, 129, 0.06)', padding: '2px 8px', borderRadius: 12, fontWeight: 500 }}>
                                        📅 Scheduled: {new Date(existingGoal.deadline).toLocaleDateString()}
                                      </span>
                                      <button
                                        onClick={() => dispatch({ type: 'DELETE_GOAL', payload: goalId })}
                                        style={{
                                          background: 'none', border: 'none', color: 'var(--red)',
                                          cursor: 'pointer', fontSize: 11, textDecoration: 'underline', padding: 0
                                        }}
                                      >
                                        Unschedule
                                      </button>
                                    </div>
                                  );
                                }
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>📅 Unscheduled</span>
                                    <input
                                      type="date"
                                      id={`date-${topic.id}`}
                                      defaultValue={new Date().toISOString().split('T')[0]}
                                      style={{
                                        background: 'rgba(0,0,0,0.2)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 6,
                                        color: 'var(--text-primary)',
                                        fontSize: 11,
                                        padding: '2px 4px',
                                        outline: 'none'
                                      }}
                                    />
                                    <button
                                      onClick={() => {
                                        const dateVal = (document.getElementById(`date-${topic.id}`) as HTMLInputElement)?.value || new Date().toISOString().split('T')[0];
                                        dispatch({
                                          type: 'ADD_GOAL',
                                          payload: {
                                            id: goalId,
                                            text: `[Roadmap] ${topic.text}`,
                                            deadline: dateVal,
                                            done: topic.completed
                                          }
                                        });
                                      }}
                                      className="btn btn-sm btn-secondary"
                                      style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, cursor: 'pointer' }}
                                    >
                                      + Schedule Day
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!roadmap && !generating && (
        <div className="empty-state">
          <div className="empty-icon">🗺️</div>
          <h3>Create your learning path</h3>
          <p>Provide your target role above to outline a step-by-step roadmap to close your skill gaps based on your CV.</p>
        </div>
      )}
    </div>
  );
}
