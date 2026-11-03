import 'dotenv/config';
import { pool } from '../src/db';

// Sample approved business listings and events, so browse, search, filter and pagination have something
// to show before the admin approval flow exists. Every name, phone number and address is made up, the
// emails and websites use the reserved example.com domain, and the listings belong to no account.
// Event dates are counted from the day the script runs, so there are always upcoming events (and two
// past ones). Safe to re-run: a business or event whose name is already there is skipped.
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

// startsInDays counts from today (negative is the past); the event starts at the given hour, Toronto time
type EventSample = {
  title: string;
  category: string;
  description: string;
  location: string;
  startsInDays: number;
  hour: number;
  hours: number;
  organizer: string;
  contact: string;
};

const EVENT_SAMPLES: EventSample[] = [
  { title: 'Norouz Festival', category: 'Festival', description: 'Haft-sin tables, live music and food stalls to welcome the Persian New Year.', location: 'Hamilton Convention Centre, 1 Sample Street, Hamilton', startsInDays: 12, hour: 11, hours: 8, organizer: 'Hamilton Iranian Association', contact: 'hello@hamilton-iranian.example.com' },
  { title: 'Yalda Night Celebration', category: 'Celebration', description: 'Pomegranates, poetry from Hafez and a long night of music for the winter solstice.', location: 'Mississauga Banquet Hall, 45 Example Road, Mississauga', startsInDays: 20, hour: 19, hours: 5, organizer: 'Peel Persian Community', contact: 'info@peel-persian.example.com' },
  { title: 'Persian Calligraphy Workshop', category: 'Workshop', description: 'Learn the basics of nastaliq with a master calligrapher. All materials are included.', location: 'Toronto Cultural Hub, 88 Demo Avenue, Toronto', startsInDays: 5, hour: 14, hours: 3, organizer: 'Tehran Books & Crafts', contact: 'workshops@tehran-books.example.com' },
  { title: 'Persian Cooking Class: Ghormeh Sabzi', category: 'Workshop', description: 'Cook a pot of ghormeh sabzi from scratch and share it at the table afterwards.', location: 'Darband Kitchen Studio, 45 Example Road, Mississauga', startsInDays: 9, hour: 17, hours: 3, organizer: 'Darband Restaurant', contact: 'classes@darband.example.com' },
  { title: 'Introduction to the Farsi Language', category: 'Educational', description: 'A free first lesson in reading, writing and everyday phrases, for beginners.', location: 'Burlington Public Library, 301 Example Road, Burlington', startsInDays: 7, hour: 18, hours: 2, organizer: 'Farsi Learners Ontario', contact: 'learn@farsi-ontario.example.com' },
  { title: 'Settling in Ontario: A Newcomer Information Evening', category: 'Educational', description: 'Short talks on housing, work and schooling, followed by questions in English and Farsi.', location: 'Richmond Hill Community Centre, 500 Demo Avenue, Richmond Hill', startsInDays: 15, hour: 18, hours: 3, organizer: 'Damavand Immigration Consulting', contact: 'events@damavand.example.com' },
  { title: 'Tea and Backgammon Afternoon', category: 'Social Gathering', description: 'Meet neighbours over tea and a few games of backgammon. Boards provided.', location: 'Persepolis Cafe, 17 Demo Avenue, Toronto', startsInDays: 3, hour: 15, hours: 3, organizer: 'Persepolis Cafe', contact: 'cafe@persepolis.example.com' },
  { title: 'Community Picnic in the Park', category: 'Social Gathering', description: 'Bring a dish to share. Games for the children and a soccer match in the afternoon.', location: 'Bayfront Park, Hamilton', startsInDays: 30, hour: 12, hours: 5, organizer: 'Hamilton Iranian Association', contact: 'hello@hamilton-iranian.example.com' },
  { title: 'Evening of Persian Classical Music', category: 'Cultural Events', description: 'Setar, tar and santur with vocals, performed by students and teachers of the academy.', location: 'Setar Music Academy, 36 Example Road, Toronto', startsInDays: 10, hour: 19, hours: 2, organizer: 'Setar Music Academy', contact: 'concerts@setar.example.com' },
  { title: 'Shahnameh Poetry Reading', category: 'Cultural Events', description: 'Readings from Ferdowsi in Farsi with English summaries between the stories.', location: 'Toronto Cultural Hub, 88 Demo Avenue, Toronto', startsInDays: 18, hour: 19, hours: 2, organizer: 'Toronto Persian Literature Circle', contact: 'readings@persian-literature.example.com' },
  { title: 'Persian Film Night', category: 'Cultural Events', description: 'A screening of a classic Iranian film with English subtitles and a short discussion.', location: 'Oakville Arts Centre, 9 Example Road, Oakville', startsInDays: 25, hour: 19, hours: 3, organizer: 'Pars Rug Gallery', contact: 'films@pars.example.com' },
  { title: 'Chaharshanbe Suri Bonfire', category: 'Festival', description: 'The traditional fire-jumping festival before Norouz, with music and sweets.', location: 'Bronte Beach Park, Oakville', startsInDays: 40, hour: 18, hours: 4, organizer: 'Oakville Persian Society', contact: 'suri@oakville-persian.example.com' },
  { title: 'Mehregan Autumn Festival', category: 'Festival', description: 'An autumn harvest celebration with food, dance and a market of Persian goods.', location: 'Mississauga Banquet Hall, 45 Example Road, Mississauga', startsInDays: -20, hour: 12, hours: 6, organizer: 'Peel Persian Community', contact: 'info@peel-persian.example.com' },
  { title: 'Sizdah Bedar Family Day', category: 'Celebration', description: 'Spend the thirteenth day of the new year outdoors with food, music and games.', location: 'Spencer Smith Park, Burlington', startsInDays: -45, hour: 11, hours: 6, organizer: 'Burlington Iranian Families', contact: 'families@burlington-iranian.example.com' },
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

async function seedEvents() {
  let added = 0;
  for (const sample of EVENT_SAMPLES) {
    const existing = await pool.query('SELECT 1 FROM events WHERE title = $1', [sample.title]);
    if (existing.rowCount) continue;

    // Today in Toronto plus the number of days, at the hour given in Toronto time
    const { rowCount } = await pool.query(
      `INSERT INTO events
         (category_id, title, description, location, starts_at, ends_at, organizer_name, organizer_contact, status)
       SELECT c.id, $2, $3, $4,
              ((now() AT TIME ZONE 'America/Toronto')::date + $5::int + make_interval(hours => $6::int)) AT TIME ZONE 'America/Toronto',
              ((now() AT TIME ZONE 'America/Toronto')::date + $5::int + make_interval(hours => $6::int + $7::int)) AT TIME ZONE 'America/Toronto',
              $8, $9, 'approved'
       FROM categories c WHERE c.type = 'event' AND c.name = $1`,
      [sample.category, sample.title, sample.description, sample.location, sample.startsInDays, sample.hour, sample.hours, sample.organizer, sample.contact],
    );
    if (!rowCount) throw new Error(`Unknown event category: ${sample.category}`);
    added += 1;
  }
  console.log(`added ${added} sample events, ${EVENT_SAMPLES.length - added} were already there`);
}

seedListings()
  .then(seedEvents)
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
