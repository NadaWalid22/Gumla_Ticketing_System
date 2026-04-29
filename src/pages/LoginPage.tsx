import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { user, login, register, resendVerificationEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        const result = await register(email, password);
        if (result.needsEmailVerification) {
          setMessage('Account created. Check your email to verify, then sign in.');
          setMode('login');
        }
      }
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.toLowerCase().includes('email not confirmed')) {
        setError('Email not verified. Open your email verification link, or resend verification below.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleResendVerification() {
    if (!email.trim()) {
      setError('Enter your email first, then click resend.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await resendVerificationEmail(email);
      setMessage('Verification email sent. Please check inbox/spam.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="auth-card">
        <h1>Gumla Ticketing</h1>
        <p className="hint">Internal issue tracking for employees and support team.</p>

        <form onSubmit={handleSubmit} className="stack">
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@gumla.com"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
            />
          </label>

          {message && <div className="success">{message}</div>}
          {error && <div className="error">{error}</div>}

          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>

        <button className="link-btn" type="button" onClick={() => void handleResendVerification()} disabled={busy}>
          Resend Verification Email
        </button>

        <button
          className="link-btn"
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'New employee? Create account' : 'Already registered? Login'}
        </button>
      </div>
    </div>
  );
}
