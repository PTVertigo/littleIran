import 'dotenv/config';
import path from 'node:path';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3000);

const webDist = process.env.NODE_ENV === 'production' ? path.join(__dirname, '..', '..', 'web', 'dist') : undefined;

createApp({ webDist }).listen(port, () => {
  console.log(`API listening on port ${port}`);
});
