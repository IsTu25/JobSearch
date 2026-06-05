'use client';
import { useState, useRef } from 'react';
import { useApp } from '@/lib/store';

export default function ProfileView() {
  const { state, dispatch } = useApp();
  const { profile } = state;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'linkedin' | 'builder' | 'details' | 'chunks' | 'improvement'>('upload');
  const [analyzing, setAnalyzing] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [linkedinText, setLinkedinText] = useState('');
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinError, setLinkedinError] = useState('');
  const [analysisResult, setAnalysisResult] = useState<{
    score: number;
    analysis: string;
    strengths: string[];
    gaps: string[];
    suggestions: string[];
  } | null>(null);

  // CV Builder Form State
  const [cvSummary, setCvSummary] = useState('');
  const [cvSkills, setCvSkills] = useState('');
  const [cvExp, setCvExp] = useState([{ company: '', role: '', dates: '', desc: '' }]);
  const [cvEdu, setCvEdu] = useState([{ school: '', degree: '', dates: '' }]);
  const [cvProj, setCvProj] = useState([{ title: '', desc: '' }]);

  const addExperience = () => setCvExp([...cvExp, { company: '', role: '', dates: '', desc: '' }]);
  const removeExperience = (idx: number) => setCvExp(cvExp.filter((_, i) => i !== idx));
  const updateExperience = (idx: number, field: string, val: string) => {
    setCvExp(cvExp.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const addEducation = () => setCvEdu([...cvEdu, { school: '', degree: '', dates: '' }]);
  const removeEducation = (idx: number) => setCvEdu(cvEdu.filter((_, i) => i !== idx));
  const updateEducation = (idx: number, field: string, val: string) => {
    setCvEdu(cvEdu.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const addProject = () => setCvProj([...cvProj, { title: '', desc: '' }]);
  const removeProject = (idx: number) => setCvProj(cvProj.filter((_, i) => i !== idx));
  const updateProject = (idx: number, field: string, val: string) => {
    setCvProj(cvProj.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  async function importFromLinkedIn() {
    if (!linkedinText.trim() || linkedinText.trim().length < 30) {
      setLinkedinError('Please paste more content — at least a few lines from your LinkedIn profile.');
      return;
    }
    setLinkedinLoading(true);
    setLinkedinError('');
    try {
      const res = await fetch('/api/linkedin-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedinText }),
      });
      const data = await res.json();
      if (data.error) { setLinkedinError(data.error); return; }
      // Predict roles
      let predictedRoles = [];
      try {
        const rolesRes = await fetch('/api/predict-roles', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cvText: data.cvText }),
        });
        const rolesData = await rolesRes.json();
        predictedRoles = rolesData.predictedRoles || [];
      } catch {}
      const score = {
        contentClarity: 20, keywordOptimization: 20, quantifiedImpact: 10,
        formatting: 12, completeness: 13, total: 75, predictedRoles,
      };
      dispatch({
        type: 'SET_PROFILE',
        payload: {
          cvText: data.cvText,
          cvChunks: data.chunks || [],
          cvFileName: 'linkedin_import.txt',
          name: data.name || profile.name,
          targetRole: data.targetRole || profile.targetRole,
          cvScore: score,
        },
      });
      setLinkedinText('');
      setActiveTab('chunks');
    } catch {
      setLinkedinError('Failed to import. Please try again.');
    } finally {
      setLinkedinLoading(false);
    }
  }

  async function generateSectorPredictions() {
    if (!profile.cvText) return;
    setPredicting(true);
    try {
      const res = await fetch('/api/predict-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvText: profile.cvText }),
      });
      const data = await res.json();
      if (data.predictedRoles) {
        const nextScore = {
          ...(profile.cvScore || {
            contentClarity: 0,
            keywordOptimization: 0,
            quantifiedImpact: 0,
            formatting: 0,
            completeness: 0,
            total: 0
          }),
          predictedRoles: data.predictedRoles
        };
        dispatch({
          type: 'SET_PROFILE',
          payload: { cvScore: nextScore }
        });
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate career predictions.');
    } finally {
      setPredicting(false);
    }
  }

  const handleGenerateCV = async () => {
    if (!cvSummary.trim()) {
      alert('Please fill out the Summary field to generate your CV.');
      return;
    }

    let doc = `# ${profile.name || 'Professional Resume'}\n`;
    if (profile.email) doc += `Email: ${profile.email}\n`;
    if (profile.targetLocation) doc += `Location: ${profile.targetLocation}\n\n`;

    doc += `## SUMMARY\n${cvSummary}\n\n`;
    doc += `## SKILLS\n${cvSkills}\n\n`;

    doc += `## EXPERIENCE\n`;
    cvExp.forEach(e => {
      if (e.company) {
        doc += `### ${e.role} | ${e.company} (${e.dates})\n${e.desc}\n\n`;
      }
    });

    doc += `## EDUCATION\n`;
    cvEdu.forEach(edu => {
      if (edu.school) {
        doc += `### ${edu.degree} | ${edu.school} (${edu.dates})\n\n`;
      }
    });

    doc += `## PROJECTS\n`;
    cvProj.forEach(p => {
      if (p.title) {
        doc += `### ${p.title}\n${p.desc}\n\n`;
      }
    });

    // Parse into structured chunks for matching
    const chunks = [
      { section: 'Summary', content: cvSummary },
      { section: 'Skills', content: cvSkills },
      { section: 'Experience', content: cvExp.map(e => `${e.role} at ${e.company} (${e.dates}): ${e.desc}`).join('\n\n') },
      { section: 'Education', content: cvEdu.map(e => `${e.degree} from ${e.school} (${e.dates})`).join('\n\n') },
      { section: 'Projects', content: cvProj.map(p => `${p.title}: ${p.desc}`).join('\n\n') }
    ].filter(c => c.content.trim().length > 5);

    // Call AI role predictor
    let predictedRoles = [];
    try {
      const rolesRes = await fetch('/api/predict-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvText: doc }),
      });
      const rolesData = await rolesRes.json();
      predictedRoles = rolesData.predictedRoles || [];
    } catch (err) {
      console.error('Failed to predict roles', err);
    }

    // Compute basic score
    const hasNumbers = (doc.match(/\d+%|\d+\+|\$\d+|\d+ (year|month|project|team)/gi) || []).length;
    const score = {
      contentClarity: Math.min(Math.round((doc.split(/\s+/).length / 400) * 25), 25),
      keywordOptimization: Math.min(Math.round((chunks.length / 5) * 25), 25),
      quantifiedImpact: Math.min(Math.round((hasNumbers / 5) * 20), 20),
      formatting: chunks.length >= 4 ? 12 : 8,
      completeness: Math.min(Math.round((chunks.length / 5) * 15), 15),
      total: 0,
      predictedRoles,
    };
    score.total = score.contentClarity + score.keywordOptimization + score.quantifiedImpact + score.formatting + score.completeness;

    dispatch({
      type: 'SET_PROFILE',
      payload: {
        cvText: doc,
        cvChunks: chunks,
        cvFileName: `${profile.name || 'generated'}_cv.txt`,
        cvScore: score,
      },
    });

    // Trigger txt download
    const blob = new Blob([doc], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(profile.name || 'resume').toLowerCase().replace(/\s+/g, '_')}_cv.txt`;
    a.click();
    URL.revokeObjectURL(url);

    alert('🎉 CV Generated successfully! Your profile has been updated, job matching sectors predicted, and your text file is downloading.');
  };

  async function runCVAnalysis() {
    if (!profile.cvText) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cvText: profile.cvText,
          targetRole: profile.targetRole || 'Software Engineer',
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      setAnalysisResult(data.analysis);
    } catch {
      alert('Failed to analyze CV.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append('cv', file);

    try {
      const res = await fetch('/api/parse-cv', { method: 'POST', body: fd });
      const data = await res.json();

      if (data.error) {
        alert(data.error);
        return;
      }

      const text = data.text || '';

      // Call AI role predictor
      let predictedRoles = [];
      try {
        const rolesRes = await fetch('/api/predict-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cvText: text }),
        });
        const rolesData = await rolesRes.json();
        predictedRoles = rolesData.predictedRoles || [];
      } catch (err) {
        console.error('Failed to predict roles', err);
      }

      const hasNumbers = (text.match(/\d+%|\d+\+|\$\d+|\d+ (year|month|project|team)/gi) || []).length;
      const hasSections = data.chunks.length;
      const wordCount = text.split(/\s+/).length;

      const score = {
        contentClarity: Math.min(Math.round((wordCount / 400) * 25), 25),
        keywordOptimization: Math.min(Math.round((hasSections / 6) * 25), 25),
        quantifiedImpact: Math.min(Math.round((hasNumbers / 5) * 20), 20),
        formatting: hasSections >= 4 ? 12 : hasSections >= 2 ? 8 : 5,
        completeness: Math.min(Math.round((hasSections / 6) * 15), 15),
        total: 0,
        predictedRoles,
      };
      score.total = score.contentClarity + score.keywordOptimization + score.quantifiedImpact + score.formatting + score.completeness;

      dispatch({
        type: 'SET_PROFILE',
        payload: {
          cvText: data.text,
          cvChunks: data.chunks,
          cvFileName: data.fileName,
          name: data.nameGuess || profile.name,
          cvScore: score,
        },
      });

      setActiveTab('chunks');
    } catch {
      alert('Failed to parse CV. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>📄 My Profile</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Your CV is the source of truth. Upload it or build one directly inside the platform.
        </p>
      </div>

      <div className="tab-bar">
        {(['upload', 'linkedin', 'builder', 'details', 'chunks', 'improvement'] as const).map(tab => (
          <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'upload' ? '📤 Upload'
              : tab === 'linkedin' ? '🔗 LinkedIn'
              : tab === 'builder' ? '✨ CV Builder'
              : tab === 'details' ? '👤 Profile Details'
              : tab === 'chunks' ? '🧩 CV Chunks'
              : '🔮 CV Improvement'}
          </button>
        ))}
      </div>

      {activeTab === 'linkedin' && (
        <div className="card">
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>🔗 Import from LinkedIn</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
            Don't have a CV file? No problem. Copy your LinkedIn profile info and paste it below.
            Go to <strong>linkedin.com → Me → View Profile</strong>, select all text (Ctrl+A) and paste here.
          </p>
          <textarea
            className="input"
            style={{ width: '100%', minHeight: 220, resize: 'vertical', fontSize: 13, lineHeight: 1.6 }}
            value={linkedinText}
            onChange={e => { setLinkedinText(e.target.value); setLinkedinError(''); }}
            placeholder={`Paste your LinkedIn profile text here...\n\nExample:\nJohn Doe\nSoftware Engineer at Google\nBachelor's in Computer Science, MIT\n\nExperience:\nSoftware Engineer | Google | 2022–Present\n- Built scalable APIs serving 10M+ users\n- Led team of 5 engineers...\n\nSkills: Python, React, TypeScript, AWS...`}
          />
          {linkedinError && (
            <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8, padding: '8px 12px', background: 'var(--red-bg)', borderRadius: 8 }}>
              ⚠️ {linkedinError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button
              className="btn btn-primary"
              onClick={importFromLinkedIn}
              disabled={linkedinLoading || !linkedinText.trim()}
              style={{ flex: 1, height: 44, fontWeight: 700, justifyContent: 'center' }}
            >
              {linkedinLoading ? '⏳ Importing...' : '🔗 Import LinkedIn Profile'}
            </button>
            <button className="btn btn-secondary" onClick={() => setLinkedinText('')} disabled={!linkedinText}>Clear</button>
          </div>
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            💡 <strong style={{ color: 'var(--accent)' }}>Tip:</strong> For best results, include your About section, work experience, education, and skills sections from LinkedIn.
          </div>
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="card">
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />

          <div className="upload-area" onClick={() => fileRef.current?.click()}>
            {uploading ? (
              <>
                <div className="upload-icon" style={{ animation: 'spin 1s linear infinite' }}>⏳</div>
                <h3>Parsing your CV...</h3>
                <p>Extracting text, detecting sections, building knowledge base</p>
              </>
            ) : profile.cvFileName ? (
              <>
                <div className="upload-icon">✅</div>
                <h3>{profile.cvFileName}</h3>
                <p>Click to upload a new CV</p>
              </>
            ) : (
              <>
                <div className="upload-icon">📄</div>
                <h3>Drop your CV here or click to upload</h3>
                <p>Supports PDF, DOCX, and TXT files</p>
              </>
            )}
          </div>

          {profile.cvScore && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>📊 CV Score: {profile.cvScore.total}/100</h3>
              <div className="progress-bar" style={{ marginBottom: 20 }}>
                <div className="progress-fill" style={{ width: `${profile.cvScore.total}%` }} />
              </div>
              {[
                { label: 'Content Clarity', val: profile.cvScore.contentClarity, max: 25 },
                { label: 'Keyword Optimization', val: profile.cvScore.keywordOptimization, max: 25 },
                { label: 'Quantified Impact', val: profile.cvScore.quantifiedImpact, max: 20 },
                { label: 'Formatting', val: profile.cvScore.formatting, max: 15 },
                { label: 'Completeness', val: profile.cvScore.completeness, max: 15 },
              ].map(item => (
                <div key={item.label} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span>{item.val}/{item.max}</span>
                  </div>
                  <div className="progress-bar" style={{ height: 4 }}>
                    <div className="progress-fill" style={{ width: `${(item.val / item.max) * 100}%` }} />
                  </div>
                </div>
              ))}

              {/* AI Predicted Sectors & Match Analysis */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🔮 AI Sector Match Predictions</span>
                  </h4>
                  {!profile.cvScore.predictedRoles && (
                    <button 
                      className="btn btn-secondary" 
                      onClick={generateSectorPredictions}
                      disabled={predicting}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, cursor: 'pointer' }}
                    >
                      {predicting ? '⏳ Predicting...' : 'Predict Suitable Sectors'}
                    </button>
                  )}
                </div>

                {profile.cvScore.predictedRoles ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {profile.cvScore.predictedRoles.map((p, idx) => (
                      <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{p.role}</span>
                          <span style={{ fontSize: 11, background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                            {p.matchPercentage}% Match
                          </span>
                        </div>
                        
                        {/* Matched Skills */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Matched:</span>
                          {p.matchedSkills.map((s, sIdx) => (
                            <span key={sIdx} style={{ fontSize: 10, background: 'rgba(16, 185, 129, 0.08)', color: 'var(--green)', padding: '2px 6px', borderRadius: 4 }}>
                              {s}
                            </span>
                          ))}
                        </div>

                        {/* Gaps/Missing Skills */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Gaps/Missing:</span>
                          {p.missingSkills.map((s, mIdx) => (
                            <span key={mIdx} style={{ fontSize: 10, background: 'rgba(239, 68, 68, 0.08)', color: 'var(--red)', padding: '2px 6px', borderRadius: 4 }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    Click &quot;Predict Suitable Sectors&quot; to discover which job roles and sectors match your CV structure and skills!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'builder' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 10px 0' }}>✨ Generate CV Document</h3>
          
          <div className="input-group">
            <label>Professional Summary</label>
            <textarea
              className="textarea"
              placeholder="Ambitious software developer with 3 years of experience specializing in React and Node.js..."
              value={cvSummary}
              onChange={e => setCvSummary(e.target.value)}
              style={{ minHeight: 100 }}
            />
          </div>

          <div className="input-group">
            <label>Skills (Comma-separated)</label>
            <input
              className="input"
              placeholder="TypeScript, Python, Next.js, Docker, Kubernetes"
              value={cvSkills}
              onChange={e => setCvSkills(e.target.value)}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>💼 Work Experience</label>
              <button className="btn btn-secondary" onClick={addExperience} style={{ padding: '4px 10px', fontSize: 11 }}>+ Add Job</button>
            </div>
            {cvExp.map((exp, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <input className="input" placeholder="Company Name" value={exp.company} onChange={e => updateExperience(idx, 'company', e.target.value)} />
                  <input className="input" placeholder="Job Title" value={exp.role} onChange={e => updateExperience(idx, 'role', e.target.value)} />
                </div>
                <input className="input" placeholder="Dates (e.g. 2022 - Present)" value={exp.dates} onChange={e => updateExperience(idx, 'dates', e.target.value)} />
                <textarea className="textarea" placeholder="Describe achievements, quantified results, and technologies used" value={exp.desc} onChange={e => updateExperience(idx, 'desc', e.target.value)} style={{ minHeight: 60 }} />
                {cvExp.length > 1 && (
                  <button className="btn btn-secondary" onClick={() => removeExperience(idx)} style={{ alignSelf: 'flex-end', color: 'var(--red)', borderColor: 'rgba(239,68,68,0.2)' }}>Remove</button>
                )}
              </div>
            ))}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>🎓 Education</label>
              <button className="btn btn-secondary" onClick={addEducation} style={{ padding: '4px 10px', fontSize: 11 }}>+ Add Education</button>
            </div>
            {cvEdu.map((edu, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <input className="input" placeholder="School/University" value={edu.school} onChange={e => updateEducation(idx, 'school', e.target.value)} />
                  <input className="input" placeholder="Degree / Certification" value={edu.degree} onChange={e => updateEducation(idx, 'degree', e.target.value)} />
                </div>
                <input className="input" placeholder="Graduation Date" value={edu.dates} onChange={e => updateEducation(idx, 'dates', e.target.value)} />
                {cvEdu.length > 1 && (
                  <button className="btn btn-secondary" onClick={() => removeEducation(idx)} style={{ alignSelf: 'flex-end', color: 'var(--red)', borderColor: 'rgba(239,68,68,0.2)' }}>Remove</button>
                )}
              </div>
            ))}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>🧪 Projects</label>
              <button className="btn btn-secondary" onClick={addProject} style={{ padding: '4px 10px', fontSize: 11 }}>+ Add Project</button>
            </div>
            {cvProj.map((proj, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 12 }}>
                <input className="input" placeholder="Project Name / Title" value={proj.title} onChange={e => updateProject(idx, 'title', e.target.value)} />
                <textarea className="textarea" placeholder="Description of your project goals and tech stack" value={proj.desc} onChange={e => updateProject(idx, 'desc', e.target.value)} style={{ minHeight: 60 }} />
                {cvProj.length > 1 && (
                  <button className="btn btn-secondary" onClick={() => removeProject(idx)} style={{ alignSelf: 'flex-end', color: 'var(--red)', borderColor: 'rgba(239,68,68,0.2)' }}>Remove</button>
                )}
              </div>
            ))}
          </div>

          <button className="btn btn-primary" onClick={handleGenerateCV} style={{ height: 48, fontWeight: 700, fontSize: 15, marginTop: 12 }}>
            📥 Save Profile & Download CV (.txt)
          </button>
        </div>
      )}

      {activeTab === 'details' && (
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { key: 'name', label: 'Full Name', placeholder: 'John Doe' },
              { key: 'email', label: 'Email', placeholder: 'john@example.com' },
              { key: 'targetRole', label: 'Target Role', placeholder: 'e.g. Software Engineer' },
              { key: 'targetLocation', label: 'Target Location', placeholder: 'e.g. Remote, New York' },
              { key: 'experienceLevel', label: 'Experience Level', placeholder: 'e.g. Entry, Mid, Senior' },
              { key: 'preferredSalary', label: 'Preferred Salary', placeholder: 'e.g. $80k-$120k' },
            ].map(field => (
              <div className="input-group" key={field.key}>
                <label>{field.label}</label>
                <input
                  className="input"
                  value={(profile as Record<string, any>)[field.key] || ''}
                  onChange={e => dispatch({ type: 'SET_PROFILE', payload: { [field.key]: e.target.value } })}
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'chunks' && (
        <div>
          {profile.cvChunks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🧩</div>
              <h3>No CV chunks yet</h3>
              <p>Upload or generate your CV to see it broken down into searchable sections</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {profile.cvChunks.map((chunk, i) => (
                <div key={i} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className="badge badge-purple">{chunk.section}</span>
                  </div>
                  <pre style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {chunk.content}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'improvement' && (
        <div className="card">
          {!profile.cvText ? (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <h3>No CV Uploaded Yet</h3>
              <p>Please upload or generate your CV first to receive personalized AI scores and feedback.</p>
              <button className="btn btn-primary" onClick={() => setActiveTab('upload')} style={{ marginTop: 12, cursor: 'pointer' }}>
                Go to Upload
              </button>
            </div>
          ) : analyzing ? (
            <div className="empty-state">
              <div className="empty-icon" style={{ animation: 'spin 1s linear infinite' }}>⏳</div>
              <h3>Analyzing your CV...</h3>
              <p>Reviewing structure, spelling, grammar, and alignment with target roles...</p>
            </div>
          ) : !analysisResult ? (
            <div className="empty-state">
              <div className="empty-icon">🔮</div>
              <h3>Check Your CV Score & Get Tips</h3>
              <p>Let Gemini evaluate your CV structure, identify keyword gaps, and suggest professional rewrites.</p>
              <button className="btn btn-primary" onClick={runCVAnalysis} style={{ marginTop: 16, cursor: 'pointer' }}>
                ✨ Start AI Analysis
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
                <div style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  border: `4px solid ${analysisResult.score >= 80 ? 'var(--green)' : analysisResult.score >= 60 ? 'var(--yellow)' : 'var(--red)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  flexShrink: 0
                }}>
                  <span style={{ fontSize: 28, fontWeight: 800 }}>{analysisResult.score}%</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>AI LIKE</span>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Hiring Manager Evaluation</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                    {analysisResult.analysis}
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 24 }}>
                <div style={{ 
                  background: 'rgba(16, 185, 129, 0.02)', 
                  border: '1px solid rgba(16, 185, 129, 0.1)', 
                  borderRadius: 12, 
                  padding: 16 
                }}>
                  <h4 style={{ color: 'var(--green)', fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px 0' }}>
                    ✅ Key Strengths
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {analysisResult.strengths.map((str, idx) => <li key={idx}>{str}</li>)}
                  </ul>
                </div>

                <div style={{ 
                  background: 'rgba(239, 68, 68, 0.02)', 
                  border: '1px solid rgba(239, 68, 68, 0.1)', 
                  borderRadius: 12, 
                  padding: 16 
                }}>
                  <h4 style={{ color: 'var(--red)', fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px 0' }}>
                    ⚠️ Gaps & Weaknesses
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {analysisResult.gaps.map((gap, idx) => <li key={idx}>{gap}</li>)}
                  </ul>
                </div>
              </div>

              <div style={{ 
                background: 'rgba(255, 255, 255, 0.02)', 
                border: '1px solid var(--border)', 
                borderRadius: 12, 
                padding: 16,
                marginBottom: 24
              }}>
                <h4 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15, margin: '0 0 12px 0' }}>
                  🔮 AI Rewrite Suggestions
                </h4>
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {analysisResult.suggestions.map((sug, idx) => <li key={idx}>{sug}</li>)}
                </ol>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={runCVAnalysis} disabled={analyzing} style={{ cursor: 'pointer' }}>
                  🔄 Re-Analyze CV
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
