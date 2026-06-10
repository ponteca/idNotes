import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  TextInput
} from 'react-native';
import Animated, {
  LinearTransition,
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FilterCategory, Note } from '../data/mockData';
import { useRouter } from 'expo-router';
import { useNotes } from '../data/NotesContext';
import { useToast } from '../components/Toast';
import { clearSession } from '../data/session';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type RowData =
  | { type: 'pair', id: string, left: Note, right?: Note }
  | { type: 'single', id: string, note: Note };

export default function HomeScreen() {
  const router = useRouter();
  const { notes, deleteNote, updateNote, isCustomOrder, allCategories, getCategoryColor, getCategoryLabel } = useNotes();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  // Filtros dinâmicos derivados das categorias
  const filterOptions: FilterCategory[] = useMemo(() => {
      return ['todas', ...allCategories.map(c => c.id)];
  }, [allCategories]);
  const [filter, setFilter] = useState<FilterCategory>('todas');
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  // Controle de Animação do Bottom Sheet
  const [modalVisible, setModalVisible] = useState(false);
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const slideAnim = useRef(new RNAnimated.Value(SCREEN_HEIGHT)).current;

  const handleOpenFilter = () => {
    setModalVisible(true);
    RNAnimated.parallel([
      RNAnimated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      RNAnimated.spring(slideAnim, {
        toValue: 0,
        bounciness: 4,
        useNativeDriver: false,
      })
    ]).start();
  };

  const handleCloseFilter = (selectedFilter?: FilterCategory) => {
    RNAnimated.parallel([
      RNAnimated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }),
      RNAnimated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: false,
      })
    ]).start(() => {
      setModalVisible(false);
      if (selectedFilter) {
        setFilter(selectedFilter);
      }
    });
  };

  // Derivando estado ordenado e filtrado (RF-016, RF-014)
  const sortedNotes = useMemo(() => {
    let filtered = [...notes].filter(n => filter === 'todas' || n.category === filter);
    
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(n => n.title.toLowerCase().includes(q));
    }

    // RF-016 overriding manual sort
    if (!isCustomOrder) {
      filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }
    return filtered;
  }, [notes, filter, isCustomOrder, searchQuery]);

  // RNF007: agrupa as notas em linhas para virtualização via FlatList.
  // Notas "sem_categoria" ocupam a linha inteira; as demais são paginadas
  // em pares (grade de 2 colunas), preservando a ordem cronológica.
  const rows: RowData[] = useMemo(() => {
    const result: RowData[] = [];
    let pendingDouble: Note | null = null;
    const flushPending = () => {
      if (pendingDouble) {
        result.push({ type: 'pair', id: `pair-${pendingDouble.id}`, left: pendingDouble });
        pendingDouble = null;
      }
    };
    for (const note of sortedNotes) {
      if (note.category === 'sem_categoria') {
        flushPending();
        result.push({ type: 'single', id: note.id, note });
      } else if (pendingDouble) {
        result.push({ type: 'pair', id: `pair-${pendingDouble.id}-${note.id}`, left: pendingDouble, right: note });
        pendingDouble = null;
      } else {
        pendingDouble = note;
      }
    }
    flushPending();
    return result;
  }, [sortedNotes]);

  const renderRow = ({ item }: { item: RowData }) => {
    if (item.type === 'single') {
      return <NoteCard note={item.note} />;
    }
    return (
      <View style={styles.flexWrapContainer}>
        <NoteCard note={item.left} />
        {item.right ? <NoteCard note={item.right} /> : <View style={styles.cardDouble} />}
      </View>
    );
  };

  // Ações de usuário
  const handleConfirmDelete = () => {
    if (noteToDelete) {
      deleteNote(noteToDelete);
      // RNF009: feedback ao excluir nota
      showToast('Nota excluída', 'info');
      setNoteToDelete(null);
      setDeleteModalVisible(false);
    }
  };

  const cancelDelete = () => {
    setNoteToDelete(null);
    setDeleteModalVisible(false);
  };

  // RF005: logout remove a sessão local e volta para a apresentação (T-01).
  const handleConfirmLogout = async () => {
    setLogoutModalVisible(false);
    await clearSession();
    showToast('Sessão encerrada', 'info');
    router.replace('/01apresentacao');
  };

  const handleOpenNote = (id: string) => {
    // Adicionado rand para evitar cache de rota
    router.push(`/06editarnotes?id=${id}&ts=${Date.now()}`);
  };

  const handleCreateNote = () => {
    // RF-011: Navegação para a T-06 (nota limpa)
    router.push('/06editarnotes');
  };

  const handleToggleCheck = (noteId: string, taskId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note && note.tasklistItems) {
      updateNote(noteId, {
        tasklistItems: note.tasklistItems.map(t =>
          t.id === taskId ? { ...t, checked: !t.checked } : t
        )
      });
    }
  };

  // Renderadores de UI Internos (NoteCard)
  const NoteCard = ({ note }: { note: Note }) => {
    const isSingleColumn = note.category === 'sem_categoria';
    const borderColor = getCategoryColor(note.category);
    const categoryLabel = getCategoryLabel(note.category);

    const triggerDeleteMenu = () => {
        setNoteToDelete(note.id);
        setDeleteModalVisible(true);
    };

    return (
        <Animated.View
          layout={LinearTransition.springify()}
          style={[
            styles.card,
            isSingleColumn ? styles.cardSingle : styles.cardDouble,
            { borderLeftColor: borderColor },
            Platform.OS === 'web' ? { touchAction: 'pan-y' } as any : {}
          ]}
        >
          <TouchableOpacity
             activeOpacity={0.7}
             onPress={() => handleOpenNote(note.id)}
             onLongPress={triggerDeleteMenu}
             delayLongPress={400}
             style={[{ flex: 1 }, Platform.OS === 'web' ? { userSelect: 'none', WebkitUserSelect: 'none' } as any : {}]}
          >
            <Text style={styles.cardTitle} numberOfLines={1}>{note.title}</Text>

            {note.hasTasklist && note.tasklistItems ? (
              <View style={styles.tasklistContainer}>
                {note.tasklistItems.slice(0, 3).map(task => (
                  <TouchableOpacity
                    key={task.id}
                    style={styles.taskItem}
                    onPress={() => handleToggleCheck(note.id, task.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={task.checked ? "checkmark-circle" : "ellipse-outline"}
                      size={16}
                      color={task.checked ? "#a0a7b5" : "#ffffff"}
                    />
                    <Text
                      style={[styles.taskText, task.checked && styles.taskTextChecked]}
                      numberOfLines={1}
                    >
                      {task.text}
                    </Text>
                  </TouchableOpacity>
                ))}
                {note.tasklistItems.length > 3 && (
                  <Text style={styles.cardContent}>+{note.tasklistItems.length - 3} itens</Text>
                )}
              </View>
            ) : (
              <Text style={styles.cardContent} numberOfLines={3}>{note.content}</Text>
            )}

            {!isSingleColumn && (
              <Text style={[styles.cardCategoryLabel, { color: borderColor }]}>
                {categoryLabel}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cardDeleteButton}
            onPress={triggerDeleteMenu}
            accessibilityLabel="Excluir nota"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={15} color="#a0a7b5" />
          </TouchableOpacity>
        </Animated.View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          {isSearching ? (
             <View style={{ flexDirection: 'row', flex: 1, alignItems: 'center', backgroundColor: '#151b2b', borderRadius: 24, paddingHorizontal: 16, height: 48, borderColor: '#2a324a', borderWidth: 1 }}>
                <Ionicons name="search" size={20} color="#a0a7b5" />
                <TextInput 
                   style={[{ flex: 1, color: '#ffffff', fontSize: 16, marginLeft: 12 }, Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}]}
                   placeholder="Pesquisar notas..."
                   placeholderTextColor="#8e95a5"
                   autoFocus
                   value={searchQuery}
                   onChangeText={setSearchQuery}
                />
                <TouchableOpacity style={{ padding: 4 }} onPress={() => { setIsSearching(false); setSearchQuery(''); }}>
                   <Ionicons name="close" size={20} color="#a0a7b5" />
                </TouchableOpacity>
             </View>
          ) : (
            <>
              <Text style={styles.headerTitle}>Minhas notas</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.iconButton} accessibilityLabel="Menu (Filtros)" onPress={handleOpenFilter}>
                  <Ionicons name="menu" size={24} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} accessibilityLabel="Buscar" onPress={() => setIsSearching(true)}>
                  <Ionicons name="search" size={24} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} accessibilityLabel="Sair" onPress={() => setLogoutModalVisible(true)}>
                  <Ionicons name="log-out-outline" size={24} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Chips horizontais */}
        <View style={styles.chipsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {filterOptions.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, filter === opt && styles.chipActive]}
                onPress={() => setFilter(opt)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, filter === opt && styles.chipTextActive]}>
                  {opt === 'todas' ? 'Todas' : getCategoryLabel(opt)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Grade de Notas virtualizada (RNF007: FlatList p/ até 100 notas) */}
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, rows.length === 0 && { flexGrow: 1 }]}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={11}
          removeClippedSubviews={Platform.OS !== 'web'}
          ListEmptyComponent={(
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhuma nota encontrada.</Text>
            </View>
          )}
        />

        {/* FAB Criar Nota */}
        <TouchableOpacity style={[styles.fab, { bottom: Math.max(24, insets.bottom + 10) }]} activeOpacity={0.8} onPress={handleCreateNote}>
          <Ionicons name="add" size={28} color="#ffffff" />
        </TouchableOpacity>

      </View>

      {/* Custom Bottom Sheet de Filtro */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none" // Desabilitamos a animação nativa para rodar a nossa
        onRequestClose={() => handleCloseFilter()}
      >
        <View style={styles.modalOverlayContainer}>
          <RNAnimated.View style={[styles.modalBackdrop, { opacity: fadeAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => handleCloseFilter()} />
          </RNAnimated.View>

          <RNAnimated.View style={[styles.bottomSheetAnimatedWrapper, { transform: [{ translateY: slideAnim }] }]}>
            <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.bottomSheetHandle} />
              <Text style={styles.bottomSheetTitle}>Filtrar por categoria</Text>

              {filterOptions.map(opt => (
                <TouchableOpacity
                  key={`bs-${opt}`}
                  style={[styles.bsOption, filter === opt && styles.bsOptionActive]}
                  onPress={() => handleCloseFilter(opt)}
                >
                  <Text style={[styles.bsOptionText, filter === opt && styles.bsOptionTextActive]}>
                    {opt === 'todas' ? 'Todas' : getCategoryLabel(opt)}
                  </Text>
                </TouchableOpacity>
              ))}
            </Pressable>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Modal de Exclusão (ALT 02) */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={styles.deleteDialogOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={cancelDelete} />
          <View style={styles.deleteDialog}>
            <Text style={styles.deleteDialogTitle}>Tem certeza que deseja excluir essa nota?</Text>
            <Text style={styles.deleteDialogSubtext}>Essa ação não pode ser desfeita.</Text>
            <View style={styles.deleteDialogActions}>
              <TouchableOpacity style={styles.deleteDialogCancelBtn} onPress={cancelDelete}>
                <Text style={styles.deleteDialogCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteDialogConfirmBtn} onPress={handleConfirmDelete}>
                <Text style={styles.deleteDialogConfirmText}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Logout (RF005) */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.deleteDialogOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setLogoutModalVisible(false)} />
          <View style={styles.logoutDialog}>
            <Text style={styles.deleteDialogTitle}>Encerrar sessão?</Text>
            <Text style={styles.deleteDialogSubtext}>Você precisará da sua idKey para entrar novamente.</Text>
            <View style={styles.deleteDialogActions}>
              <TouchableOpacity style={styles.deleteDialogCancelBtn} onPress={() => setLogoutModalVisible(false)}>
                <Text style={styles.deleteDialogCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutConfirmBtn} onPress={handleConfirmLogout}>
                <Text style={styles.deleteDialogConfirmText}>Sair</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0e1a', // Dark Navy
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2a324a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipsContainer: {
    height: 60,
    marginBottom: 8,
  },
  chipsScroll: {
    alignItems: 'center',
    gap: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2a324a',
    height: 40,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: '#007AFF', // Azul
    borderColor: '#007AFF',
  },
  chipText: {
    color: '#a0a7b5',
    fontWeight: '600',
    fontSize: 14,
  },
  chipTextActive: {
    color: '#ffffff',
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 100, // Espaço maior pro FAB
  },
  flexWrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: '#1a1f2e',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderWidth: 1,
    marginBottom: 16,
    borderTopColor: '#2a324a',
    borderRightColor: '#2a324a',
    borderBottomColor: '#2a324a',
    minHeight: 120,
    position: 'relative',
  },
  cardDeleteButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(10, 14, 26, 0.72)',
    borderWidth: 1,
    borderColor: '#2a324a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardSingle: {
    width: '100%',
    backgroundColor: '#151b2b',
    borderLeftWidth: 0,
  },
  cardDouble: {
    width: '48%',
    justifyContent: 'space-between',
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
  cardCategoryLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 12,
  },
  tasklistContainer: {
    gap: 8,
    marginTop: 4,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskText: {
    color: '#ffffff',
    fontSize: 14,
    flex: 1,
  },
  taskTextChecked: {
    color: '#a0a7b5',
    textDecorationLine: 'line-through',
  },
  fab: {
    position: 'absolute',
    right: 28,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.3)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 64,
  },
  emptyText: {
    color: '#a0a7b5',
    fontSize: 16,
  },
  modalOverlayContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  bottomSheetAnimatedWrapper: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  bottomSheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 300,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#2a324a',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  bottomSheetTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  bsOption: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a324a',
    marginBottom: 8,
  },
  bsOptionActive: {
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  bsOptionText: {
    color: '#ffffff',
    fontSize: 16,
  },
  bsOptionTextActive: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  deleteDialogOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteDialog: {
    backgroundColor: '#1a1015',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#660000',
  },
  deleteDialogTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  deleteDialogSubtext: {
    color: '#a0a7b5',
    fontSize: 14,
    marginBottom: 24,
  },
  deleteDialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  deleteDialogCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  deleteDialogCancelText: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: 'bold',
  },
  deleteDialogConfirmBtn: {
    backgroundColor: '#CC0000',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  deleteDialogConfirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  logoutDialog: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2a324a',
  },
  logoutConfirmBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
});
