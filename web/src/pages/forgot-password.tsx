import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { TextField } from '../components/text-field';
import { ApiError, apiRequest } from '../lib/api';
import { isValidEmail } from '../lib/validation';

// Screen: forgot password. REQ-3.1.6 step 1, the person enters their email and a reset link is sent
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    const trimmed = email.trim().toLowerCase();
    setError('');
    if (!isValidEmail(trimmed)) {
      setFieldError('Enter a valid email address.');
      return;
    }
    setFieldError('');

    setLoading(true);
    try {
      // The answer is the same whether or not the address is registered, so it is shown as is
      const { message } = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: trimmed },
      });
      setConfirmation(message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  if (confirmation) {
    return (
      <section className="form-page">
        <h1>Check your email</h1>
        <p role="status">{confirmation}</p>
        <p className="form-footer">
          <Link to="/login">Back to log in</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="form-page">
      <h1>Forgot your password?</h1>
      <p className="muted">Enter your email and we will send you a link to choose a new one.</p>

      <form onSubmit={submit} noValidate className="form">
        {error && <ErrorBanner message={error} />}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          error={fieldError}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="button" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="form-footer">
        Remembered it? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}
