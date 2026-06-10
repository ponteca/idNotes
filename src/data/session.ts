import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistência simples de sessão (RF004/RF005).
 *
 * Observação: a idKey aqui é tratada apenas como um token local (mock) —
 * não há geração/validação criptográfica nem integração com backend.
 * Guarda o token no AsyncStorage até o logout explícito.
 */
const SESSION_KEY = '@idnotes_session';

/**
 * Key padrão de acesso ao sistema (mock). Permite entrar sem backend.
 * Quando a autenticação real (idKey/HMAC) for implementada, basta trocar
 * `isValidIdKey` pela validação contra o servidor.
 */
export const DEFAULT_ID_KEY = '00001';

export function isValidIdKey(key: string): boolean {
  return key.trim() === DEFAULT_ID_KEY;
}

export async function getSession(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export async function saveSession(token: string): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, token);
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
