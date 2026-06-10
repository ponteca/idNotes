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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * T-02 - Obter idKey.
 * Coleta o e-mail e (mock) "envia" a idKey. Exibe o aviso de que a idKey
 * não pode ser recuperada (RF006). Sem geração/integração real da chave.
 */
export default function ObterKey() {
  const router = useRouter();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!EMAIL_RE.test(email.trim())) {
      showToast('Informe um e-mail válido', 'error');
      return;
    }
    // Mock: nenhum envio real é feito.
    setSent(true);
    showToast('idKey enviada para seu e-mail', 'success');
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

        {!sent ? (
          <View style={styles.content}>
            <Text style={styles.title}>Obter idKey</Text>
            <Text style={styles.subtitle}>
              Informe seu e-mail. Enviaremos sua idKey, sua chave de acesso sem senha.
            </Text>

            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#a0a7b5" />
              <TextInput
                style={[styles.input, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}]}
                placeholder="seu@email.com"
                placeholderTextColor="#8e95a5"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={handleSend}
              />
            </View>

            {/* RF006 - aviso de que a idKey não pode ser recuperada */}
            <View style={styles.warning}>
              <Ionicons name="warning-outline" size={18} color="#FFD60A" />
              <Text style={styles.warningText}>
                Guarde sua idKey com cuidado. Ela não pode ser recuperada caso seja perdida.
              </Text>
            </View>

            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={handleSend}>
              <Text style={styles.primaryBtnText}>Enviar idKey</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.content}>
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={48} color="#34C759" />
            </View>
            <Text style={styles.title}>Verifique seu e-mail</Text>
            <Text style={styles.subtitle}>
              Enviamos sua idKey para{'\n'}
              <Text style={styles.emailHighlight}>{email.trim()}</Text>
            </Text>

            <View style={styles.warning}>
              <Ionicons name="warning-outline" size={18} color="#FFD60A" />
              <Text style={styles.warningText}>
                Não compartilhe sua idKey. Ela não pode ser recuperada caso seja perdida.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={() => router.replace('/03loguin')}
            >
              <Text style={styles.primaryBtnText}>Ir para o login</Text>
            </TouchableOpacity>
          </View>
        )}
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
  successBadge: {
    alignItems: 'center',
    marginBottom: 16,
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
  emailHighlight: {
    color: '#ffffff',
    fontWeight: 'bold',
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
    marginBottom: 20,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255, 214, 10, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 10, 0.25)',
    padding: 14,
    marginBottom: 28,
  },
  warningText: {
    flex: 1,
    color: '#d1d5db',
    fontSize: 13,
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
