import crypto from 'crypto';

// Short, URL-safe, unguessable enough for a personal tool.
export function newId(): string {
  return crypto.randomBytes(5).toString('hex');
}
