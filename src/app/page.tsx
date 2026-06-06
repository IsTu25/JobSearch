'use client';
import { useState, useEffect, useRef } from 'react';
import { AppProvider, useApp } from '@/lib/store';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import ChatView from '@/components/ChatView';
import JobSearch from '@/components/JobSearch';
import ProfileView from '@/components/ProfileView';
import TrackerView from '@/components/TrackerView';
import RoadmapView from '@/components/RoadmapView';
import Onboarding from '@/components/Onboarding';
import CommandPalette from '@/components/CommandPalette';
import Auth from '@/components/Auth';
import MockInterviewView from '@/components/MockInterviewView';
import SalaryCoachView from '@/components/SalaryCoachView';
import { supabase } from '@/lib/supabase';

/** Dismissible banner shown to guest users warning about localStorage data loss risk. */
function GuestDataBanner({ onSignUp }: { onSignUp: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Re-show each session so users are reminded every time they open a new tab/window.
    const alreadyDismissed = sessionStorage.getItem('guestBannerDismissed') === 'true';
    if (alreadyDismissed) setDismissed(true);
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem('guestBannerDismissed', 'true');
    setDismissed(true);
  };

  return (
    <div
      role="alert"
      style={{
        background: 'linear-gradient(90deg, rgba(234,179,8,0.08) 0%, rgba(234,179,8,0.04) 100%)',
        borderBottom: '1px solid rgba(234,179,8,0.2)',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 13,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 16 }}>⚠️</span>
      <span style={{ color: 'var(--text-secondary)', flex: 1, minWidth: 200 }}>
        <strong style={{ color: 'var(--yellow)' }}>Guest mode:</strong> Your CV, applications, and goals are stored locally — they'll be lost if you clear your browser or switch devices.
      </span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <button
          onClick={onSignUp}
          style={{
            background: 'rgba(234,179,8,0.15)',
            border: '1px solid rgba(234,179,8,0.3)',
            color: 'var(--yellow)',
            borderRadius: 8,
            padding: '5px 14px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Sign up to sync →
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss warning"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: '2px 4px',
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

const viewTitles: Record<string, string> = {
  dashboard: '📊 Dashboard',
  chat: '💬 AI Assistant',
  jobs: '🔍 Job Search',
  profile: '📄 My Profile',
  tracker: '📋 Application Tracker',
  roadmap: '🗺️ Learning Roadmap',
  interview: '🎤 Mock Interview',
  salary: '💰 Salary Negotiation Coach',
};

function AppContent() {
  const { state, dispatch } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // Click outside to close notification dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global mousemove tracker for glassmorphic card spotlights
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const cards = document.querySelectorAll('.spotlight-card');
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        (card as HTMLElement).style.setProperty('--mouse-x', `${x}px`);
        (card as HTMLElement).style.setProperty('--mouse-y', `${y}px`);
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [state.activeView]);

  // 1. Loading screen
  if (state.authMode === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#040408',
        gap: 24,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Dynamic background ambient lights */}
        <div style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'rgba(99, 102, 241, 0.15)',
          filter: 'blur(80px)',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 0
        }} />
        <div style={{
          width: 70,
          height: 70,
          borderRadius: 22,
          background: 'linear-gradient(135deg, var(--accent), var(--purple))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          boxShadow: '0 10px 30px rgba(99, 102, 241, 0.4)',
          position: 'relative',
          zIndex: 1,
          animation: 'pulse 2s infinite ease-in-out'
        }}>
          🚀
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>চাকরির বাজার</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="spinner" style={{ width: 12, height: 12 }} /> Connecting to Career Intel Engine...
          </p>
        </div>
      </div>
    );
  }

  // 2. Auth Required screen
  if (!state.user && state.authMode !== 'guest') {
    return (
      <Auth 
        onGuest={() => {
          localStorage.setItem('chakrir_bazar_guest_mode', 'true');
          dispatch({ type: 'SET_USER', payload: { user: null, authMode: 'guest' } });
        }}
      />
    );
  }

  // Compute active notifications (overdue goals + follow-up suggestions)
  const overdueGoals = (state.goals || [])
    .filter(g => !g.done && g.deadline && new Date(g.deadline) < new Date());

  const followUpNudges = (state.applications || [])
    .filter(a => {
      if (a.status !== 'applied') return false;
      const appliedDate = new Date(a.appliedDate);
      const diffTime = Math.abs(new Date().getTime() - appliedDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 7; // Applied >= 7 days ago
    });

  const totalNotifications = overdueGoals.length + followUpNudges.length;

  return (
    <div className="app-layout">
      <Onboarding />
      <CommandPalette />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="main-content">
        {/* Guest data-loss warning banner */}
        {state.authMode === 'guest' && (
          <GuestDataBanner
            onSignUp={() => {
              localStorage.removeItem('chakrir_bazar_guest_mode');
              window.location.reload();
            }}
          />
        )}
        <div className="top-bar top-bar-pill">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="hamburger"
              onClick={() => setSidebarOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: 22,
                cursor: 'pointer',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 8px',
              }}
            >
              ☰
            </button>
            <h2 style={{ margin: 0 }}>{viewTitles[state.activeView]}</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Notification Bell */}
            <div ref={bellRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setBellOpen(!bellOpen)}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  position: 'relative',
                  transition: 'all 0.15s ease',
                }}
                className="hover-bright"
              >
                🔔
                {totalNotifications > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    background: 'var(--red)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 18,
                    height: 18,
                    fontSize: 10,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #000',
                    boxShadow: '0 0 10px var(--red)',
                    animation: 'pulse 1.5s infinite ease-in-out'
                  }}>
                    {totalNotifications}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div style={{
                  position: 'absolute',
                  top: 48,
                  right: 0,
                  width: 320,
                  background: 'rgba(15, 15, 20, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid var(--border)',
                  borderRadius: 16,
                  padding: 16,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  zIndex: 100,
                  maxHeight: 400,
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Notifications</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{totalNotifications} issues</span>
                  </div>

                  {totalNotifications === 0 ? (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                      🎉 All caught up! No alerts.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Overdue Goals */}
                      {overdueGoals.map(g => (
                        <div 
                          key={g.id} 
                          onClick={() => {
                            dispatch({ type: 'SET_VIEW', payload: 'tracker' });
                            setBellOpen(false);
                          }}
                          style={{
                            background: 'rgba(239, 68, 68, 0.05)',
                            border: '1px solid rgba(239, 68, 68, 0.1)',
                            padding: 10,
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          <div style={{ fontWeight: 600, color: 'var(--red)', marginBottom: 2 }}>🎯 Overdue Goal</div>
                          <div style={{ color: 'var(--text-primary)', marginBottom: 4 }}>{g.text}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Deadline: {g.deadline}</div>
                        </div>
                      ))}

                      {/* Follow-up Alerts */}
                      {followUpNudges.map(a => (
                        <div 
                          key={a.id}
                          onClick={() => {
                            dispatch({ type: 'SET_VIEW', payload: 'tracker' });
                            setBellOpen(false);
                          }}
                          style={{
                            background: 'rgba(245, 158, 11, 0.05)',
                            border: '1px solid rgba(245, 158, 11, 0.1)',
                            padding: 10,
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 2 }}>✉️ Follow-up Nudge</div>
                          <div style={{ color: 'var(--text-primary)', marginBottom: 4 }}>
                            No response on your <strong>{a.role}</strong> application at <strong>{a.company}</strong>.
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Applied on: {a.appliedDate}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Auth Sign Out or Log In button */}
            {state.authMode === 'supabase' && state.user ? (
              <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                }}
                className="btn btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  height: 38,
                  borderRadius: 10
                }}
              >
                🚪 Sign Out
              </button>
            ) : state.authMode === 'guest' ? (
              <button 
                onClick={() => {
                  localStorage.removeItem('chakrir_bazar_guest_mode');
                  window.location.reload();
                }}
                className="btn btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  height: 38,
                  borderRadius: 10
                }}
              >
                🔑 Log In
              </button>
            ) : null}

            {state.profile.name && (
              <span className="user-name-display" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {state.profile.name}
              </span>
            )}
            
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--purple))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 600,
            }}>
              {state.profile.name ? state.profile.name[0].toUpperCase() : '?'}
            </div>
          </div>
        </div>

        <div className="content-area">
          {state.activeView === 'dashboard' && <Dashboard />}
          {state.activeView === 'chat' && <ChatView />}
          {state.activeView === 'jobs' && <JobSearch />}
          {state.activeView === 'profile' && <ProfileView />}
          {state.activeView === 'tracker' && <TrackerView />}
          {state.activeView === 'roadmap' && <RoadmapView />}
          {state.activeView === 'interview' && <MockInterviewView />}
          {state.activeView === 'salary' && <SalaryCoachView />}
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
