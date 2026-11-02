import 'dotenv/config';
import { pool } from '../src/db';

// Sample approved business listings, so browse, search, filter and pagination have something to show
// before the admin approval flow exists. Every name, phone number and address is made up, the emails
// and websites use the reserved example.com domain, and the listings belong to no account.
// Safe to re-run: a business whose name is already there is skipped.
type Sample = {
  name: string;
  category: string;
  description: string;
  street: string;
  city: string;
  postalCode: string;
  phone: string;
  website?: string;
  hours: [days: number[], opens: string, closes: string][];
};

const MON_SAT = [1, 2, 3, 4, 5, 6];
const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];
const WEEKDAYS = [1, 2, 3, 4, 5];

const SAMPLES: Sample[] = [
  { name: 'Norouz Restaurant', category: 'Restaurant', description: 'Family-run kitchen serving grilled kebabs, stews and saffron rice.', street: '210 Sample Street', city: 'Hamilton', postalCode: 'L8P 1A1', phone: '905-555-0101', website: 'https://example.com/norouz', hours: [[EVERY_DAY, '11:00', '22:00']] },
  { name: 'Darband Restaurant', category: 'Restaurant', description: 'Mountain-style Persian dining with a long dessert menu.', street: '45 Example Road', city: 'Mississauga', postalCode: 'L5B 1B2', phone: '905-555-0102', website: 'https://example.com/darband', hours: [[MON_SAT, '12:00', '23:00']] },
  { name: 'Golestan Restaurant', category: 'Restaurant', description: 'Garden-themed restaurant known for its ghormeh sabzi.', street: '88 Demo Avenue', city: 'Toronto', postalCode: 'M5V 2C3', phone: '416-555-0103', hours: [[EVERY_DAY, '11:30', '22:30']] },
  { name: 'Shiraz Persian Kitchen', category: 'Restaurant', description: 'Casual kitchen with lunch specials and takeout.', street: '12 Sample Street', city: 'Hamilton', postalCode: 'L8N 2D4', phone: '905-555-0104', hours: [[WEEKDAYS, '11:00', '21:00'], [[6, 7], '12:00', '22:00']] },
  { name: 'Isfahan Kitchen', category: 'Restaurant', description: 'Slow-cooked dishes and fresh-baked flatbread.', street: '301 Example Road', city: 'Burlington', postalCode: 'L7R 3E5', phone: '905-555-0105', hours: [[MON_SAT, '11:00', '21:00']] },
  { name: 'Persepolis Cafe', category: 'Restaurant', description: 'Tea house with pastries, ice cream and live music on Fridays.', street: '17 Demo Avenue', city: 'Toronto', postalCode: 'M4Y 1F6', phone: '416-555-0106', hours: [[EVERY_DAY, '09:00', '23:00']] },
  { name: 'Tehran Books & Crafts', category: 'Retail', description: 'Persian-language books, calligraphy supplies and handmade crafts.', street: '64 Sample Street', city: 'Hamilton', postalCode: 'L8S 4G7', phone: '905-555-0107', website: 'https://example.com/tehran-books', hours: [[MON_SAT, '10:00', '18:00']] },
  { name: 'Pars Rug Gallery', category: 'Retail', description: 'Hand-knotted rugs, with cleaning and repair on site.', street: '9 Example Road', city: 'Oakville', postalCode: 'L6H 5H8', phone: '905-555-0108', hours: [[MON_SAT, '10:00', '19:00']] },
  { name: 'Saffron Spice Market', category: 'Retail', description: 'Spices, dried fruit, teas and Persian pantry staples.', street: '150 Demo Avenue', city: 'Mississauga', postalCode: 'L4Z 1J9', phone: '905-555-0109', hours: [[EVERY_DAY, '09:00', '20:00']] },
  { name: 'Zafaranieh Sweets', category: 'Retail', description: 'Bakery counter for baklava, gaz and cakes made to order.', street: '73 Sample Street', city: 'Toronto', postalCode: 'M6G 2K1', phone: '416-555-0110', website: 'https://example.com/zafaranieh', hours: [[MON_SAT, '08:00', '19:00']] },
  { name: 'Caspian Hair Studio', category: 'Services', description: 'Cuts, colour and bridal styling.', street: '28 Example Road', city: 'Hamilton', postalCode: 'L9A 3L2', phone: '905-555-0111', hours: [[[2, 3, 4, 5, 6], '10:00', '18:00']] },
  { name: 'Alborz Accounting', category: 'Professional Services', description: 'Personal and small business tax filing in English and Farsi.', street: '500 Demo Avenue', city: 'Richmond Hill', postalCode: 'L4B 4M3', phone: '905-555-0112', website: 'https://example.com/alborz', hours: [[WEEKDAYS, '09:00', '17:00']] },
  { name: 'Damavand Immigration Consulting', category: 'Professional Services', description: 'Guidance on settlement, study permits and citizenship applications.', street: '1 Sample Street', city: 'Toronto', postalCode: 'M2N 5N4', phone: '416-555-0113', hours: [[WEEKDAYS, '09:30', '17:30']] },
  { name: 'Setar Music Academy', category: 'Entertainment', description: 'Lessons in setar, tar, santur and Persian vocals for all ages.', street: '36 Example Road', city: 'Toronto', postalCode: 'M5T 1P5', phone: '416-555-0114', website: 'https://example.com/setar', hours: [[[2, 3, 4, 5, 6], '15:00', '20:00']] },
  { name: 'Hafez Wellness Clinic', category: 'Health & Wellness', description: 'Physiotherapy, massage and nutrition counselling.', street: '420 Demo Avenue', city: 'Burlington', postalCode: 'L7L 6R6', phone: '905-555-0115', hours: [[WEEKDAYS, '08:00', '18:00']] },
];

async function seedListings() {
  const client = await pool.connect();
  let added = 0;
  try {
    await client.query('BEGIN');
    for (const sample of SAMPLES) {
      const existing = await client.query('SELECT 1 FROM businesses WHERE name = $1', [sample.name]);
      if (existing.rowCount) continue;

      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO businesses
           (category_id, name, description, street, city, postal_code, phone, email, website, status)
         SELECT c.id, $2, $3, $4, $5, $6, $7, $8, $9, 'approved'
         FROM categories c WHERE c.type = 'business' AND c.name = $1
         RETURNING id`,
        [
          sample.category,
          sample.name,
          sample.description,
          sample.street,
          sample.city,
          sample.postalCode,
          sample.phone,
          `info@${sample.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.example.com`,
          sample.website ?? null,
        ],
      );
      if (!rows[0]) throw new Error(`Unknown business category: ${sample.category}`);

      for (const [days, opens, closes] of sample.hours) {
        for (const day of days) {
          await client.query(
            'INSERT INTO business_hours (business_id, day_of_week, opens_at, closes_at) VALUES ($1, $2, $3, $4)',
            [rows[0].id, day, opens, closes],
          );
        }
      }
      added += 1;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  console.log(`added ${added} sample businesses, ${SAMPLES.length - added} were already there`);
}

seedListings()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
