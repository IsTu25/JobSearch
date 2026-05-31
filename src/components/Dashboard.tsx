import { useState } from 'react';
import { useApp } from '@/lib/store';

export default function Dashboard() {
  const { state, dispatch } = useApp();
  const { profile, applications, cvUploaded, jobResults } = state;
  const [statsMode, setStatsMode] = useState<'total' | 'weekly'>('total');

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

      {/* Dynamic Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent)' }}>
            {statsMode === 'total' ? applications.length : weeklyApplications}
          </div>
          <div className="stat-label">
            {statsMode === 'total' ? 'Total Applications' : 'Applications (Week)'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--blue)' }}>
            {statsMode === 'total' ? applied : weeklyApplied}
          </div>
          <div className="stat-label">
            {statsMode === 'total' ? 'Applied' : 'Applied (Week)'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--yellow)' }}>
            {statsMode === 'total' ? interviewing : weeklyInterviewing}
          </div>
          <div className="stat-label">
            {statsMode === 'total' ? 'Interviewing' : 'Interviewing (Week)'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--green)' }}>
            {statsMode === 'total' ? offers : weeklyOffers}
          </div>
          <div className="stat-label">
            {statsMode === 'total' ? 'Offers' : 'Offers (Week)'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--purple)' }}>
            {statsMode === 'total' ? `${roadmapPercent}%` : weeklySkills}
          </div>
          <div className="stat-label">
            {statsMode === 'total' ? 'Roadmap Complete' : 'Skills Mastered (Week)'}
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
    </div>
  );
}
