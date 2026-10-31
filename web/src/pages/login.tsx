import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { AFTER_LOGIN_PATH } from '../components/route-guards';
import { TextField } from '../components/text-field';
import { ApiError } from '../lib/api';
import { useSession } from '../lib/session';

// Screen 1. REQ-3.1.4 login with email and password
export function LoginPage() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? AFTER_LOGIN_PATH, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <section className="form-page">
      <h1>Log in</h1>
      <p className="muted">Welcome back to LittleIran.</p>

      <form onSubmit={submit} noValidate className="form">
        {error && <ErrorBanner message={error} />}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" className="button" disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="form-footer">
        New to LittleIran? <Link to="/register">Create an account</Link>
      </p>
    </section>
  );
}
