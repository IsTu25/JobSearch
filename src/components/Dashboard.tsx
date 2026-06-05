import { useState } from 'react';
import { useApp } from '@/lib/store';

export default function Dashboard() {
  const { state, dispatch } = useApp();
  const { profile, applications, cvUploaded, jobResults } = state;
  const [statsMode, setStatsMode] = useState<'total' | 'weekly'>('total');

  const [digestHtml, setDigestHtml] = useState<string | null>(null);
  const [loadingDigest, setLoadingDigest] = useState(false);
  const [showDigestModal, setShowDigestModal] = useState(false);
  const [emailInput, setEmailInput] = useState(profile.email || '');

  // Goals
  const goals = state.goals || [];

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

  async function triggerDigest() {
    setLoadingDigest(true);
    setDigestHtml(null);
    setShowDigestModal(true);
    try {
      const res = await fetch('/api/email-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput || 'user@example.com',
          streak,
          applications,
          goals,
          targetRole: profile.targetRole || 'Software Engineer',
        }),
      });
      const data = await res.json();
      if (data.html) {
        setDigestHtml(data.html);
      } else {
        setDigestHtml(`<p style="color:var(--red)">Error: ${data.error || 'Failed to generate digest'}</p>`);
      }
    } catch {
      setDigestHtml('<p style="color:var(--red)">Failed to reach server. Check backend.</p>');
    } finally {
      setLoadingDigest(false);
    }
  }

  const applied = applications.filter(a => a.status === 'applied').length;
  const interviewing = applications.filter(a => a.status === 'interviewing').length;
  const offers = applications.filter(a => a.status === 'offer').length;
  const rejected = applications.filter(a => a.status === 'rejected').length;

  // Weekly stats
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const weeklyApplications = applications.filter(a => new Date(a.appliedDate) >= last7Days).length;
  const weeklyApplied = applications.filter(a => a.status === 'applied' && new Date(a.appliedDate) >= last7Days).length;
  const weeklyInterviewing = applications.filter(a => a.status === 'interviewing' && new Date(a.appliedDate) >= last7Days).length;
  const weeklyOffers = applications.filter(a => a.status === 'offer' && new Date(a.appliedDate) >= last7Days).length;

  // Skills count
  const skillChunk = profile.cvChunks.find(c => c.section.toLowerCase().includes('skill'));
  const skillsList = skillChunk 
    ? skillChunk.content.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 1)
    : [];
  const totalSkills = skillsList.length || 0;
  // For weekly, we count completed roadmap tasks
  const weeklySkills = state.roadmap 
    ? state.roadmap.flatMap(m => m.weeks.flatMap(w => w.topics)).filter(t => t.completed).length 
    : 0;

  // Roadmap metrics
  let totalRoadmapTasks = 0;
  let completedRoadmapTasks = 0;
  if (state.roadmap) {
    state.roadmap.forEach(month => {
      month.weeks.forEach(week => {
        week.topics.forEach(topic => {
          totalRoadmapTasks++;
          if (topic.completed) completedRoadmapTasks++;
        });
      });
    });
  }
  const roadmapPercent = totalRoadmapTasks > 0 ? Math.round((completedRoadmapTasks / totalRoadmapTasks) * 100) : 0;

  // Nudge logic
  const lastApp = applications.length > 0
    ? new Date(Math.max(...applications.map(a => new Date(a.appliedDate).getTime())))
    : null;
  const daysSinceLastApp = lastApp ? Math.floor((Date.now() - lastApp.getTime()) / 86400000) : null;

  // Top recommendations for nudge
  const topRecs = [...jobResults]
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 2);

  return (
    <div className="fade-in">
      {/* Nudge */}
      {cvUploaded && (daysSinceLastApp === null || daysSinceLastApp >= 3) && (
        <div className="card" style={{ 
          marginBottom: 24, 
          borderColor: 'rgba(245, 158, 11, 0.3)', 
          background: 'rgba(245, 158, 11, 0.03)',
          borderLeft: '4px solid var(--yellow)',
          padding: '18px 20px'
        }}>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚡ Proactive AI Nudge</span>
          </h4>
          <p style={{ fontSize: 13.5, margin: '6px 0 12px 0', color: 'var(--text-secondary)' }}>
            {daysSinceLastApp === null 
              ? "You haven't tracked any applications yet. Getting started early increases your chance of landing an offer!"
              : `It has been ${daysSinceLastApp} days since your last application activity. Keep applying to stay competitive!`}
          </p>
          
          {topRecs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>RECOMMENDED MATCHES FOR YOU:</div>
              {topRecs.map(job => (
                <div key={job.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '10px 14px'
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{job.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{job.company} • Fit Score: <strong style={{ color: job.fitScore >= 75 ? 'var(--green)' : 'var(--yellow)' }}>{job.fitScore}%</strong></div>
                  </div>
                  <button 
                    className="btn btn-sm btn-primary"
                    onClick={() => dispatch({ type: 'SET_VIEW', payload: 'jobs' })}
                    style={{ fontSize: 11, padding: '4px 10px' }}
                  >
                    View Post
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 12 }}>
              No live suggestions loaded. Use the &quot;Job Search&quot; tab to match jobs to your CV and populate recommendations!
            </div>
          )}
          
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-sm btn-primary" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'jobs' })} style={{ cursor: 'pointer' }}>
              🔍 Search Jobs
            </button>
            <button className="btn btn-sm btn-secondary" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'tracker' })} style={{ cursor: 'pointer' }}>
              📋 View Tracker
            </button>
          </div>
        </div>
      )}

      {state.authMode === 'guest' && (
        <div className="card" style={{
          marginBottom: 24,
          borderColor: 'rgba(59, 130, 246, 0.3)',
          background: 'rgba(59, 130, 246, 0.05)',
          borderLeft: '4px solid var(--blue)',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>
              💾 Guest Mode Active
            </h4>
            <p style={{ fontSize: 13, margin: 0, color: 'var(--text-secondary)' }}>
              You&apos;re in Guest Mode — your data is saved locally on this browser. Sign up to sync across devices and never lose your progress.
            </p>
          </div>
          <button 
            className="btn btn-sm btn-primary"
            onClick={() => {
              localStorage.removeItem('careerpilot_guest_mode');
              dispatch({ type: 'SET_USER', payload: { user: null, authMode: 'supabase' } });
            }}
            style={{ 
              background: 'var(--blue)', 
              borderColor: 'var(--blue)', 
              fontSize: 12.5,
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            Create Account →
          </button>
        </div>
      )}

      {/* Welcome & Stats Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            {profile.name ? `Welcome back, ${profile.name.split(' ')[0]}` : 'Welcome to চাকরির বাজার'} 👋
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, margin: 0 }}>
            {cvUploaded
              ? `Your career dashboard is ready. Target: ${profile.targetRole || 'Not set'}`
              : 'Upload your CV to unlock personalized career intelligence.'}
          </p>
        </div>

        {/* Stats Mode Toggle */}
        <div style={{ 
          display: 'flex', 
          background: 'rgba(0,0,0,0.2)', 
          padding: 4, 
          borderRadius: 10, 
          border: '1px solid var(--border)' 
        }}>
          <button
            onClick={() => setStatsMode('total')}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              background: statsMode === 'total' ? 'var(--accent)' : 'transparent',
              color: statsMode === 'total' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
          >
            Cumulative Stats
          </button>
          <button
            onClick={() => setStatsMode('weekly')}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              background: statsMode === 'weekly' ? 'var(--accent)' : 'transparent',
              color: statsMode === 'weekly' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
          >
            Weekly Stats
          </button>
        </div>
      </div>

      {/* Bento Grid Stats & Intelligence */}
      <div className="bento-grid" style={{ marginBottom: 24 }}>
        {/* Total stats - span 8 */}
        <div className="spotlight-card bento-item-8 fade-in stagger-1" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>📊 Performance & Tracker Metrics</h3>
              <span className="badge badge-purple" style={{ fontSize: 10 }}>Live Tracker</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 16 }}>
              <div style={{ textAlign: 'center', padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 10 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>{statsMode === 'total' ? applications.length : weeklyApplications}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Applications</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 10 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--blue)' }}>{statsMode === 'total' ? applied : weeklyApplied}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Applied</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 10 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--yellow)' }}>{statsMode === 'total' ? interviewing : weeklyInterviewing}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Interviewing</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 10 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)' }}>{statsMode === 'total' ? offers : weeklyOffers}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Offers</div>
              </div>
            </div>
          </div>
          <div style={{ background: 'rgba(99,102,241,0.03)', border: '1px solid rgba(99,102,241,0.08)', borderRadius: 8, padding: 10, marginTop: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
            🎯 <strong>AI Advice:</strong> Keep applications moving to interviewing status. Target 3 more outreach emails today!
          </div>
        </div>

        {/* Circular SVG CV Score Ring - span 4 */}
        <div className="spotlight-card bento-item-4 fade-in stagger-2" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px 0', alignSelf: 'flex-start' }}>🎯 Core CV Score</h3>
          {cvUploaded ? (
            <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle cx="60" cy="60" r="50" fill="transparent" stroke="url(#accentGrad)" strokeWidth="8"
                  strokeDasharray={314}
                  strokeDashoffset={314 - (314 * (profile.cvScore?.total || 70)) / 100}
                  strokeLinecap="round"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
                />
                <defs>
                  <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent)" />
                    <stop offset="100%" stopColor="var(--purple)" />
                  </linearGradient>
                </defs>
              </svg>
              <div style={{ position: 'absolute', fontSize: 24, fontWeight: 800 }}>{profile.cvScore?.total || 70}%</div>
            </div>
          ) : (
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {cvUploaded ? 'CV Health: Strong' : 'No CV Uploaded'}
          </span>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            {cvUploaded ? 'Optimize keyword frequency to reach 85%+' : 'Upload your CV in Profile to analyze score'}
          </p>
        </div>

        {/* Salary Benchmarking - span 6 */}
        <div className="spotlight-card bento-item-6 fade-in stagger-3" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>📊 Salary Benchmarking</h3>
              <span className="badge badge-purple" style={{ fontSize: 10 }}>Market Estimated Tiers</span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
              Current market tiers for <strong>{profile.targetRole || 'Software Engineer'}</strong> in <strong>{profile.targetLocation || 'Global'}</strong>.
            </p>

            <div style={{ padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                <span>10th Percentile</span>
                <span>Median (50th)</span>
                <span>90th Percentile</span>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, position: 'relative', overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ position: 'absolute', left: '15%', right: '15%', top: 0, bottom: 0, background: 'linear-gradient(90deg, var(--yellow), var(--green), var(--purple))', borderRadius: 4 }} />
                {profile.preferredSalary && (
                  <div style={{ position: 'absolute', left: '55%', top: 0, bottom: 0, width: 4, background: '#fff', boxShadow: '0 0 8px #fff' }} />
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                <span>{profile.preferredSalary ? `${profile.preferredSalary.replace(/\D/g, '') ? '$' + Math.round(Number(profile.preferredSalary.replace(/\D/g, '')) * 0.75 / 1000) + 'k' : '$60k'}` : '$60k'}</span>
                <span style={{ color: 'var(--green)' }}>{profile.preferredSalary ? `${profile.preferredSalary}` : '$95k'}</span>
                <span>{profile.preferredSalary ? `${profile.preferredSalary.replace(/\D/g, '') ? '$' + Math.round(Number(profile.preferredSalary.replace(/\D/g, '')) * 1.35 / 1000) + 'k' : '$145k'}` : '$145k'}</span>
              </div>
            </div>
          </div>
          <div style={{ background: 'rgba(99,102,241,0.03)', border: '1px solid rgba(99,102,241,0.1)', borderRadius: 10, padding: 12, marginTop: 14, fontSize: 12, color: 'var(--text-secondary)' }}>
            💡 <strong>Negotiation Tip:</strong> The median rate for this role is healthy. Aim for the 70th percentile during initial screening.
          </div>
        </div>

        {/* Skills Gap Heatmap - span 6 */}
        <div className="spotlight-card bento-item-6 fade-in stagger-4" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>🔥 Skills Demand & CV Gaps</h3>
            <span className="badge badge-blue" style={{ fontSize: 10 }}>Live Matches</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
            Analysis of <strong>{jobResults.length}</strong> matching jobs vs. your CV skills.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {jobResults.length > 0 ? (
              (() => {
                const commonTech = [
                  'React', 'Next.js', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'Java', 'SQL', 'Docker', 'AWS', 'Tailwind', 'Git', 'System Design'
                ];
                const parsedDescs = jobResults.map(j => (j.description || '').toLowerCase());
                const cvTextLower = (profile.cvText || '').toLowerCase();
                
                const stats = commonTech.map(tech => {
                  const demand = parsedDescs.filter(d => d.includes(tech.toLowerCase())).length;
                  const hasIt = cvTextLower.includes(tech.toLowerCase());
                  return { tech, demand, hasIt };
                }).filter(s => s.demand > 0).sort((a, b) => b.demand - a.demand).slice(0, 3);

                if (stats.length === 0) {
                  return <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Perform a job search to populate the heatmap!</div>;
                }

                return stats.map(s => (
                  <div key={s.tech} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(0,0,0,0.15)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14 }}>{s.hasIt ? '🟢' : '🔴'}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: s.hasIt ? 'var(--text-primary)' : 'var(--yellow)' }}>{s.tech}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Demand: {Math.round(s.demand / jobResults.length * 100)}%</span>
                      <span style={{ fontSize: 11, background: s.hasIt ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: s.hasIt ? 'var(--green)' : 'var(--red)', padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>
                        {s.hasIt ? 'HAVE' : 'GAP'}
                      </span>
                    </div>
                  </div>
                ));
              })()
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                🔍 Search for jobs first to analyze skills demand and gaps.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid-2" style={{ marginTop: 8 }}>
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => dispatch({ type: 'SET_VIEW', payload: 'chat' })}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>AI Career Assistant</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Get personalized career advice, interview prep, cover letters, and skill gap analysis — all grounded in your CV.
          </p>
        </div>

        <div className="card" style={{ cursor: 'pointer' }} onClick={() => dispatch({ type: 'SET_VIEW', payload: 'jobs' })}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Smart Job Search</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Search across LinkedIn, Indeed, Glassdoor, Adzuna, and more. Every result scored against your profile.
          </p>
        </div>

        <div className="card" style={{ cursor: 'pointer' }} onClick={() => dispatch({ type: 'SET_VIEW', payload: 'profile' })}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Profile & CV Intel</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Upload your CV, get ATS scoring, keyword analysis, and section-by-section improvement tips.
          </p>
        </div>

        <div className="card" style={{ cursor: 'pointer' }} onClick={() => dispatch({ type: 'SET_VIEW', payload: 'tracker' })}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Application Tracker</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Track every application from saved → applied → interviewing → offer. Stay accountable.
          </p>
        </div>
      </div>

      {/* CV Score preview */}
      {profile.cvScore && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <h3 className="card-title">📊 CV Score</h3>
            <span className="badge badge-purple">{profile.cvScore.total}/100</span>
          </div>
          <div className="progress-bar" style={{ marginBottom: 12 }}>
            <div className="progress-fill" style={{ width: `${profile.cvScore.total}%` }} />
          </div>
          <div className="grid-2" style={{ gap: 8 }}>
            {[
              { label: 'Content Clarity', val: profile.cvScore.contentClarity, max: 25 },
              { label: 'Keyword Optimization', val: profile.cvScore.keywordOptimization, max: 25 },
              { label: 'Quantified Impact', val: profile.cvScore.quantifiedImpact, max: 20 },
              { label: 'Formatting', val: profile.cvScore.formatting, max: 15 },
              { label: 'Completeness', val: profile.cvScore.completeness, max: 15 },
            ].map(item => (
              <div key={item.label} style={{ fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span>{item.val}/{item.max}</span>
                </div>
                <div className="progress-bar" style={{ height: 4 }}>
                  <div className="progress-fill" style={{ width: `${(item.val / item.max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {applications.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <h3 className="card-title">Recent Activity</h3>
          </div>
          {applications.slice(-5).reverse().map(app => (
            <div key={app.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{app.role}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{app.company}</div>
              </div>
              <span className={`badge badge-${app.status === 'offer' ? 'green' : app.status === 'rejected' ? 'red' : app.status === 'interviewing' ? 'yellow' : 'blue'}`}>
                {app.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Weekly AI Email Digest & Alert Settings */}
      <div className="card" style={{ marginTop: 24, background: 'rgba(99,102,241,0.03)', border: '1px solid rgba(99,102,241,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>📧 Weekly AI Digest & Match Alerts</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Receive a weekly recap of job matches, application follow-ups, and learning milestones.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="email"
              placeholder="Enter your email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 13,
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                width: 200,
                outline: 'none'
              }}
            />
            <button
              onClick={triggerDigest}
              className="btn btn-primary"
              style={{ fontSize: 13, padding: '8px 16px', fontWeight: 600 }}
            >
              🚀 Simulate Digest
            </button>
          </div>
        </div>
      </div>

      {/* Digest Simulation Modal */}
      {showDigestModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 640,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>📧 Weekly AI Digest Preview</h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sent to: {emailInput || 'guest@chakrirbazar.com'}</span>
              </div>
              <button
                onClick={() => setShowDigestModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: 1, background: 'rgba(255,255,255,0.01)' }}>
              {loadingDigest ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 32, animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: 12 }}>⏳</div>
                  <div>Compiling weekly metrics and personalized AI recommendations…</div>
                </div>
              ) : digestHtml ? (
                <div dangerouslySetInnerHTML={{ __html: digestHtml }} />
              ) : (
                <div style={{ color: 'var(--red)' }}>Failed to generate digest.</div>
              )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => {
                  alert(`Subscription saved! Recaps will be sent to ${emailInput || 'your registered email'} every Friday.`);
                  setShowDigestModal(false);
                }}
                className="btn btn-primary"
                style={{ fontSize: 13 }}
              >
                🔔 Subscribe to Digest
              </button>
              <button
                onClick={() => setShowDigestModal(false)}
                className="btn btn-secondary"
                style={{ fontSize: 13 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
