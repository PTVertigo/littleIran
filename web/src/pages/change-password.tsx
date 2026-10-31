import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { TextField } from '../components/text-field';
import { ApiError, apiRequest } from '../lib/api';
import { isStrongPassword, PASSWORD_RULES_MESSAGE } from '../lib/validation';

type Field = 'currentPassword' | 'newPassword';

// Screen: change password. REQ-3.1.7 needs the current password and a new one
export function ChangePasswordPage() {
  const [values, setValues] = useState<Record<Field, string>>({ currentPassword: '', newPassword: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [changed, setChanged] = useState(false);

  function bind(field: Field) {
    return {
      value: values[field],
      error: fieldErrors[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        setValues({ ...values, [field]: e.target.value });
        setChanged(false);
      },
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    const errors: Partial<Record<Field, string>> = {};
    if (!values.currentPassword) errors.currentPassword = 'Enter your current password.';
    // REQ-3.1.3 the same rules as registration
    if (!isStrongPassword(values.newPassword)) errors.newPassword = PASSWORD_RULES_MESSAGE;
    else if (values.newPassword === values.currentPassword) {
      errors.newPassword = 'Choose a password you are not using now.';
    }
    setFieldErrors(errors);
    setError('');
    setChanged(false);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await apiRequest('/api/auth/change-password', { method: 'POST', body: values });
      setValues({ currentPassword: '', newPassword: '' });
      setChanged(true);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
    }
    setLoading(false);
  }

  return (
    <section className="form-page">
      <h1>Change password</h1>
      <p className="muted">Enter your current password, then choose a new one.</p>

      <form onSubmit={submit} noValidate className="form">
        {error && <ErrorBanner message={error} />}
        {changed && (
          <p role="status" className="success-banner">
            Your password has been changed. Any other devices will need to log in again.
          </p>
        )}
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          {...bind('currentPassword')}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint={PASSWORD_RULES_MESSAGE}
          {...bind('newPassword')}
        />
        <button type="submit" className="button" disabled={loading}>
          {loading ? 'Saving…' : 'Change password'}
        </button>
      </form>

      <p className="form-footer">
        <Link to="/dashboard">Back to dashboard</Link>
      </p>
    </section>
  );
}
