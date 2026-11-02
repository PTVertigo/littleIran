import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { TextField } from '../components/text-field';
import { ApiError, apiRequest, type User } from '../lib/api';
import { useSession } from '../lib/session';

type Field = 'firstName' | 'lastName';

const REQUIRED: Record<Field, string> = {
  firstName: 'Enter your first name.',
  lastName: 'Enter your last name.',
};

// Screen 3 (edit profile). REQ-3.2.2 a user can change their first and last name at any time
export function EditProfilePage() {
  const { state, updateUser } = useSession();
  // Only reachable through RequireAuth, so the user is always there
  const current = state.status === 'signedIn' ? state.user : null;
  const [values, setValues] = useState<Record<Field, string>>({
    firstName: current?.firstName ?? '',
    lastName: current?.lastName ?? '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  function bind(field: Field) {
    return {
      value: values[field],
      error: fieldErrors[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        setValues({ ...values, [field]: e.target.value });
        setSaved(false);
      },
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    const trimmed = { firstName: values.firstName.trim(), lastName: values.lastName.trim() };
    const missing: Partial<Record<Field, string>> = {};
    for (const field of Object.keys(REQUIRED) as Field[]) {
      if (!trimmed[field]) missing[field] = REQUIRED[field];
    }
    setFieldErrors(missing);
    setError('');
    setSaved(false);
    if (Object.keys(missing).length > 0) return;

    setLoading(true);
    try {
      const { user } = await apiRequest<{ user: User }>('/api/users/me', { method: 'PUT', body: trimmed });
      updateUser(user);
      setValues({ firstName: user.firstName, lastName: user.lastName });
      setSaved(true);
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
      <h1>Edit profile</h1>
      <p className="muted">Change the name shown on your profile.</p>

      <form onSubmit={submit} noValidate className="form">
        {error && <ErrorBanner message={error} />}
        {saved && (
          <p role="status" className="success-banner">
            Your profile has been updated.
          </p>
        )}
        <TextField label="First name" autoComplete="given-name" {...bind('firstName')} />
        <TextField label="Last name" autoComplete="family-name" {...bind('lastName')} />
        <button type="submit" className="button" disabled={loading}>
          {loading ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <p className="form-footer">
        <Link to="/profile">Back to profile</Link>
      </p>
    </section>
  );
}
