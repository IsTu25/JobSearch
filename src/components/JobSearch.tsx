'use client';
import { useState } from 'react';
import { useApp } from '@/lib/store';
import { JobResult } from '@/lib/types';

export default function JobSearch() {
  const { state, dispatch } = useApp();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const [filterRemote, setFilterRemote] = useState<'all' | 'remote' | 'onsite'>('all');
  const [filterCountry, setFilterCountry] = useState<'all' | 'local' | 'international'>('all');
  const [filterType, setFilterType] = useState<'all' | 'fulltime' | 'parttime' | 'internship'>('all');
  const [minScore, setMinScore] = useState<number>(0);
  const [selectedJob, setSelectedJob] = useState<JobResult | null>(null);

  const userCountry = (state.profile.targetLocation || '').toLowerCase().trim();

  const filteredJobs = state.jobResults.filter(job => {
    // 1. Remote filter
    const locLower = job.location.toLowerCase();
    const isJobRemote = locLower.includes('remote') || locLower.includes('anywhere') || locLower.includes('work from home');
    if (filterRemote === 'remote' && !isJobRemote) return false;
    if (filterRemote === 'onsite' && isJobRemote) return false;

    // 2. Country/Geography filter
    if (filterCountry !== 'all' && userCountry) {
      // Split user target location into keywords (e.g. "Dhaka, Bangladesh" -> ["dhaka", "bangladesh"])
      const targetWords = userCountry.split(/[,\s]+/).map(w => w.trim()).filter(w => w.length > 2);
      
      let isLocal = false;
      if (targetWords.length > 0) {
        isLocal = targetWords.some(word => locLower.includes(word));
      } else {
        isLocal = locLower.includes(userCountry);
      }

      // If user target location is remote and job is remote, count as local
      if (userCountry.includes('remote') && isJobRemote) {
        isLocal = true;
      }

      if (filterCountry === 'local' && !isLocal) return false;
      if (filterCountry === 'international' && isLocal) return false;
    }

    // 3. Job Type filter
    const titleLower = job.title.toLowerCase();
    const descLower = job.description.toLowerCase();
    const tagsLower = job.tags.map(t => t.toLowerCase());
    
    const isInternship = titleLower.includes('intern') || descLower.includes('internship') || tagsLower.includes('internship') || tagsLower.includes('intern');
    const isPartTime = titleLower.includes('part-time') || titleLower.includes('parttime') || descLower.includes('part-time') || tagsLower.includes('part-time');
    const isFullTime = !isInternship && !isPartTime;

    if (filterType === 'internship' && !isInternship) return false;
    if (filterType === 'parttime' && !isPartTime) return false;
    if (filterType === 'fulltime' && !isFullTime) return false;

    // 4. Fit Score filter
    if (job.fitScore < minScore) return false;

    return true;
  });

  async function searchJobs(customQuery?: string) {
    const activeQuery = typeof customQuery === 'string' ? customQuery : query;
    if (!activeQuery.trim()) return;
    setSearching(true);
    dispatch({ type: 'SET_JOB_RESULTS', payload: [] });

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: activeQuery.trim(),
          location: '', // Handled by Gemini NLP parser on the backend
          cvText: state.profile.cvText,
          targetRole: state.profile.targetRole,
        }),
      });
      const data = await res.json();
      dispatch({ type: 'SET_JOB_RESULTS', payload: data.jobs || [] });
    } catch {
      console.error('Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function searchByCV() {
    if (!state.profile.cvText) return;
    
    let roles: string[] = [];
    if (state.profile.cvScore?.predictedRoles && state.profile.cvScore.predictedRoles.length > 0) {
      roles = state.profile.cvScore.predictedRoles.map(p => p.role).slice(0, 3);
    } else {
      roles = [
        state.profile.targetRole || 'Software Engineer',
        'Frontend Developer',
        'Backend Developer'
      ];
    }
    
    const loc = state.profile.targetLocation || 'Remote';
    setSearching(true);
    dispatch({ type: 'SET_JOB_RESULTS', payload: [] });
    setQuery(`Matching sectors: ${roles.join(', ')}`);

    try {
      const searchPromises = roles.map(async (role) => {
        const autoQuery = `Find me ${role} jobs in ${loc}`;
        try {
          const res = await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: autoQuery,
              location: '',
              cvText: state.profile.cvText,
              targetRole: role,
            }),
          });
          const data = await res.json();
          return data.jobs || [];
        } catch (err) {
          console.error(`Failed to fetch jobs for role: ${role}`, err);
          return [];
        }
      });

      const results = await Promise.all(searchPromises);
      const allJobs = results.flat();
      const seen = new Set<string>();
      const uniqueJobs = [];

      for (const job of allJobs) {
        const uniqueKey = job.url || `${job.title.toLowerCase()}_${job.company.toLowerCase()}`;
        if (!seen.has(uniqueKey)) {
          seen.add(uniqueKey);
          uniqueJobs.push(job);
        }
      }

      uniqueJobs.sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0));
      dispatch({ type: 'SET_JOB_RESULTS', payload: uniqueJobs });
    } catch (err) {
      console.error('Unified matching search failed', err);
    } finally {
      setSearching(false);
    }
  }

  function trackJob(job: typeof state.jobResults[0]) {
    const alreadyTracked = state.applications.some(
      a => a.url === job.url || (a.role === job.title && a.company === job.company)
    );
    if (alreadyTracked) {
      alert('Already tracking this job!');
      return;
    }
    dispatch({
      type: 'ADD_APPLICATION',
      payload: {
        id: Date.now().toString(),
        company: job.company,
        role: job.title,
        status: 'saved',
        appliedDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: '',
        source: job.source,
        url: job.url,
      },
    });
  }

  function getFitColor(score: number) {
    if (score >= 75) return 'var(--green)';
    if (score >= 50) return 'var(--yellow)';
    return 'var(--red)';
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>🔍 Job Hunter Agent</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Search across LinkedIn, Indeed, Glassdoor, Adzuna & more using natural language — every result scored against your CV.
        </p>
      </div>

      {/* CV Auto-match Banner */}
      {state.cvUploaded ? (
        <div style={{
          background: 'rgba(16, 185, 129, 0.03)',
          border: '1px solid rgba(16, 185, 129, 0.15)',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📄 CV Matcher Ready</span>
                {state.profile.targetRole && (
                  <span style={{ fontSize: 11, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: 12, fontWeight: 400, color: 'var(--green)' }}>
                    Roadmap Target: {state.profile.targetRole}
                  </span>
                )}
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                Click Match to search with your primary predicted role, or click one of the AI-predicted sectors below.
              </p>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={searchByCV} 
              disabled={searching} 
              style={{ 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                border: 'none',
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer'
              }}
            >
              ✨ Match Jobs to My CV
            </button>
          </div>

          {/* AI Predicted Sectors & Match Selection */}
          {state.profile.cvScore?.predictedRoles && state.profile.cvScore.predictedRoles.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                🔮 AI Predicted Suitable Sectors (Click to search):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {state.profile.cvScore.predictedRoles.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const loc = state.profile.targetLocation || 'Remote';
                      const autoQuery = `Find me ${p.role} jobs in ${loc}`;
                      setQuery(autoQuery);
                      searchJobs(autoQuery);
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border)',
                      borderRadius: 20,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                    }}
                  >
                    <span>{p.role}</span>
                    <span style={{ fontSize: 10, background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
                      {p.matchPercentage}% Fit
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          background: 'rgba(239, 68, 68, 0.05)',
          border: '1px dashed rgba(239, 68, 68, 0.2)',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚠️ CV Not Uploaded</span>
            </h4>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              Upload your CV first in the Profile section to unlock live CV-to-job matching and automated fit scoring.
            </p>
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'profile' })}
            style={{ fontSize: 13, padding: '8px 16px', cursor: 'pointer' }}
          >
            Go to Profile →
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Ask the Job Hunter Agent</label>
            <div style={{ display: 'flex', gap: 12 }}>
              <input
                className="input"
                style={{ flex: 1, height: 44, fontSize: 14 }}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="e.g. 'Find me ML internships in Dhaka open this month'"
                onKeyDown={e => e.key === 'Enter' && searchJobs()}
              />
              <button className="btn btn-primary" onClick={() => searchJobs()} disabled={searching} style={{ height: 44, padding: '0 24px' }}>
                {searching ? '⏳ Searching...' : '🔍 Search'}
              </button>
            </div>
          </div>

          {/* Suggestions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>Try queries:</span>
            {[
              "Find me ML internships in Dhaka open this month",
              "React developer roles in Remote paying over $100k",
              "Python software engineer jobs in London",
              "UI/UX designer internships in New York"
            ].map(prompt => (
              <button
                key={prompt}
                onClick={async () => {
                  setQuery(prompt);
                  await searchJobs(prompt);
                }}
                className="btn btn-secondary btn-sm"
                style={{ 
                  fontSize: 12, 
                  background: 'rgba(255,255,255,0.03)', 
                  border: '1px solid var(--border)',
                  padding: '4px 12px',
                  borderRadius: 16,
                  cursor: 'pointer'
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {searching && (
        <div className="empty-state">
          <div style={{ fontSize: 40, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</div>
          <h3 style={{ marginTop: 12 }}>Searching 6+ platforms...</h3>
          <p>LinkedIn, Indeed, Glassdoor, Adzuna, and more</p>
        </div>
      )}

      {!searching && state.jobResults.length > 0 && (
        <>
          {/* Quick Filters Glassmorphism Bar */}
          <div className="card animate-fade-in" style={{ 
            marginBottom: 24, 
            padding: '16px 20px', 
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 12
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  ⚡ Quick Filters 
                  <span style={{ fontSize: 11, background: 'rgba(255, 255, 255, 0.08)', padding: '2px 8px', borderRadius: 12, color: 'var(--text-muted)' }}>
                    Showing {filteredJobs.length} of {state.jobResults.length}
                  </span>
                </span>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}
                  onClick={() => {
                    setFilterRemote('all');
                    setFilterCountry('all');
                    setFilterType('all');
                    setMinScore(0);
                  }}
                >
                  Reset Filters
                </button>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                gap: 16,
                marginTop: 4
              }}>
                {/* Location Type Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>WORK MODE</label>
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
                    {(['all', 'remote', 'onsite'] as const).map(option => (
                      <button
                        key={option}
                        onClick={() => setFilterRemote(option)}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          fontSize: 10,
                          fontWeight: 600,
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: filterRemote === option ? 'var(--accent)' : 'transparent',
                          color: filterRemote === option ? '#fff' : 'var(--text-secondary)',
                          textTransform: 'capitalize',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Geography Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>GEOGRAPHY</label>
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
                    {(['all', 'local', 'international'] as const).map(option => (
                      <button
                        key={option}
                        onClick={() => setFilterCountry(option)}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          fontSize: 10,
                          fontWeight: 600,
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: filterCountry === option ? 'var(--accent)' : 'transparent',
                          color: filterCountry === option ? '#fff' : 'var(--text-secondary)',
                          textTransform: 'capitalize',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {option === 'local' ? 'Local' : option}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Job Type Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>ROLE TYPE</label>
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
                    {(['all', 'fulltime', 'parttime', 'internship'] as const).map(option => (
                      <button
                        key={option}
                        onClick={() => setFilterType(option)}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          fontSize: 10,
                          fontWeight: 600,
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: filterType === option ? 'var(--accent)' : 'transparent',
                          color: filterType === option ? '#fff' : 'var(--text-secondary)',
                          textTransform: 'capitalize',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {option === 'fulltime' ? 'Full-Time' : option === 'parttime' ? 'Part-Time' : option}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fit Score Match Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>MIN FIT SCORE</label>
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
                    {([0, 50, 75] as const).map(score => (
                      <button
                        key={score}
                        onClick={() => setMinScore(score)}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          fontSize: 10,
                          fontWeight: 600,
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: minScore === score ? 'var(--accent)' : 'transparent',
                          color: minScore === score ? '#fff' : 'var(--text-secondary)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {score === 0 ? 'All' : `${score}%+`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Found <strong style={{ color: 'var(--text-primary)' }}>{filteredJobs.length}</strong> matching jobs
          </p>
          <div className="jobs-grid">
            {filteredJobs.map(job => (
              <div key={job.id} className="job-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedJob(job)}>
                <div className="job-card-header">
                  <div>
                    <div className="job-card-title">{job.title}</div>
                    <div className="job-card-company">{job.company}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: getFitColor(job.fitScore) }}>
                      {job.fitScore}%
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>FIT SCORE</div>
                  </div>
                </div>

                <div className="fit-score-bar">
                  <div className="fit-score-fill" style={{ width: `${job.fitScore}%`, background: getFitColor(job.fitScore) }} />
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Skills: {job.fitBreakdown.skills}% | Exp: {job.fitBreakdown.experience}% | Edu: {job.fitBreakdown.education}% | Loc: {job.fitBreakdown.location}%
                </div>

                <div className="job-card-meta">
                  <span>📍 {job.location}</span>
                  <span>💰 {job.salary}</span>
                  <span>🏢 {job.source}</span>
                  <span>🗓 {job.postedDate}</span>
                </div>

                {job.matchReasons.length > 0 && (
                  <div style={{ margin: '12px 0' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>✅ Why you match:</div>
                    {job.matchReasons.slice(0, 2).map((r, i) => (
                      <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 16 }}>• {r}</div>
                    ))}
                  </div>
                )}

                <div className="job-card-tags">
                  {job.tags.slice(0, 3).map((t, i) => <span key={i} className="tag">{t}</span>)}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedJob(job); }}>
                    🔍 Details
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); trackJob(job); }}>
                    📋 Track
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Job Details Modal */}
          {selectedJob && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 20
            }} onClick={() => setSelectedJob(null)}>
              <div style={{
                background: 'rgba(15,15,20,0.95)',
                border: '1px solid var(--border)',
                borderRadius: 24,
                width: '100%',
                maxWidth: 680,
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: 32,
                position: 'relative',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
              }} onClick={e => e.stopPropagation()}>
                <button 
                  onClick={() => setSelectedJob(null)}
                  style={{
                    position: 'absolute',
                    top: 20,
                    right: 20,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16
                  }}
                >
                  ✕
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{selectedJob.title}</h2>
                    <p style={{ color: 'var(--accent)', fontSize: 16, fontWeight: 600, margin: '4px 0 0 0' }}>{selectedJob.company}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: getFitColor(selectedJob.fitScore) }}>
                      {selectedJob.fitScore}%
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>CV FIT MATCH</div>
                  </div>
                </div>

                {/* Score breakdown metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 20 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple)' }}>{selectedJob.fitBreakdown.skills}%</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Skills</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>{selectedJob.fitBreakdown.experience}%</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Experience</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--yellow)' }}>{selectedJob.fitBreakdown.education}%</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Education</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{selectedJob.fitBreakdown.location}%</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Location</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 24 }}>
                  <span style={{ background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: 8 }}>📍 {selectedJob.location}</span>
                  <span style={{ background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: 8 }}>💰 {selectedJob.salary}</span>
                  <span style={{ background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: 8 }}>🏢 {selectedJob.source}</span>
                  <span style={{ background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: 8 }}>🗓 Posted: {selectedJob.postedDate}</span>
                </div>

                {/* AI Insights tabs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                  <div style={{ background: 'rgba(16,185,129,0.02)', border: '1px solid rgba(16,185,129,0.1)', borderRadius: 12, padding: 16 }}>
                    <h4 style={{ color: 'var(--green)', margin: '0 0 8px 0', fontSize: 14 }}>✅ Strengths Match</h4>
                    {selectedJob.matchReasons.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {selectedJob.matchReasons.map((r, i) => <li key={i} style={{ marginBottom: 4 }}>{r}</li>)}
                      </ul>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>General compatibility detected.</div>
                    )}
                  </div>

                  <div style={{ background: 'rgba(239,68,68,0.02)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 12, padding: 16 }}>
                    <h4 style={{ color: 'var(--red)', margin: '0 0 8px 0', fontSize: 14 }}>⚠️ Potential Gaps</h4>
                    {selectedJob.gaps.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {selectedJob.gaps.map((g, i) => <li key={i} style={{ marginBottom: 4 }}>{g}</li>)}
                      </ul>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No critical gaps identified!</div>
                    )}
                  </div>
                </div>

                {/* Full Job Description */}
                <div style={{ marginBottom: 32 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px 0' }}>📄 Full Job Description</h3>
                  <div style={{ 
                    fontSize: 13.5, 
                    color: 'var(--text-secondary)', 
                    lineHeight: 1.6, 
                    maxHeight: 250, 
                    overflowY: 'auto',
                    padding: 16,
                    background: 'rgba(0,0,0,0.15)',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {selectedJob.description || 'No description listed.'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => {
                      trackJob(selectedJob);
                      setSelectedJob(null);
                    }}
                    style={{ padding: '8px 20px', fontSize: 13 }}
                  >
                    📋 Add to Tracker
                  </button>
                  <a 
                    href={selectedJob.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-primary"
                    style={{ padding: '8px 24px', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                  >
                    Apply Now →
                  </a>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {!searching && state.jobResults.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>Search for your next opportunity</h3>
          <p>Enter a role and location above. We&apos;ll search 6+ platforms and score every result against your CV.</p>
        </div>
      )}
    </div>
  );
}
