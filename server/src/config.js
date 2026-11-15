import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'mailpilot-ai-dev-secret-change-me',
  jwtExpiresIn: '7d',

  mongoUri: process.env.MONGODB_URI || '',
  dataDir: process.env.DATA_DIR || path.join(__dirname, '..', '.data'),
  persist: process.env.PERSIST !== '0',

  aiProvider: process.env.AI_PROVIDER || 'builtin',
  openaiKey: process.env.OPENAI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'gpt-4o-mini',
  aiBaseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',

  clientDist: path.join(__dirname, '..', '..', 'client', 'dist'),
};
