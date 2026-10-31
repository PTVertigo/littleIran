import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { TextField } from '../components/text-field';
import { ApiError, apiRequest } from '../lib/api';
import { isStrongPassword, PASSWORD_RULES_MESSAGE } from '../lib/validation';

// Screen: reset password. REQ-3.1.6 step 2, the emailed link carries a token and the person picks a new password
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    setError('');
    // REQ-3.1.3 the same rules as registration, checked before the link is used up
    if (!isStrongPassword(password)) {
      setFieldError(PASSWORD_RULES_MESSAGE);
      return;
    }
    setFieldError('');

    setLoading(true);
    try {
      await apiRequest('/api/auth/reset-password', { method: 'POST', body: { token, password } });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.password) {
        setFieldError(err.fieldErrors.password);
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
      setLoading(false);
    }
  }

  if (done) {
    return (
      <section className="form-page">
        <h1>Password updated</h1>
        <p role="status">Your password has been changed. Log in with your new password.</p>
        <p className="form-footer">
          <Link to="/login" className="button">
            Log in
          </Link>
        </p>
      </section>
    );
  }

  if (!token) {
    return (
      <section className="form-page">
        <h1>Reset link not valid</h1>
        <p>This link is missing its reset code. Request a new link to choose a new password.</p>
        <p className="form-footer">
          <Link to="/forgot-password">Request a new link</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="form-page">
      <h1>Choose a new password</h1>

      <form onSubmit={submit} noValidate className="form">
        {error && <ErrorBanner message={error} />}
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint={PASSWORD_RULES_MESSAGE}
          value={password}
          error={fieldError}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" className="button" disabled={loading}>
          {loading ? 'Saving…' : 'Save new password'}
        </button>
      </form>

      {error && (
        <p className="form-footer">
          <Link to="/forgot-password">Request a new link</Link>
        </p>
      )}
    </section>
  );
}
