import type express from 'express';
import type { AuthContext } from '../auth.js';

export type AuthedRequest = express.Request & {
  auth?: AuthContext;
  requestId?: string;
};
