import { safeStorage } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export class CredentialManager {
  private fallbackKey: Buffer | null = null;
  private keyFilePath: string;
  private encryptionMode: 'os-keychain' | 'aes-gcm-fallback' = 'os-keychain';

  constructor(userDataPath: string) {
    this.keyFilePath = path.join(userDataPath, '.master.key');
    this.init();
  }

  private init() {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        this.encryptionMode = 'os-keychain';
      } else {
        this.encryptionMode = 'aes-gcm-fallback';
        this.loadOrCreateFallbackKey();
      }
    } catch {
      this.encryptionMode = 'aes-gcm-fallback';
      this.loadOrCreateFallbackKey();
    }
  }

  private loadOrCreateFallbackKey() {
    try {
      if (fs.existsSync(this.keyFilePath)) {
        this.fallbackKey = fs.readFileSync(this.keyFilePath);
      } else {
        this.fallbackKey = crypto.randomBytes(32);
        fs.writeFileSync(this.keyFilePath, this.fallbackKey, { mode: 0o600 });
      }
    } catch (e) {
      // Memory fallback if disk write fails
      this.fallbackKey = crypto.randomBytes(32);
    }
  }

  public getEncryptionMode(): 'os-keychain' | 'aes-gcm-fallback' {
    return this.encryptionMode;
  }

  public encrypt(plainText: string): string {
    if (!plainText) return '';
    try {
      if (this.encryptionMode === 'os-keychain' && safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(plainText);
        return `safe:${encrypted.toString('base64')}`;
      }
    } catch (e) {
      // Fallback
    }

    if (!this.fallbackKey) {
      this.loadOrCreateFallbackKey();
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.fallbackKey!, iv);
    const enc = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `gcm:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
  }

  public decrypt(cipherText: string): string {
    if (!cipherText) return '';
    try {
      if (cipherText.startsWith('safe:')) {
        const base64 = cipherText.slice(5);
        const buf = Buffer.from(base64, 'base64');
        return safeStorage.decryptString(buf);
      }

      if (cipherText.startsWith('gcm:')) {
        const parts = cipherText.split(':');
        if (parts.length === 4) {
          const iv = Buffer.from(parts[1], 'base64');
          const tag = Buffer.from(parts[2], 'base64');
          const enc = Buffer.from(parts[3], 'base64');

          if (!this.fallbackKey) {
            this.loadOrCreateFallbackKey();
          }

          const decipher = crypto.createDecipheriv('aes-256-gcm', this.fallbackKey!, iv);
          decipher.setAuthTag(tag);
          return decipher.update(enc) + decipher.final('utf8');
        }
      }

      // Plaintext backwards compatibility
      return cipherText;
    } catch (e) {
      console.error('[CredentialManager] Decryption failed:', e);
      return '';
    }
  }
}
