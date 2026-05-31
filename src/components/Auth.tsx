'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthProps {
  onGuest: () => void;
}

export default function Auth({ onGuest }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name || email.split('@')[0],
            },
          },
        });

        if (error) throw error;
        
        // If auto-confirm is enabled in Supabase, they will be logged in immediately.
        // Otherwise, show confirmation message.
        if (data.session) {
          setSuccessMsg('Successfully signed up! Logging you in...');
        } else {
          setSuccessMsg('Verification email sent! Please check your inbox.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize Google Sign-In.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.15) 0%, transparent 40%), #0b0b0f',
      padding: 20,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative background blobs */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '15%',
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'var(--accent)',
        filter: 'blur(120px)',
        opacity: 0.1,
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '20%',
        right: '15%',
        width: 350,
        height: 350,
        borderRadius: '50%',
        background: 'var(--purple)',
        filter: 'blur(130px)',
        opacity: 0.1,
        pointerEvents: 'none'
      }} />

      <div className="card animate-fade-in" style={{
        width: '100%',
        maxWidth: 440,
        padding: '40px 32px',
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 24,
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
        zIndex: 1
      }}>
        {/* Logo and Tagline */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            fontSize: 28,
            color: '#fff',
            marginBottom: 16,
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)'
          }}>
            ✈️
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            চাকরির বাজার
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            Your Intelligent Agentic Career Assistant
          </p>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '12px 16px',
            borderRadius: 10,
            color: 'var(--red)',
            fontSize: 13,
            marginBottom: 20,
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            padding: '12px 16px',
            borderRadius: 10,
            color: 'var(--green)',
            fontSize: 13,
            marginBottom: 20,
          }}>
            ✅ {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isSignUp && (
            <div className="input-group">
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Full Name</label>
              <input
                type="text"
                className="input"
                placeholder="John Doe"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="input-group">
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Email Address</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{
              height: 44,
              fontSize: 14,
              fontWeight: 600,
              marginTop: 8,
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
            }}
          >
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          margin: '20px 0',
          fontSize: 12,
          color: 'var(--text-muted)'
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ padding: '0 12px' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* OAuth Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={handleGoogleSignIn}
            className="btn btn-secondary"
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              height: 42,
              fontSize: 13,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border)'
            }}
          >
            {/* SVG Google Logo */}
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-.1.14-.14 3.08l4.24 3.29c2.48-2.28 3.95-5.64 3.95-9.22z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-4.24-3.29c-1.18.79-2.69 1.27-3.69 1.27-2.85 0-5.27-1.92-6.13-4.51L1.6 17.65C3.58 21.43 7.58 24 12 24z"/>
              <path fill="#FBBC05" d="M5.87 14.56c-.22-.66-.35-1.36-.35-2.06s.13-1.4.35-2.06V7.15L1.6 4.05C.58 6.09 0 8.35 0 10.74s.58 4.65 1.6 6.69l4.27-3.29z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.58 0 3.58 2.57 1.6 6.35l4.27 3.29c.86-2.59 3.28-4.51 6.13-4.51z"/>
            </svg>
            Continue with Google
          </button>

          <button
            onClick={onGuest}
            className="btn btn-secondary"
            style={{
              height: 42,
              fontSize: 13,
              background: 'transparent',
              border: '1px dashed rgba(255,255,255,0.15)',
              color: 'var(--text-secondary)'
            }}
          >
            ⚡ Continue as Guest (Local Storage)
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          </span>
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              fontSize: 13
            }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}
