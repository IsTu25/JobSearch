'use client';
import React, { createContext, useContext, useReducer, useEffect, ReactNode, useState } from 'react';
import { UserProfile, TrackedApplication, ChatMessage, ActiveView, JobResult, RoadmapMonth, Goal } from './types';
import { supabase } from './supabase';

interface AppState {
  activeView: ActiveView;
  profile: UserProfile;
  applications: TrackedApplication[];
  chatMessages: ChatMessage[];
  jobResults: JobResult[];
  isLoading: boolean;
  cvUploaded: boolean;
  roadmap: RoadmapMonth[] | null;
  goals: Goal[];
  authMode: 'loading' | 'supabase' | 'guest';
  user: any | null;
}

type Action =
  | { type: 'SET_VIEW'; payload: ActiveView }
  | { type: 'SET_PROFILE'; payload: Partial<UserProfile> }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_JOB_RESULTS'; payload: JobResult[] }
  | { type: 'ADD_APPLICATION'; payload: TrackedApplication }
  | { type: 'UPDATE_APPLICATION'; payload: { id: string; updates: Partial<TrackedApplication> } }
  | { type: 'DELETE_APPLICATION'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CV_UPLOADED'; payload: boolean }
  | { type: 'SET_ROADMAP'; payload: RoadmapMonth[] | null }
  | { type: 'TOGGLE_ROADMAP_TOPIC'; payload: { topicId: string } }
  | { type: 'UPDATE_LAST_MESSAGE'; payload: string }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> }
  | { type: 'SET_USER'; payload: { user: any; authMode: 'loading' | 'supabase' | 'guest' } }
  | { type: 'SET_GOALS'; payload: Goal[] }
  | { type: 'ADD_GOAL'; payload: Goal }
  | { type: 'TOGGLE_GOAL'; payload: string }
  | { type: 'DELETE_GOAL'; payload: string };

const defaultProfile: UserProfile = {
  name: '', email: '', targetRole: '', targetLocation: '',
  experienceLevel: '', preferredSalary: '', cvText: '',
  cvChunks: [], cvFileName: '', cvScore: null,
};

const initialState: AppState = {
  activeView: 'dashboard',
  profile: defaultProfile,
  applications: [],
  chatMessages: [],
  jobResults: [],
  isLoading: false,
  cvUploaded: false,
  roadmap: null,
  goals: [],
  authMode: 'loading',
  user: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW': return { ...state, activeView: action.payload };
    case 'SET_PROFILE': {
      const nextProfile = { ...state.profile, ...action.payload };
      return { 
        ...state, 
        profile: nextProfile, 
        cvUploaded: nextProfile.cvText ? true : state.cvUploaded 
      };
    }
    case 'ADD_CHAT_MESSAGE': return { ...state, chatMessages: [...state.chatMessages, action.payload] };
    case 'SET_JOB_RESULTS': return { ...state, jobResults: action.payload };
    case 'ADD_APPLICATION': return { ...state, applications: [...state.applications, action.payload] };
    case 'UPDATE_APPLICATION': return { ...state, applications: state.applications.map(a => a.id === action.payload.id ? { ...a, ...action.payload.updates } : a) };
    case 'DELETE_APPLICATION': return { ...state, applications: state.applications.filter(a => a.id !== action.payload) };
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    case 'SET_CV_UPLOADED': return { ...state, cvUploaded: action.payload };
    case 'SET_ROADMAP': return { ...state, roadmap: action.payload };
    case 'TOGGLE_ROADMAP_TOPIC': {
      if (!state.roadmap) return state;
      let isCompleted = false;
      const newRoadmap = state.roadmap.map(month => ({
        ...month,
        weeks: month.weeks.map(week => ({
          ...week,
          topics: week.topics.map(topic => {
            if (topic.id === action.payload.topicId) {
              isCompleted = !topic.completed;
              return { ...topic, completed: isCompleted };
            }
            return topic;
          })
        }))
      }));
      const goalId = `roadmap-${action.payload.topicId}`;
      const newGoals = state.goals.map(g => 
        g.id === goalId ? { ...g, done: isCompleted } : g
      );
      return { ...state, roadmap: newRoadmap, goals: newGoals };
    }
    case 'UPDATE_LAST_MESSAGE': {
      if (state.chatMessages.length === 0) return state;
      const updatedMessages = [...state.chatMessages];
      updatedMessages[updatedMessages.length - 1] = {
        ...updatedMessages[updatedMessages.length - 1],
        content: action.payload,
      };
      return { ...state, chatMessages: updatedMessages };
    }
    case 'LOAD_STATE': return { ...state, ...action.payload };
    case 'SET_USER': return { ...state, user: action.payload.user, authMode: action.payload.authMode };
    case 'SET_GOALS': return { ...state, goals: action.payload };
    case 'ADD_GOAL': return { ...state, goals: [...state.goals, action.payload] };
    case 'TOGGLE_GOAL': {
      let isDone = false;
      const newGoals = state.goals.map(g => {
        if (g.id === action.payload) {
          isDone = !g.done;
          return { ...g, done: isDone };
        }
        return g;
      });
      let newRoadmap = state.roadmap;
      if (action.payload.startsWith('roadmap-') && state.roadmap) {
        const topicId = action.payload.replace('roadmap-', '');
        newRoadmap = state.roadmap.map(month => ({
          ...month,
          weeks: month.weeks.map(week => ({
            ...week,
            topics: week.topics.map(topic =>
              topic.id === topicId
                ? { ...topic, completed: isDone }
                : topic
            )
          }))
        }));
      }
      return { ...state, goals: newGoals, roadmap: newRoadmap };
    }
    case 'DELETE_GOAL': {
      const newGoals = state.goals.filter(g => g.id !== action.payload);
      let newRoadmap = state.roadmap;
      if (action.payload.startsWith('roadmap-') && state.roadmap) {
        const topicId = action.payload.replace('roadmap-', '');
        newRoadmap = state.roadmap.map(month => ({
          ...month,
          weeks: month.weeks.map(week => ({
            ...week,
            topics: week.topics.map(topic =>
              topic.id === topicId
                ? { ...topic, completed: false }
                : topic
            )
          }))
        }));
      }
      return { ...state, goals: newGoals, roadmap: newRoadmap };
    }
    default: return state;
  }
}

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [syncing, setSyncing] = useState(false);

  // 1. Listen to Supabase Auth State
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        dispatch({ type: 'SET_USER', payload: { user: session.user, authMode: 'supabase' } });
      } else {
        const isGuest = localStorage.getItem('chakrir_bazar_guest_mode') === 'true';
        if (isGuest) {
          dispatch({ type: 'SET_USER', payload: { user: null, authMode: 'guest' } });
        } else {
          dispatch({ type: 'SET_USER', payload: { user: null, authMode: 'supabase' } });
        }
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        dispatch({ type: 'SET_USER', payload: { user: session.user, authMode: 'supabase' } });
      } else {
        const isGuest = localStorage.getItem('chakrir_bazar_guest_mode') === 'true';
        if (isGuest) {
          dispatch({ type: 'SET_USER', payload: { user: null, authMode: 'guest' } });
        } else {
          dispatch({ type: 'SET_USER', payload: { user: null, authMode: 'supabase' } });
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 2. Load State from Database or LocalStorage based on AuthMode
  useEffect(() => {
    if (state.authMode === 'loading') return;

    const loadData = async () => {
      if (state.authMode === 'supabase' && state.user) {
        try {
          dispatch({ type: 'SET_LOADING', payload: true });

          // Fetch Profile
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', state.user.id)
            .maybeSingle();

          // Fetch CV Chunks
          const { data: chunksData } = await supabase
            .from('cv_chunks')
            .select('section, content')
            .eq('user_id', state.user.id);

          // Fetch Applications
          const { data: appsData } = await supabase
            .from('applications')
            .select('*')
            .eq('user_id', state.user.id);

          // Fetch Goals
          const { data: goalsData } = await supabase
            .from('goals')
            .select('*')
            .eq('user_id', state.user.id);

          const loadedProfile: UserProfile = {
            name: profileData?.name || state.user.user_metadata?.name || '',
            email: profileData?.email || state.user.email || '',
            targetRole: profileData?.target_role || '',
            targetLocation: profileData?.target_location || '',
            experienceLevel: profileData?.experience_level || '',
            preferredSalary: profileData?.preferred_salary || '',
            cvText: profileData?.cv_text || '',
            cvChunks: chunksData || [],
            cvFileName: profileData?.cv_file_name || '',
            cvScore: profileData?.cv_score ? JSON.parse(JSON.stringify(profileData.cv_score)) : null,
          };

          const loadedApps: TrackedApplication[] = (appsData || []).map(a => ({
            id: a.id,
            company: a.company,
            role: a.role,
            status: a.status,
            appliedDate: a.applied_date.split('T')[0],
            lastUpdated: a.updated_at,
            notes: a.notes || '',
            source: a.source || 'Manual',
            url: a.url || '',
          }));

          const loadedGoals: Goal[] = (goalsData || []).map(g => ({
            id: g.id,
            text: g.text,
            deadline: g.deadline || '',
            done: g.done,
          }));

          dispatch({
            type: 'LOAD_STATE',
            payload: {
              profile: loadedProfile,
              applications: loadedApps,
              goals: loadedGoals,
              cvUploaded: !!loadedProfile.cvText,
            }
          });
        } catch (err) {
          console.error('[Supabase Load] Error:', err);
        } finally {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } else if (state.authMode === 'guest') {
        // Fallback to LocalStorage
        try {
          const saved = localStorage.getItem('chakrir_bazar_state');
          const savedGoals = localStorage.getItem('chakrir_bazar_goals');
          const parsed = saved ? JSON.parse(saved) : {};
          const parsedGoals = savedGoals ? JSON.parse(savedGoals) : [];
          dispatch({
            type: 'LOAD_STATE',
            payload: {
              ...parsed,
              goals: parsedGoals,
            }
          });
        } catch {}
      }
    };

    loadData();
  }, [state.authMode, state.user]);

  // 3. Sync state changes to DB / LocalStorage
  useEffect(() => {
    if (state.authMode === 'loading') return;

    const sync = async () => {
      if (state.authMode === 'supabase' && state.user) {
        if (syncing) return;
        setSyncing(true);
        try {
          // Sync Profile
          await supabase.from('profiles').upsert({
            user_id: state.user.id,
            name: state.profile.name,
            email: state.profile.email,
            target_role: state.profile.targetRole,
            target_location: state.profile.targetLocation,
            experience_level: state.profile.experienceLevel,
            preferred_salary: state.profile.preferredSalary,
            cv_text: state.profile.cvText,
            cv_file_name: state.profile.cvFileName,
            cv_score: state.profile.cvScore,
            updated_at: new Date().toISOString(),
          });

          // Sync Chunks if CV uploaded/changed
          if (state.profile.cvChunks && state.profile.cvChunks.length > 0) {
            const { data: existingChunks } = await supabase
              .from('cv_chunks')
              .select('id')
              .eq('user_id', state.user.id)
              .limit(1);
            
            // Only upsert chunks if they aren't already synced to avoid redundant writes
            if (!existingChunks || existingChunks.length === 0) {
              await supabase.from('cv_chunks').delete().eq('user_id', state.user.id);
              await supabase.from('cv_chunks').insert(
                state.profile.cvChunks.map(c => ({
                  user_id: state.user.id,
                  section: c.section,
                  content: c.content,
                }))
              );
            }
          }
        } catch (err) {
          console.error('[Supabase Sync] Error:', err);
        } finally {
          setSyncing(false);
        }
      } else if (state.authMode === 'guest') {
        try {
          const toSave = {
            profile: state.profile,
            applications: state.applications,
            chatMessages: state.chatMessages.slice(-50),
            cvUploaded: state.cvUploaded,
            roadmap: state.roadmap,
          };
          localStorage.setItem('chakrir_bazar_state', JSON.stringify(toSave));
        } catch {}
      }
    };

    sync();
  }, [state.profile, state.authMode, state.user]);

  // Sync Applications separately to manage specific rows
  useEffect(() => {
    if (state.authMode !== 'supabase' || !state.user || state.applications.length === 0) {
      if (state.authMode === 'guest') {
        const toSave = {
          profile: state.profile,
          applications: state.applications,
          chatMessages: state.chatMessages.slice(-50),
          cvUploaded: state.cvUploaded,
          roadmap: state.roadmap,
        };
        localStorage.setItem('chakrir_bazar_state', JSON.stringify(toSave));
      }
      return;
    }

    const syncApps = async () => {
      try {
        // Upsert all applications
        for (const app of state.applications) {
          // If ID is numeric (from mock data / local state), we let Supabase auto-generate one
          const isUUID = app.id.includes('-');
          const payload: any = {
            user_id: state.user.id,
            company: app.company,
            role: app.role,
            status: app.status,
            applied_date: app.appliedDate ? new Date(app.appliedDate).toISOString() : new Date().toISOString(),
            notes: app.notes,
            source: app.source,
            url: app.url,
            updated_at: new Date().toISOString(),
          };

          if (isUUID) {
            payload.id = app.id;
          }

          await supabase.from('applications').upsert(payload);
        }
      } catch (err) {
        console.error('[Supabase Sync Apps] Error:', err);
      }
    };

    syncApps();
  }, [state.applications, state.authMode, state.user]);

  // Sync Goals separately
  useEffect(() => {
    if (state.authMode === 'supabase' && state.user) {
      const syncGoals = async () => {
        try {
          for (const goal of state.goals) {
            const isUUID = goal.id.includes('-');
            const payload: any = {
              user_id: state.user.id,
              text: goal.text,
              deadline: goal.deadline ? goal.deadline : null,
              done: goal.done,
            };

            if (isUUID) {
              payload.id = goal.id;
            }

            await supabase.from('goals').upsert(payload);
          }
        } catch (err) {
          console.error('[Supabase Sync Goals] Error:', err);
        }
      };
      syncGoals();
    } else if (state.authMode === 'guest') {
      localStorage.setItem('chakrir_bazar_goals', JSON.stringify(state.goals));
    }
  }, [state.goals, state.authMode, state.user]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
