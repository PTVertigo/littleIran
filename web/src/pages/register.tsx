import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { AFTER_LOGIN_PATH } from '../components/route-guards';
import { TextField } from '../components/text-field';
import { ApiError, apiRequest } from '../lib/api';
import { useSession } from '../lib/session';
import { isValidEmail } from '../lib/validation';

type Field = 'firstName' | 'lastName' | 'email' | 'password';
type FieldErrors = Partial<Record<Field, string>>;

const REQUIRED: Record<Field, string> = {
  firstName: 'Enter your first name.',
  lastName: 'Enter your last name.',
  email: 'Enter your email address.',
  password: 'Enter a password.',
};

// Screen: registration. REQ-3.1.1 email, password, first name and last name; REQ-3.1.2 email checks
export function RegisterPage() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<Field, string>>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function bind(field: Field) {
    return {
      value: values[field],
      error: fieldErrors[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [field]: e.target.value }),
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    const trimmed = {
      ...values,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim().toLowerCase(),
    };
    const missing: FieldErrors = {};
    for (const field of Object.keys(REQUIRED) as Field[]) {
      if (!trimmed[field]) missing[field] = REQUIRED[field];
    }
    // REQ-3.1.2 a well-formed address; whether it is already taken only the server can say
    if (trimmed.email && !isValidEmail(trimmed.email)) missing.email = 'Enter a valid email address.';
    setFieldErrors(missing);
    setError('');
    if (Object.keys(missing).length > 0) return;

    setLoading(true);
    try {
      await apiRequest('/api/users', { method: 'POST', body: trimmed });
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
      setLoading(false);
      return;
    }

    // The account exists now, so a failed automatic login only means they log in themselves
    try {
      await signIn(trimmed.email, trimmed.password);
      navigate(AFTER_LOGIN_PATH, { replace: true });
    } catch {
      navigate('/login', { replace: true });
    }
  }

  return (
    <section className="form-page">
      <h1>Create an account</h1>
      <p className="muted">Join the Iranian community in Southern Ontario.</p>

      <form onSubmit={submit} noValidate className="form">
        {error && <ErrorBanner message={error} />}
        <TextField label="First name" autoComplete="given-name" {...bind('firstName')} />
        <TextField label="Last name" autoComplete="family-name" {...bind('lastName')} />
        <TextField label="Email" type="email" autoComplete="email" {...bind('email')} />
        <TextField label="Password" type="password" autoComplete="new-password" {...bind('password')} />
        <button type="submit" className="button" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="form-footer">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}
