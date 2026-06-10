import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useToast } from '../components/Toast';
import { saveSession, isValidIdKey, DEFAULT_ID_KEY } from '../data/session';

/**
 * T-03 - Login.
 * Campo para colar a idKey. A sessão é persistida localmente até o logout
 * (RF003/RF004). Sem validação criptográfica/backend: qualquer chave não
 * vazia é aceita (mock).
 */
export default function Loguin() {
  const router = useRouter();
  const { showToast } = useToast();
  const [idKey, setIdKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const value = idKey.trim();
    if (!value) {
      showToast('Cole sua idKey para entrar', 'error');
      return;
    }
    if (!isValidIdKey(value)) {
      showToast('idKey inválida', 'error');
      return;
    }
    setLoading(true);
    try {
      await saveSession(value);
      showToast('Login realizado', 'success');
      router.replace('/04poslogin');
    } catch {
      showToast('Não foi possível entrar', 'error');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={28} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>Entrar</Text>
          <Text style={styles.subtitle}>Cole a idKey que você recebeu por e-mail.</Text>

          <View style={styles.inputWrapper}>
            <Ionicons name="key-outline" size={20} color="#a0a7b5" />
            <TextInput
              style={[styles.input, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}]}
              placeholder="IDK-XXXX-XXXX-..."
              placeholderTextColor="#8e95a5"
              autoCapitalize="characters"
              autoCorrect={false}
              value={idKey}
              onChangeText={setIdKey}
              onSubmitEditing={handleLogin}
            />
          </View>

          <Text style={styles.hint}>Key padrão de acesso: {DEFAULT_ID_KEY}</Text>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.primaryBtnText}>Entrar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => router.replace('/02obterkey')}>
            <Text style={styles.linkText}>Não tenho uma idKey</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0e1a',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
  },
  backBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    marginTop: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a7b5',
    lineHeight: 24,
    marginBottom: 28,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#151b2b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a324a',
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 12,
  },
  hint: {
    color: '#8e95a5',
    fontSize: 13,
    marginBottom: 24,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
  },
  primaryBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkBtn: {
    alignItems: 'center',
    marginTop: 20,
    padding: 8,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
