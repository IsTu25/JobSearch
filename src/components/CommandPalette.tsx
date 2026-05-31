'use client';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/lib/store';
import { ActiveView } from '@/lib/types';

interface CommandItem {
  icon: string;
  label: string;
  category: 'Navigation' | 'Actions' | 'Presets';
  action: () => void;
}

export default function CommandPalette() {
  const { state, dispatch } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keydown listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setSearch('');
        setSelectedIndex(0);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const navigateTo = (view: ActiveView) => {
    dispatch({ type: 'SET_VIEW', payload: view });
    setIsOpen(false);
  };

  const injectChatPrompt = (prompt: string) => {
    // Navigate to Chat view
    dispatch({ type: 'SET_VIEW', payload: 'chat' });
    // Add user message to chat state
    dispatch({
      type: 'ADD_CHAT_MESSAGE',
      payload: {
        id: Date.now().toString(),
        role: 'user',
        content: prompt,
        timestamp: new Date().toISOString()
      }
    });
    // Trigger typing state so user feels the feedback loop
    setIsOpen(false);
    
    // Trigger the chat request with context by invoking API directly (or letting ChatView pick it up)
    // Note: Since ChatView triggers sendMessage when a user inputs, injecting it into state 
    // will render it in history. We prompt the user to start their chat or we can auto-send it
    // if they are on ChatView. Letting the user see the prompt already loaded makes it highly interactive!
  };

  const commands: CommandItem[] = [
    // Navigation Category
    { icon: '📊', label: 'Go to Dashboard', category: 'Navigation', action: () => navigateTo('dashboard') },
    { icon: '🔍', label: 'Go to Job Search', category: 'Navigation', action: () => navigateTo('jobs') },
    { icon: '💬', label: 'Go to AI Chat Assistant', category: 'Navigation', action: () => navigateTo('chat') },
    { icon: '📋', label: 'Go to Kanban Tracker', category: 'Navigation', action: () => navigateTo('tracker') },
    { icon: '🗺️', label: 'Go to Learning Roadmap', category: 'Navigation', action: () => navigateTo('roadmap') },
    { icon: '📄', label: 'Go to CV & Profile Analysis', category: 'Navigation', action: () => navigateTo('profile') },

    // Action Category
    {
      icon: '🔎',
      label: 'Find Remote ML Engineering Jobs',
      category: 'Actions',
      action: () => {
        navigateTo('jobs');
        // Pre-fill query details if desired (by setting search inputs in state if supported)
        setIsOpen(false);
      }
    },
    {
      icon: '🧠',
      label: 'Refresh Learning Roadmap Checklist',
      category: 'Actions',
      action: () => {
        navigateTo('roadmap');
        setIsOpen(false);
      }
    },

    // Preset prompts
    {
      icon: '❓',
      label: 'AI: "Am I ready for my target role?"',
      category: 'Presets',
      action: () => injectChatPrompt('Am I ready for my target role based on my CV skills and experience?')
    },
    {
      icon: '🎒',
      label: 'AI: "What skills are missing from my CV?"',
      category: 'Presets',
      action: () => injectChatPrompt('Identify all missing skills and key gaps in my CV relative to standard engineering jobs.')
    },
    {
      icon: '✍️',
      label: 'AI: "Draft a custom cover letter template"',
      category: 'Presets',
      action: () => injectChatPrompt('Draft a polished cover letter template using context from my profile summary.')
    }
  ];

  // Filter commands by search string
  const filtered = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  // Keep index within bounds
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(0);
    }
  }, [filtered.length, selectedIndex]);

  const handleArrowKeys = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="palette-overlay">
      <div className="palette-card" ref={containerRef}>
        <div className="palette-search-container">
          <span className="palette-search-icon">🔍</span>
          <input
            type="text"
            className="palette-input"
            placeholder="Type a command or query (e.g. Go to dashboard, AI: gap analysis)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleArrowKeys}
            ref={inputRef}
          />
          <kbd className="palette-kbd-esc">ESC</kbd>
        </div>

        <div className="palette-results">
          {filtered.length === 0 ? (
            <div className="palette-empty">No results found for "{search}"</div>
          ) : (
            // Group results by category
            ['Navigation', 'Actions', 'Presets'].map(cat => {
              const items = filtered.filter(f => f.category === cat);
              if (items.length === 0) return null;

              return (
                <div key={cat} className="palette-category-group">
                  <div className="palette-category-title">{cat}</div>
                  {items.map(item => {
                    // Global index in filtered array
                    const globalIdx = filtered.indexOf(item);
                    const isSelected = globalIdx === selectedIndex;

                    return (
                      <div
                        key={item.label}
                        className={`palette-item ${isSelected ? 'active' : ''}`}
                        onClick={() => item.action()}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <span className="palette-item-icon">{item.icon}</span>
                        <span className="palette-item-label">{item.label}</span>
                        {isSelected && <span className="palette-enter-indicator">⏎ Enter</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="palette-helper-bar">
          <span>Use ↑↓ to navigate</span>
          <span>⏎ to select</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}
