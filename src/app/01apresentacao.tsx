import React from 'react';
import { Image, View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';

/**
 * T-01 - Splash / Apresentação.
 * Primeira impressão e caminhos de entrada: obter idKey (T-02) ou login (T-03).
 */
export default function Apresentacao() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Image
            source={require('../../assets/images/idnotes-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>idNotes</Text>
          <Text style={styles.subtitle}>
            Capture suas ideias num toque.{'\n'}Sem cadastro, sem senha.
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/02obterkey')}
          >
            <Text style={styles.primaryBtnText}>Obter minha idKey</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/03loguin')}
          >
            <Text style={styles.secondaryBtnText}>Já tenho uma idKey</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    paddingHorizontal: 32,
    justifyContent: 'space-between',
    paddingVertical: 48,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: 24,
    borderRadius: 18,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a7b5',
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    gap: 12,
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
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#2a324a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
