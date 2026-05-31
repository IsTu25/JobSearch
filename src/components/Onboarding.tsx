'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/store';

export default function Onboarding() {
  const { state, dispatch } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  
  // Preference states
  const [targetRole, setTargetRole] = useState('');
  const [targetLocation, setTargetLocation] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('entry');
  const [preferredSalary, setPreferredSalary] = useState('');

  // CV Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  useEffect(() => {
    // Show only if onboarding has not been completed, no CV uploaded, and no applications saved
    const completed = localStorage.getItem('careerpilot_onboarding_completed') === 'true';
    if (!completed && !state.cvUploaded && state.applications.length === 0) {
      setIsOpen(true);
    }
  }, [state.cvUploaded, state.applications.length]);

  const handleClose = () => {
    localStorage.setItem('careerpilot_onboarding_completed', 'true');
    setIsOpen(false);
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(prev => prev + 1);
    } else {
      // Save target details on Step 3 completion
      dispatch({
        type: 'SET_PROFILE',
        payload: {
          targetRole,
          targetLocation,
          experienceLevel,
          preferredSalary,
        }
      });
      handleClose();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(prev => prev - 1);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError('');

    const formData = new FormData();
    formData.append('cv', file);

    try {
      const res = await fetch('/api/parse-cv', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to parse CV');
      }

      const data = await res.json();
      
      dispatch({
        type: 'SET_PROFILE',
        payload: {
          name: data.nameGuess || state.profile.name,
          cvText: data.text,
          cvChunks: data.chunks,
          cvFileName: data.fileName,
        }
      });
      
      setUploadedFile(data.fileName);
      
      // Auto advance to preferences
      setTimeout(() => {
        setStep(2);
      }, 1000);
    } catch (err) {
      console.error(err);
      setUploadError(err instanceof Error ? err.message : 'Error uploading file');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        {/* Step Progress Header */}
        <div className="onboarding-progress">
          <div className={`progress-dot ${step >= 1 ? 'active' : ''}`} />
          <div className="progress-line" />
          <div className={`progress-dot ${step >= 2 ? 'active' : ''}`} />
          <div className="progress-line" />
          <div className={`progress-dot ${step >= 3 ? 'active' : ''}`} />
        </div>

        <div className="onboarding-step-counter">
          Step {step} of 3
        </div>

        {/* Step Content */}
        <div className="onboarding-content">
          {step === 1 && (
            <div className="step-fade-in">
              <h2 className="onboarding-title">Welcome to চাকরির বাজার 🚀</h2>
              <p className="onboarding-subtitle">
                Let's set up your personalized agentic career assistant. Upload your CV/Resume to start scanning matches and getting tailored suggestions.
              </p>

              <div className="onboarding-upload-container">
                <label className="onboarding-upload-zone">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    style={{ display: 'none' }}
                  />
                  <div className="upload-icon">📁</div>
                  {isUploading ? (
                    <div className="upload-loading-text">
                      <span className="spinner" /> Parsing your CV intelligence...
                    </div>
                  ) : uploadedFile ? (
                    <div className="upload-success-text">
                      ✅ {uploadedFile} parsed successfully!
                    </div>
                  ) : (
                    <div>
                      <span className="upload-main-text">Click to choose a CV file</span>
                      <span className="upload-sub-text">Supports PDF, DOCX, TXT up to 10MB</span>
                    </div>
                  )}
                </label>
                {uploadError && (
                  <div className="upload-error-msg">{uploadError}</div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="step-fade-in">
              <h2 className="onboarding-title">Your Target Preferences 🎯</h2>
              <p className="onboarding-subtitle">
                We'll use these targets to tailor your automated search agents and calculate job match scores.
              </p>

              <div className="onboarding-form">
                <div className="form-group">
                  <label className="form-label">Target Job Role</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. ML Engineer, Frontend Developer"
                    value={targetRole}
                    onChange={e => setTargetRole(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Target Location</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Dhaka, Remote, London"
                    value={targetLocation}
                    onChange={e => setTargetLocation(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Experience Level</label>
                    <select
                      className="input select-input"
                      value={experienceLevel}
                      onChange={e => setExperienceLevel(e.target.value)}
                    >
                      <option value="entry">Entry Level</option>
                      <option value="mid">Mid Level</option>
                      <option value="senior">Senior Level</option>
                      <option value="lead">Lead / Principal</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Salary (Optional)</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. $80,000 /yr"
                      value={preferredSalary}
                      onChange={e => setPreferredSalary(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="step-fade-in text-center">
              <h2 className="onboarding-title">You're Ready to Launch! 🚢</h2>
              <p className="onboarding-subtitle" style={{ marginBottom: 30 }}>
                চাকরির বাজার has configured your preferences. Your personalized CV-RAG embeddings are initialized and ready to verify job descriptions.
              </p>

              <div className="onboarding-ready-grid">
                <div className="ready-item">
                  <span className="ready-icon">🔍</span>
                  <h4>NLP Job Search</h4>
                  <p>Search using natural language inputs</p>
                </div>
                <div className="ready-item">
                  <span className="ready-icon">🔮</span>
                  <h4>Score CV Gaps</h4>
                  <p>View matching ratios and rewrite tips</p>
                </div>
                <div className="ready-item">
                  <span className="ready-icon">🗓️</span>
                  <h4>Interactive Roadmaps</h4>
                  <p>Build custom study and skill pathways</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="onboarding-footer">
          {step > 1 ? (
            <button className="btn btn-secondary" onClick={handleBack}>
              Back
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={handleClose}>
              Skip Setup
            </button>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            {step < 3 && (
              <button className="btn btn-secondary" onClick={() => setStep(3)}>
                Skip to Finish
              </button>
            )}
            <button className="btn btn-primary" onClick={handleNext}>
              {step === 3 ? 'Get Started' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
