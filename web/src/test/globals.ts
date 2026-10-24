import { TextDecoder, TextEncoder } from 'node:util';

// jsdom leaves these out, and react-router needs them as soon as it loads
Object.assign(globalThis, { TextEncoder, TextDecoder });
