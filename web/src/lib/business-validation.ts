import { DAY_NAMES } from './format';
import { isValidEmail } from './validation';

// REQ-4.1.7 the same rules as server/src/business-validation.ts, checked before anything is sent.
// The server still checks everything again, and it is the copy that counts.
export const BUSINESS_LIMITS = { name: 100, description: 1000, street: 100, city: 60, website: 200 } as const;

export type DayHours = { open: boolean; opens: string; closes: string };
export type BusinessForm = {
  name: string;
  categoryId: string;
  description: string;
  street: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  hours: DayHours[];
};
export type BusinessFormErrors = Partial<Record<keyof BusinessForm, string>>;

const POSTAL_CODE = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
const PHONE_CHARACTERS = /^[\d\s().+-]+$/;
const NORTH_AMERICAN_PHONE = /^[2-9]\d{2}[2-9]\d{6}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function isPhone(value: string): boolean {
  if (!PHONE_CHARACTERS.test(value)) return false;
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return NORTH_AMERICAN_PHONE.test(digits);
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

function hoursError(hours: DayHours[]): string | undefined {
  const open = hours.map((h, index) => ({ ...h, name: DAY_NAMES[index] })).filter((h) => h.open);
  if (open.length === 0) return 'Enter the opening and closing time for at least one day.';
  for (const { opens, closes, name } of open) {
    if (!TIME.test(opens) || !TIME.test(closes)) return `Enter ${name}'s opening and closing times.`;
    if (closes <= opens) return `${name} must close after it opens.`;
  }
  return undefined;
}

// UT-005 (REQ-3.3): one message per field that is missing or wrong
export function validateBusinessForm(form: BusinessForm): BusinessFormErrors {
  const errors: BusinessFormErrors = {};
  const name = form.name.trim();
  const description = form.description.trim();
  const street = form.street.trim();
  const city = form.city.trim();
  const postalCode = form.postalCode.trim();
  const phone = form.phone.trim();
  const email = form.email.trim().toLowerCase();
  const website = form.website.trim();

  if (!name) errors.name = 'Enter the business name.';
  else if (name.length > BUSINESS_LIMITS.name) errors.name = `The name can be at most ${BUSINESS_LIMITS.name} characters.`;

  if (!form.categoryId) errors.categoryId = 'Choose a category.';

  if (!description) errors.description = 'Describe the business.';
  else if (description.length > BUSINESS_LIMITS.description) {
    errors.description = `The description can be at most ${BUSINESS_LIMITS.description} characters.`;
  }

  if (!street) errors.street = 'Enter the street address.';
  else if (street.length > BUSINESS_LIMITS.street) errors.street = `The street can be at most ${BUSINESS_LIMITS.street} characters.`;

  if (!city) errors.city = 'Enter the city.';
  else if (city.length > BUSINESS_LIMITS.city) errors.city = `The city can be at most ${BUSINESS_LIMITS.city} characters.`;

  if (!postalCode) errors.postalCode = 'Enter the postal code.';
  else if (!POSTAL_CODE.test(postalCode)) errors.postalCode = 'Enter a postal code like L8P 1A1.';

  if (!phone) errors.phone = 'Enter the phone number.';
  else if (!isPhone(phone)) errors.phone = 'Enter a 10-digit phone number like 905-555-0101.';

  if (!email) errors.email = 'Enter the business email address.';
  else if (!isValidEmail(email)) errors.email = 'Enter a valid email address.';

  if (website && (website.length > BUSINESS_LIMITS.website || !isWebAddress(website))) {
    errors.website = 'Enter a web address that starts with http:// or https://.';
  }

  const hours = hoursError(form.hours);
  if (hours) errors.hours = hours;

  return errors;
}
