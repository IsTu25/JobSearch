'use client';
import { useState } from 'react';
import { useApp } from '@/lib/store';
import { JobResult } from '@/lib/types';

// ---------- ATS Keyword Highlighter ----------

/** ATS keywords we care about — skills and common JD phrases. */
const ATS_KEYWORDS = [
  'python', 'javascript', 'typescript', 'react', 'node', 'java', 'c++', 'c#', 'sql', 'mongodb',
  'aws', 'docker', 'kubernetes', 'git', 'linux', 'html', 'css', 'flask', 'django', 'express',
  'tensorflow', 'pytorch', 'machine learning', 'deep learning', 'data analysis', 'figma',
  'next.js', 'vue', 'angular', 'go', 'rust', 'swift', 'kotlin', 'flutter', 'dart',
  'postgresql', 'redis', 'graphql', 'rest api', 'ci/cd', 'agile', 'scrum', 'jira',
  'communication', 'leadership', 'teamwork', 'problem solving', 'bachelor', 'master',
  'internship', 'full-time', 'part-time', 'remote', 'on-site', 'hybrid',
];

function extractATSKeywords(description: string): string[] {
  const descLower = description.toLowerCase();
  return ATS_KEYWORDS.filter(kw => descLower.includes(kw));
}

interface ATSHighlighterProps {
  description: string;
  cvText: string;
}

function ATSHighlighter({ description, cvText }: ATSHighlighterProps) {
  const cvLower = cvText.toLowerCase();
  const foundKeywords = extractATSKeywords(description);
  const presentInCV = foundKeywords.filter(kw => cvLower.includes(kw));
  const missingFromCV = foundKeywords.filter(kw => !cvLower.includes(kw));
  const atsScore = foundKeywords.length > 0 ? Math.round((presentInCV.length / foundKeywords.length) * 100) : 0;

  // Build a highlighted HTML string by bolding + coloring keywords
  let highlighted = description;
  // Sort by length DESC so "machine learning" matches before "machine"
  const sortedKws = [...foundKeywords].sort((a, b) => b.length - a.length);
  for (const kw of sortedKws) {
    const inCV = cvLower.includes(kw);
    const color = inCV ? '#22c55e' : '#f59e0b';
    const bg = inCV ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)';
    const regex = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    highlighted = highlighted.replace(
      regex,
      `<mark style="background:${bg};color:${color};border-radius:3px;padding:0 2px;font-weight:600;">$1</mark>`
    );
  }

  return (
    <div>
      {/* ATS Score Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
        padding: '10px 14px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: 10,
        border: '1px solid var(--border)',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: atsScore >= 60 ? 'var(--green)' : atsScore >= 35 ? 'var(--yellow)' : 'var(--red)' }}>
            🤖 ATS Match: {atsScore}%
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            ({presentInCV.length}/{foundKeywords.length} keywords in your CV)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {presentInCV.slice(0, 5).map(kw => (
            <span key={kw} style={{ fontSize: 10, background: 'rgba(34,197,94,0.12)', color: 'var(--green)', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
              ✓ {kw}
            </span>
          ))}
          {missingFromCV.slice(0, 4).map(kw => (
            <span key={kw} style={{ fontSize: 10, background: 'rgba(245,158,11,0.12)', color: 'var(--yellow)', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
              ✗ {kw}
            </span>
          ))}
          {(presentInCV.length + missingFromCV.length > 9) && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 4px' }}>
              +{foundKeywords.length - 9} more
            </span>
          )}
        </div>
      </div>

      {/* Highlighted description */}
      <div
        style={{
          fontSize: 13.5,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxHeight: 250,
          overflowY: 'auto',
          padding: 16,
          background: 'rgba(0,0,0,0.15)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          whiteSpace: 'pre-wrap',
        }}
        dangerouslySetInnerHTML={{ __html: highlighted || 'No description listed.' }}
      />

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        <span>
          <mark style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--green)', padding: '0 4px', borderRadius: 3 }}>green</mark>
          {' '}= in your CV
        </span>
        <span>
          <mark style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--yellow)', padding: '0 4px', borderRadius: 3 }}>amber</mark>
          {' '}= missing from CV
        </span>
      </div>
    </div>
  );
}

// ---------- End ATS Keyword Highlighter ----------


export default function JobSearch() {
  const { state, dispatch } = useApp();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [savedSearches, setSavedSearches] = useState<{id:string;query:string;savedAt:string}[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('savedSearches') || '[]'); } catch { return []; }
  });

  const [filterRemote, setFilterRemote] = useState<'all' | 'remote' | 'onsite'>('all');
  const [filterCountry, setFilterCountry] = useState<'all' | 'local' | 'international'>('all');
  const [filterType, setFilterType] = useState<'all' | 'fulltime' | 'parttime' | 'internship'>('all');
  const [minScore, setMinScore] = useState<number>(0);
  const [selectedJob, setSelectedJob] = useState<JobResult | null>(null);
  const [companyInfo, setCompanyInfo] = useState<Record<string, any> | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [showCompanyPanel, setShowCompanyPanel] = useState(false);

  function saveSearch() {
    if (!query.trim()) return;
    const newSaved = [{ id: Date.now().toString(), query: query.trim(), savedAt: new Date().toISOString() }, ...savedSearches.filter(s => s.query !== query.trim())].slice(0, 10);
    setSavedSearches(newSaved);
    localStorage.setItem('savedSearches', JSON.stringify(newSaved));
  }

  function deleteSavedSearch(id: string) {
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    localStorage.setItem('savedSearches', JSON.stringify(updated));
  }

  async function fetchCompanyInfo(company: string, role: string, location: string) {
    setLoadingCompany(true);
    setCompanyInfo(null);
    setShowCompanyPanel(true);
    try {
      const res = await fetch('/api/company-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, role, location }),
      });
      const data = await res.json();
      setCompanyInfo(data);
    } catch {
      setCompanyInfo({ error: 'Could not fetch company info.' });
    } finally {
      setLoadingCompany(false);
    }
  }

  // Cover letter state
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [loadingCover, setLoadingCover] = useState(false);
  const [showCoverPanel, setShowCoverPanel] = useState(false);

  async function generateCoverLetter(job: JobResult) {
    setLoadingCover(true);
    setCoverLetter(null);
    setShowCoverPanel(true);
    try {
      const res = await fetch('/api/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: job.title,
          company: job.company,
          jobDescription: job.description,
          cvText: state.profile.cvText || '',
          targetRole: state.profile.targetRole || '',
        }),
      });
      const data = await res.json();
      setCoverLetter(data.coverLetter || data.error || 'Error generating cover letter.');
    } catch {
      setCoverLetter('Failed to generate. Check your API key.');
    } finally {
      setLoadingCover(false);
    }
  }

  // CV tailor state
  const [tailorResult, setTailorResult] = useState<{tailoredSummary:string;tailoredSkills:string;keywordsAdded:string[];changes:string[]} | null>(null);
  const [loadingTailor, setLoadingTailor] = useState(false);
  const [showTailorPanel, setShowTailorPanel] = useState(false);

  async function tailorCV(job: JobResult) {
    if (!state.profile.cvText) { alert('Upload your CV first to tailor it.'); return; }
    setLoadingTailor(true);
    setTailorResult(null);
    setShowTailorPanel(true);
    try {
      const res = await fetch('/api/tailor-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cvText: state.profile.cvText,
          jobDescription: job.description,
          jobTitle: job.title,
          company: job.company,
        }),
      });
      const data = await res.json();
      setTailorResult(data);
    } catch {
      setTailorResult(null);
    } finally {
      setLoadingTailor(false);
    }
  }

  // Cold email draft state
  const [emailDraft, setEmailDraft] = useState<{subject:string;body:string} | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [showEmailPanel, setShowEmailPanel] = useState(false);

  async function generateEmailDraft(job: JobResult) {
    setLoadingEmail(true);
    setEmailDraft(null);
    setShowEmailPanel(true);
    try {
      const res = await fetch('/api/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: job.company,
          role: job.title,
          cvText: state.profile.cvText?.substring(0, 1500) || '',
        }),
      });
      const data = await res.json();
      setEmailDraft(data);
    } catch {
      setEmailDraft({ subject: 'Failed to generate', body: 'Please try again.' });
    } finally {
      setLoadingEmail(false);
    }
  }

  // Reset all panels when a job is selected — moved to click handlers below
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
              <button
                onClick={saveSearch}
                disabled={!query.trim()}
                title="Save this search for quick re-run"
                style={{ height: 44, padding: '0 14px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--accent)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}
              >
                🔔
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

          {/* Saved searches */}
          {savedSearches.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>🔔 Saved:</span>
              {savedSearches.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    onClick={() => { setQuery(s.query); searchJobs(s.query); }}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {s.query.length > 30 ? s.query.substring(0, 30) + '…' : s.query}
                  </button>
                  <button onClick={() => deleteSavedSearch(s.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}>×</button>
                </div>
              ))}
            </div>
          )}
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
              <div key={job.id} className="job-card spotlight-card" style={{ cursor: 'pointer' }} onClick={() => { setSelectedJob(job); setShowCompanyPanel(false); setCompanyInfo(null); setShowCoverPanel(false); setCoverLetter(null); setShowTailorPanel(false); setTailorResult(null); setShowEmailPanel(false); setEmailDraft(null); }}>
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
                    <div className="accordion-trigger" style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      ✨ Why you match (Hover to expand)
                    </div>
                    <div className="accordion-details" style={{ marginTop: 6 }}>
                      {job.matchReasons.map((r, i) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 12, marginBottom: 4 }}>
                          • {r}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="job-card-tags">
                  {job.tags.slice(0, 3).map((t, i) => <span key={i} className="tag">{t}</span>)}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedJob(job); setShowCompanyPanel(false); setCompanyInfo(null); setShowCoverPanel(false); setCoverLetter(null); setShowTailorPanel(false); setTailorResult(null); setShowEmailPanel(false); setEmailDraft(null); }}>
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

                {/* Full Job Description with ATS Keyword Highlighter */}
                <div style={{ marginBottom: 32 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px 0' }}>📄 Full Job Description</h3>
                  {state.profile.cvText ? (
                    <ATSHighlighter
                      description={selectedJob.description || ''}
                      cvText={state.profile.cvText}
                    />
                  ) : (
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
                  )}
                </div>

                {/* Cover Letter Generator */}
                <div style={{ marginBottom: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>✉️ Cover Letter Generator</h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Generate a custom-tailored cover letter using your CV highlights.</p>
                    </div>
                    {!showCoverPanel && (
                      <button
                        onClick={() => generateCoverLetter(selectedJob)}
                        style={{ fontSize: 12, fontWeight: 600, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--accent)', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        ✨ Generate Letter
                      </button>
                    )}
                  </div>

                  {showCoverPanel && (
                    <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                      {loadingCover ? (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                          ⏳ Writing cover letter based on your experience…
                        </div>
                      ) : (
                        <div>
                          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', maxHeight: 300, overflowY: 'auto' }}>
                            {coverLetter}
                          </pre>
                          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                            <button
                              onClick={() => {
                                if (coverLetter) navigator.clipboard.writeText(coverLetter);
                                alert('Cover letter copied to clipboard!');
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 12 }}
                            >
                              📋 Copy Letter
                            </button>
                            <button
                              onClick={() => {
                                const element = document.createElement("a");
                                const file = new Blob([coverLetter || ''], {type: 'text/plain'});
                                element.href = URL.createObjectURL(file);
                                element.download = `cover_letter_${selectedJob.company.toLowerCase().replace(/\s+/g, '_')}.txt`;
                                document.body.appendChild(element);
                                element.click();
                                document.body.removeChild(element);
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 12 }}
                            >
                              📥 Download .txt
                            </button>
                            <button onClick={() => { setShowCoverPanel(false); setCoverLetter(null); }} style={{ marginLeft: 'auto', fontSize: 11, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Hide ▲</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* CV Tailoring for Job */}
                <div style={{ marginBottom: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>🎯 Tailor CV Summary & Skills</h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Align your CV's top sections with this job description's keywords.</p>
                    </div>
                    {!showTailorPanel && (
                      <button
                        onClick={() => tailorCV(selectedJob)}
                        style={{ fontSize: 12, fontWeight: 600, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: 'var(--green)', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        🎯 Tailor CV
                      </button>
                    )}
                  </div>

                  {showTailorPanel && (
                    <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                      {loadingTailor ? (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                          ⏳ Analyzing skills alignment…
                        </div>
                      ) : tailorResult ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 4, fontSize: 12 }}>✨ TAILORED SUMMARY</div>
                            <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8 }}>{tailorResult.tailoredSummary}</p>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 4, fontSize: 12 }}>🛠 TAILORED SKILLS</div>
                            <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8 }}>{tailorResult.tailoredSkills}</p>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4, fontSize: 12 }}>🔍 KEYWORDS ADDED / PRIORITIZED</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                              {tailorResult.keywordsAdded.map((kw, i) => (
                                <span key={i} style={{ fontSize: 11, background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', padding: '3px 8px', borderRadius: 12 }}>
                                  {kw}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`SUMMARY:\n${tailorResult.tailoredSummary}\n\nSKILLS:\n${tailorResult.tailoredSkills}`);
                                alert('Tailored CV sections copied to clipboard!');
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 12 }}
                            >
                              📋 Copy Tailored Text
                            </button>
                            <button onClick={() => { setShowTailorPanel(false); setTailorResult(null); }} style={{ marginLeft: 'auto', fontSize: 11, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Hide ▲</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: 'var(--red)', fontSize: 13 }}>⚠️ Failed to tailor CV. Please try again.</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Cold Email Application Drafter */}
                <div style={{ marginBottom: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>📧 Cold Outreach Email Drafter</h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Generate a hyper-targeted outreach email to stand out to hiring managers.</p>
                    </div>
                    {!showEmailPanel && (
                      <button
                        onClick={() => generateEmailDraft(selectedJob)}
                        style={{ fontSize: 12, fontWeight: 600, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--accent)', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        📧 Draft Email
                      </button>
                    )}
                  </div>

                  {showEmailPanel && (
                    <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                      {loadingEmail ? (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                          ⏳ Drafting personalized email…
                        </div>
                      ) : emailDraft ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4, fontSize: 12 }}>SUBJECT</div>
                            <div style={{ color: 'var(--text-primary)', background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8, fontWeight: 600 }}>{emailDraft.subject}</div>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4, fontSize: 12 }}>EMAIL BODY</div>
                            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8, lineHeight: 1.6 }}>{emailDraft.body}</pre>
                          </div>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`Subject: ${emailDraft.subject}\n\n${emailDraft.body}`);
                                alert('Email subject and body copied to clipboard!');
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 12 }}
                            >
                              📋 Copy Email
                            </button>
                            <button onClick={() => { setShowEmailPanel(false); setEmailDraft(null); }} style={{ marginLeft: 'auto', fontSize: 11, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Hide ▲</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: 'var(--red)', fontSize: 13 }}>⚠️ Failed to draft email. Please try again.</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Company Insider Info */}
                <div style={{ marginBottom: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>🏢 Company Insider</h3>
                    {!showCompanyPanel && (
                      <button
                        onClick={() => fetchCompanyInfo(selectedJob.company, selectedJob.title, selectedJob.location)}
                        style={{ fontSize: 12, fontWeight: 600, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--accent)', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        🔍 Get Insider Info
                      </button>
                    )}
                  </div>

                  {showCompanyPanel && (
                    <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                      {loadingCompany ? (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                          ⏳ Fetching company intelligence…
                        </div>
                      ) : companyInfo?.error ? (
                        <div style={{ color: 'var(--red)', fontSize: 13 }}>⚠️ {companyInfo.error}</div>
                      ) : companyInfo && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4, fontSize: 12 }}>📌 OVERVIEW</div>
                            <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{companyInfo.overview}</p>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4, fontSize: 12 }}>🌱 CULTURE</div>
                            <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{companyInfo.culture}</p>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4, fontSize: 12 }}>🗂 INTERVIEW PROCESS</div>
                            <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{companyInfo.interviewProcess}</p>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 8, padding: 10 }}>
                              <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: 11, marginBottom: 6 }}>✅ PROS</div>
                              {(companyInfo.proscons?.pros || []).map((p: string, i: number) => <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>• {p}</div>)}
                            </div>
                            <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, padding: 10 }}>
                              <div style={{ fontWeight: 700, color: 'var(--red)', fontSize: 11, marginBottom: 6 }}>⚠️ CONS</div>
                              {(companyInfo.proscons?.cons || []).map((c: string, i: number) => <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>• {c}</div>)}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, padding: 10, display: 'flex', gap: 8 }}>
                            <span style={{ fontSize: 14 }}>💡</span>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 3 }}>INSIDER TIP</div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{companyInfo.tip}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>💰 Salary Range:</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>{companyInfo.salaryRange}</span>
                            <button onClick={() => { setShowCompanyPanel(false); setCompanyInfo(null); }} style={{ marginLeft: 'auto', fontSize: 11, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Hide ▲</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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
