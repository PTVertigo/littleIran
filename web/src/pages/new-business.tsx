import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { SelectField } from '../components/select-field';
import { Spinner } from '../components/spinner';
import { TextAreaField } from '../components/text-area-field';
import { TextField } from '../components/text-field';
import { ApiError, apiRequest } from '../lib/api';
import { validateBusinessForm, type BusinessForm, type BusinessFormErrors, type DayHours } from '../lib/business-validation';
import { DAY_NAMES } from '../lib/format';

type Category = { id: string; name: string };
type TextFieldName = Exclude<keyof BusinessForm, 'hours'>;

const CHECK_MESSAGE = 'Check the fields marked below and try again.';

const emptyForm = (): BusinessForm => ({
  name: '',
  categoryId: '',
  description: '',
  street: '',
  city: '',
  postalCode: '',
  phone: '',
  email: '',
  website: '',
  hours: DAY_NAMES.map(() => ({ open: false, opens: '09:00', closes: '17:00' })),
});

// Screen "add listing". REQ-3.3 a member submits a business, which waits for approval before it is public
export function NewBusinessPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [values, setValues] = useState<BusinessForm>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<BusinessFormErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ categories: Category[] }>('/api/categories?type=business')
      .then((body) => setCategories(body.categories))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'));
  }, []);

  function bind(field: TextFieldName) {
    return {
      value: values[field],
      error: fieldErrors[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setValues({ ...values, [field]: e.target.value }),
    };
  }

  function setDay(index: number, change: Partial<DayHours>) {
    setValues({ ...values, hours: values.hours.map((day, i) => (i === index ? { ...day, ...change } : day)) });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    const errors = validateBusinessForm(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(CHECK_MESSAGE);
      return;
    }
    setError('');

    setLoading(true);
    try {
      const { business } = await apiRequest<{ business: { id: string; name: string } }>('/api/businesses', {
        method: 'POST',
        body: {
          name: values.name.trim(),
          categoryId: values.categoryId,
          description: values.description.trim(),
          street: values.street.trim(),
          city: values.city.trim(),
          postalCode: values.postalCode.trim(),
          phone: values.phone.trim(),
          email: values.email.trim(),
          website: values.website.trim(),
          hours: values.hours.flatMap((day, index) => (day.open ? [{ day: index + 1, opens: day.opens, closes: day.closes }] : [])),
        },
      });
      setSubmitted(business.name);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors as BusinessFormErrors);
        setError(CHECK_MESSAGE);
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
    }
    setLoading(false);
  }

  if (submitted !== null) {
    return (
      <section className="form-page">
        <h1>Business submitted</h1>
        <p role="status" className="success-banner">
          Thank you. {submitted} has been submitted. An administrator will review it, and it will appear in the directory once it is approved.
        </p>
        <p className="form-footer">
          <Link to="/businesses">Back to the business directory</Link>
        </p>
        <p className="form-footer">
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setValues(emptyForm());
              setFieldErrors({});
              setSubmitted(null);
            }}>
            Add another business
          </button>
        </p>
      </section>
    );
  }

  return (
    <section className="form-page">
      <h1>Add a business</h1>
      <p className="muted">
        Tell the community about an Iranian-owned business. An administrator reviews every listing before it is published.
      </p>

      {loadError && <ErrorBanner message={loadError} />}
      {!loadError && !categories && <Spinner label="Loading the form" />}

      {categories && (
        <form onSubmit={submit} noValidate className="form">
          {error && <ErrorBanner message={error} />}
          <TextField label="Business name" autoComplete="organization" {...bind('name')} />
          <SelectField
            label="Category"
            placeholder="Choose a category"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            {...bind('categoryId')}
          />
          <TextAreaField label="Description" hint="What the business offers, in a few sentences." {...bind('description')} />
          <TextField label="Street address" autoComplete="street-address" {...bind('street')} />
          <TextField label="City" autoComplete="address-level2" {...bind('city')} />
          <TextField label="Postal code" autoComplete="postal-code" hint="For example L8P 1A1." {...bind('postalCode')} />
          <TextField label="Phone number" type="tel" autoComplete="tel" hint="Ten digits, for example 905-555-0101." {...bind('phone')} />
          <TextField label="Business email" type="email" autoComplete="email" {...bind('email')} />
          <TextField label="Website (optional)" type="url" hint="Starts with https://" {...bind('website')} />
          <HoursField hours={values.hours} error={fieldErrors.hours} onChange={setDay} />
          <button type="submit" className="button" disabled={loading}>
            {loading ? 'Submitting…' : 'Submit for review'}
          </button>
        </form>
      )}

      <p className="form-footer">
        <Link to="/businesses">Back to the business directory</Link>
      </p>
    </section>
  );
}

// One row per day: tick it to say the business is open, then give its opening and closing time
function HoursField({
  hours,
  error,
  onChange,
}: {
  hours: DayHours[];
  error?: string;
  onChange: (index: number, change: Partial<DayHours>) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <fieldset className="hours-field" aria-describedby={error ? errorId : undefined}>
      <legend>Opening hours</legend>
      <p className="field__hint">Tick each day the business is open, and set its opening and closing time.</p>
      {DAY_NAMES.map((day, index) => {
        const { open, opens, closes } = hours[index];
        return (
          <div key={day} className="hours-row">
            <label className="hours-row__day">
              <input type="checkbox" checked={open} onChange={(e) => onChange(index, { open: e.target.checked })} />
              <span>
                {day}
                <span className="visually-hidden"> is open</span>
              </span>
            </label>
            <label className="visually-hidden" htmlFor={`${id}-${index}-opens`}>
              {day} opens
            </label>
            <input
              id={`${id}-${index}-opens`}
              type="time"
              value={opens}
              disabled={!open}
              onChange={(e) => onChange(index, { opens: e.target.value })}
            />
            <span aria-hidden="true">to</span>
            <label className="visually-hidden" htmlFor={`${id}-${index}-closes`}>
              {day} closes
            </label>
            <input
              id={`${id}-${index}-closes`}
              type="time"
              value={closes}
              disabled={!open}
              onChange={(e) => onChange(index, { closes: e.target.value })}
            />
          </div>
        );
      })}
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
