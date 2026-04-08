import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  SafeAreaView,
  Alert,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotes } from '../data/NotesContext';
import { Note } from '../data/mockData';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PosLoginScreen() {
  const { notes, addNote } = useNotes();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (inputText.trim()) {
      const lines = inputText.trim().split('\n');
      const title = lines[0];
      const content = lines.slice(1).join('\n') || title;

      const newNote: Note = {
        id: Date.now().toString(),
        title,
        content,
        category: 'sem_categoria',
        hasTasklist: false,
        updatedAt: new Date(),
        rawBlocks: JSON.stringify([
          { id: 'h1-' + Date.now(), type: 'h1', content: title, formatting: {} },
          ...lines.slice(1).filter(Boolean).map((line, idx) => ({ 
             id: 'text-' + Date.now() + '-' + idx, 
             type: 'text', 
             content: line, 
             formatting: {} 
          }))
        ])
      };
      
      addNote(newNote);
      setInputText('');
      Keyboard.dismiss();
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.greeting}>Olá</Text>
          <Text style={styles.subtitle}>O que está na sua cabeça?</Text>
        </View>
        {/* RN-003: Ícone Home só renderiza quando count(notas) > 0 */}
        {notes.length > 0 && (
          <TouchableOpacity style={styles.menuButton} accessibilityLabel="Menu (Minhas Notas)" onPress={() => router.push('/05home')}>
            <Ionicons name="reorder-two" size={32} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Adicione a anotação..."
          placeholderTextColor="#8e95a5"
          value={inputText}
          onChangeText={setInputText}
          multiline
          textAlignVertical="top"
        />
        <View style={styles.inputActionRow}>
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            accessibilityLabel="Adicionar nota"
          >
            <Ionicons name="arrow-up" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {notes.length > 0 && (
         <Text style={styles.sectionTitle}>ÚLTIMAS NOTAS</Text>
      )}
    </View>
  );

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconPlaceholder, { justifyContent: 'center', alignItems: 'center' }]}>
         <Ionicons name="document-text-outline" size={32} color="#2a324a" />
      </View>
      <Text style={styles.emptyText}>
        Você ainda não tem notas.{'\n'}Crie sua primeira acima.
      </Text>
    </View>
  );

  const renderNoteCard = ({ item }: { item: Note }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => router.push(`/06editarnotes?id=${item.id}`)}>
      <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.cardContent} numberOfLines={2}>{item.content}</Text>
    </TouchableOpacity>
  );

  // Filtragem estrita: Apenas as 4 notas mais recentes
  const recentNotes = [...notes]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 4);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={recentNotes}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={notes.length > 0 ? styles.row : undefined}
          ListHeaderComponent={renderHeader()}
          ListEmptyComponent={renderEmptyComponent()}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(20, insets.bottom + 10) }]}
          renderItem={renderNoteCard}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0e1a', // Dark Navy background (RNF-009)
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
  },
  listContent: {
    paddingTop: 8,
    flexGrow: 1,
  },
  headerContainer: {
    marginBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
    marginTop: 16,
  },
  greeting: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a7b5',
  },
  menuButton: {
    // RNF-010: Área de toque mínima 48x48dp
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#151b2b',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a324a',
  },
  inputContainer: {
    backgroundColor: '#151b2b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a324a',
    padding: 16,
    minHeight: 160,
    justifyContent: 'space-between',
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    minHeight: 80,
  },
  inputActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#2a324a',
    paddingTop: 12,
    marginTop: 8,
  },
  sendButton: {
    // RNF-010: Área de toque mínima 48x48dp
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF', // Azul para o botão de envio
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#2a324a',
  },
  sectionTitle: {
    color: '#8e95a5',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 32,
    marginBottom: 16,
  },
  row: {
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: '#151b2b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a324a',
    width: '48%', // Acomoda 2 por linha com espaço no meio (RF-010)
    marginBottom: 16,
    minHeight: 120,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  cardContent: {
    fontSize: 14,
    color: '#a0a7b5',
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '20%',
  },
  emptyIconPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#151b2b',
    borderWidth: 1,
    borderColor: '#2a324a',
    marginBottom: 24,
  },
  emptyText: {
    color: '#8e95a5',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
