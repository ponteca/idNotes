import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config';

/**
 * RNF001 - Gera uma idKey única para cada e-mail usando HMAC-SHA256.
 *
 * A chave combina o e-mail com um nonce aleatório de 16 bytes, garantindo
 * unicidade mesmo para o mesmo e-mail em solicitações distintas. O resultado
 * é codificado em Base32 (sem caracteres ambíguos) e agrupado para leitura.
 *
 * Exemplo de saída: IDK-7QF3-9XK2-PLM8-...
 */
// Crockford Base32: 32 símbolos, sem letras ambíguas (I, L, O, U).
const BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function toBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function generateIdKey(email: string): string {
  const nonce = crypto.randomBytes(16);
  const hmac = crypto
    .createHmac('sha256', config.idKey.hmacSecret)
    .update(`${email.toLowerCase()}:${nonce.toString('hex')}`)
    .digest();

  // Usa os 20 primeiros bytes do HMAC -> 32 chars Base32.
  const base32 = toBase32(hmac.subarray(0, 20));
  const groups = base32.match(/.{1,4}/g) ?? [base32];
  return `IDK-${groups.join('-')}`;
}

/**
 * RNF005 - Persistimos apenas o hash bcrypt da idKey, nunca o texto claro.
 */
export function hashIdKey(idKey: string): Promise<string> {
  return bcrypt.hash(idKey, config.idKey.bcryptRounds);
}

export function verifyIdKey(idKey: string, hash: string): Promise<boolean> {
  return bcrypt.compare(idKey, hash);
}
