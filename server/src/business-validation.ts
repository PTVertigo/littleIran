import { isRecordId, isValidEmail } from './validation';

// REQ-4.1.7 the rules for a submitted business listing. web/src/lib/business-validation.ts applies the
// same ones in the browser; this is the copy that counts, because requests can skip the page.
export const BUSINESS_LIMITS = { name: 100, description: 1000, street: 100, city: 60, website: 200 } as const;

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const POSTAL_CODE = /^([A-Za-z]\d[A-Za-z])[ -]?(\d[A-Za-z]\d)$/;
const PHONE_CHARACTERS = /^[\d\s().+-]+$/;
const NORTH_AMERICAN_PHONE = /^[2-9]\d{2}[2-9]\d{6}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type ValidBusiness = {
  name: string;
  categoryId: string;
  description: string;
  street: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string | null;
  hours: { day: number; opens: string; closes: string }[];
};

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

// A phone number is ten digits, optionally with a leading 1, written the same way every time
function normalizePhone(value: string): string | null {
  if (!PHONE_CHARACTERS.test(value)) return null;
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return NORTH_AMERICAN_PHONE.test(digits) ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : null;
}

function normalizePostalCode(value: string): string | null {
  const match = POSTAL_CODE.exec(value);
  return match ? `${match[1]} ${match[2]}`.toUpperCase() : null;
}

// REQ-4.1.3 a website is shown as a link, so it must be a plain web address
function isWebAddress(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function checkHours(hours: unknown): { hours?: ValidBusiness['hours']; error?: string } {
  if (!Array.isArray(hours) || hours.length === 0) {
    return { error: 'Enter the opening and closing time for at least one day.' };
  }
  if (hours.length > 7) return { error: 'There are only seven days in a week.' };

  const seen = new Set<number>();
  const checked: ValidBusiness['hours'] = [];
  for (const entry of hours) {
    const { day, opens, closes } = (entry ?? {}) as Record<string, unknown>;
    if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 7) {
      return { error: 'Each opening time needs a day from Monday to Sunday.' };
    }
    const name = DAY_NAMES[day - 1];
    if (seen.has(day)) return { error: `${name} is listed more than once.` };
    seen.add(day);
    if (typeof opens !== 'string' || typeof closes !== 'string' || !TIME.test(opens) || !TIME.test(closes)) {
      return { error: `Enter ${name}'s opening and closing times.` };
    }
    if (closes <= opens) return { error: `${name} must close after it opens.` };
    checked.push({ day, opens, closes });
  }
  return { hours: checked.sort((a, b) => a.day - b.day) };
}

// UT-005 / REQ-3.3: a listing with missing or bad fields gets one message per field, and nothing else
export function validateBusiness(body: unknown): { errors: Record<string, string>; value?: ValidBusiness } {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const name = text(input.name);
  if (!name) errors.name = 'Enter the business name.';
  else if (name.length > BUSINESS_LIMITS.name) errors.name = `The name can be at most ${BUSINESS_LIMITS.name} characters.`;

  const categoryId = typeof input.categoryId === 'string' ? input.categoryId.trim() : '';
  if (!isRecordId(categoryId)) errors.categoryId = 'Choose a category.';

  const description = text(input.description);
  if (!description) errors.description = 'Describe the business.';
  else if (description.length > BUSINESS_LIMITS.description) {
    errors.description = `The description can be at most ${BUSINESS_LIMITS.description} characters.`;
  }

  const street = text(input.street);
  if (!street) errors.street = 'Enter the street address.';
  else if (street.length > BUSINESS_LIMITS.street) errors.street = `The street can be at most ${BUSINESS_LIMITS.street} characters.`;

  const city = text(input.city);
  if (!city) errors.city = 'Enter the city.';
  else if (city.length > BUSINESS_LIMITS.city) errors.city = `The city can be at most ${BUSINESS_LIMITS.city} characters.`;

  const rawPostal = text(input.postalCode);
  const postalCode = rawPostal ? normalizePostalCode(rawPostal) : null;
  if (!rawPostal) errors.postalCode = 'Enter the postal code.';
  else if (!postalCode) errors.postalCode = 'Enter a postal code like L8P 1A1.';

  const rawPhone = text(input.phone);
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (!rawPhone) errors.phone = 'Enter the phone number.';
  else if (!phone) errors.phone = 'Enter a 10-digit phone number like 905-555-0101.';

  const email = text(input.email).toLowerCase();
  if (!email) errors.email = 'Enter the business email address.';
  else if (!isValidEmail(email)) errors.email = 'Enter a valid email address.';

  const website = text(input.website);
  if (website && (website.length > BUSINESS_LIMITS.website || !isWebAddress(website))) {
    errors.website = 'Enter a web address that starts with http:// or https://.';
  }

  const { hours, error: hoursError } = checkHours(input.hours);
  if (hoursError) errors.hours = hoursError;

  if (Object.keys(errors).length > 0 || !postalCode || !phone || !hours) return { errors };
  return {
    errors,
    value: { name, categoryId, description, street, city, postalCode, phone, email, website: website || null, hours },
  };
}
