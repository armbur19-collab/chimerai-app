// @chimerai component=EncryptionLib version=1.0
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;  // 128 bits — must match CLI and @chimerai/model-providers
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.PROVIDER_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('PROVIDER_ENCRYPTION_KEY environment variable is required');
  }
  // If key is hex (64 chars = 32 bytes), use as-is; otherwise hash it
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  return crypto.createHash('sha256').update(key).digest();
}

export function encrypt(text: string): string {
  if (!text) return '';
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return iv.toString('base64') + ':' + authTag.toString('base64') + ':' + encrypted;
}

export function decrypt(text: string): string {
  if (!text) return '';
  const key = getKey();
  const parts = text.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const encryptedText = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Encrypt an API key for storage (alias for encrypt)
 */
export function encryptApiKey(apiKey: string): string {
  return encrypt(apiKey);
}

/**
 * Decrypt an API key from storage (alias for decrypt)
 */
export function decryptApiKey(encryptedKey: string): string {
  return decrypt(encryptedKey);
}
