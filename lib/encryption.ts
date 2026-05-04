import crypto from "crypto";

// Encryption key should be 32 bytes for AES-256
// Store in environment variable: ENCRYPTION_KEY
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  // If key is hex-encoded (64 chars = 32 bytes)
  if (key.length === 64) {
    return Buffer.from(key, "hex");
  }
  // If key is base64-encoded
  if (key.length === 44) {
    return Buffer.from(key, "base64");
  }
  // Hash the key to ensure correct length
  return crypto.createHash("sha256").update(key).digest();
}

/**
 * Encrypts a string using AES-256-GCM
 * @param plaintext The string to encrypt
 * @returns Base64-encoded encrypted string with IV and auth tag
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Combine IV + AuthTag + Encrypted data
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, "hex"),
  ]);

  return combined.toString("base64");
}

/**
 * Decrypts a string that was encrypted with the encrypt function
 * @param encryptedData Base64-encoded encrypted string
 * @returns The original plaintext string
 */
export async function decrypt(encryptedData: string): Promise<string> {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, "base64");

  // Extract IV, AuthTag, and encrypted data
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.toString("hex"), "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generates a new encryption key (run once to create ENCRYPTION_KEY)
 * @returns Hex-encoded 32-byte key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Creates a short hash of sensitive data for logging/correlation purposes
 * Does NOT expose the original value, just allows matching across logs
 * @param value The sensitive value to hash
 * @returns First 8 characters of SHA-256 hash
 */
export function hashForLogging(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").substring(0, 8);
}

/**
 * Safely decrypts a string, returning null if decryption fails
 * Use this when you want to gracefully handle decryption errors
 * @param encryptedData Base64-encoded encrypted string
 * @returns The decrypted string or null if decryption fails
 */
export async function safeDecrypt(encryptedData: string | null): Promise<string | null> {
  if (!encryptedData) return null;

  try {
    return await decrypt(encryptedData);
  } catch (error) {
    console.error("[Encryption] Failed to decrypt data:", error);
    return null;
  }
}

/**
 * Checks if a value appears to be encrypted (base64 with correct length)
 * Used to detect unencrypted legacy tokens that need migration
 *
 * Encrypted format: IV (16 bytes) + AuthTag (16 bytes) + Ciphertext
 * Minimum encrypted length for empty string: 32 bytes = ~44 base64 chars
 *
 * Provider tokens have predictable prefixes (unencrypted)
 * Encrypted data is base64 and doesn't contain hyphens at known positions
 *
 * @param value The value to check
 * @returns true if the value appears to be encrypted
 */
export function isEncrypted(value: string | null): boolean {
  if (!value) return false;

  // Common API token prefixes (sk_, rk_) are not encrypted
  if (value.startsWith("sk_") || value.startsWith("rk_")) {
    return false;
  }

  // GitHub tokens start with ghp_, gho_, ghu_, ghs_, ghr_
  if (/^gh[pours]_/.test(value)) {
    return false;
  }

  // Check if it looks like valid base64 with correct minimum length
  // IV (16) + AuthTag (16) + at least 1 byte ciphertext = 33+ bytes = 44+ base64 chars
  if (value.length < 44) {
    return false;
  }

  // Validate base64 format
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (!base64Regex.test(value)) {
    return false;
  }

  // Try to decode and check structure
  try {
    const decoded = Buffer.from(value, "base64");
    // Must be at least IV_LENGTH + AUTH_TAG_LENGTH bytes
    return decoded.length >= IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}
