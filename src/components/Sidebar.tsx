'use client';
import { useApp } from '@/lib/store';
import { ActiveView } from '@/lib/types';

const navItems: { icon: string; label: string; view: ActiveView }[] = [
  { icon: '📊', label: 'Dashboard', view: 'dashboard' },
  { icon: '💬', label: 'AI Assistant', view: 'chat' },
  { icon: '🔍', label: 'Job Search', view: 'jobs' },
  { icon: '📄', label: 'My Profile', view: 'profile' },
  { icon: '📋', label: 'Tracker', view: 'tracker' },
  { icon: '🗺️', label: 'Roadmap', view: 'roadmap' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { state, dispatch } = useApp();

  function handleNav(view: ActiveView) {
    dispatch({ type: 'SET_VIEW', payload: view });
    if (onClose) onClose();
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="logo-icon">🚀</div>
            <h1>চাকরির বাজার</h1>
          </div>
          {onClose && (
            <button className="sidebar-close" onClick={onClose}>
              ×
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Main</div>
          {navItems.slice(0, 3).map(item => (
            <button
              key={item.view}
              className={`nav-item ${state.activeView === item.view ? 'active' : ''}`}
              onClick={() => handleNav(item.view)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div className="nav-section-label">Tools</div>
          {navItems.slice(3).map(item => (
            <button
              key={item.view}
              className={`nav-item ${state.activeView === item.view ? 'active' : ''}`}
              onClick={() => handleNav(item.view)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {state.cvUploaded ? (
            <div className="nav-item" style={{ cursor: 'default' }}>
              <span className="nav-icon">✅</span>
              <span style={{ fontSize: 13, color: 'var(--green)' }}>CV Uploaded</span>
            </div>
          ) : (
            <button
              className="nav-item"
              onClick={() => handleNav('profile')}
              style={{ color: 'var(--yellow)' }}
            >
              <span className="nav-icon">⚠️</span>
              Upload CV to start
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
