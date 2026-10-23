/**
 * AES-256-GCM secret encryption for credentials stored at rest (e.g. WhatsApp access tokens).
 * Never log the decrypted value or return it from a tRPC procedure.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { env } from '~/env'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getKey(): Buffer {
  if (!env.MESSAGING_SECRET) {
    throw new Error('MESSAGING_SECRET is not configured')
  }
  const key = Buffer.from(env.MESSAGING_SECRET, 'base64')
  if (key.length !== 32) {
    throw new Error('MESSAGING_SECRET must decode to 32 bytes (openssl rand -base64 32)')
  }
  return key
}

/** Encrypts `plain` to a self-contained `iv:authTag:ciphertext` payload, each base64. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv, authTag, ciphertext].map((part) => part.toString('base64')).join(':')
}

/** Decrypts a payload produced by {@link encryptSecret}. */
export function decryptSecret(payload: string): string {
  const [ivB64, authTagB64, ciphertextB64] = payload.split(':')
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Malformed encrypted secret payload')
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}

/** Masked display hint for a secret, e.g. `••••1234`, never the full value. */
export function maskSecret(plain: string): string {
  const tail = plain.slice(-4)
  return `••••${tail}`
}
