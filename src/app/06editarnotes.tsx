import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
  Pressable,
  StatusBar,
  Keyboard,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Category, DEFAULT_CATEGORIES } from '../data/mockData';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useNotes } from '../data/NotesContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Cores da Fonte (ALT 03)
const TEXT_COLORS = [
  '#FFFFFF', // Branco
  '#8E8E93', // Cinza
  '#007AFF', // Azul
  '#34C759', // Verde
  '#FF9500', // Laranja
  '#CC0000', // Vermelho
  '#FFD60A', // Amarelo
  '#AF52DE'  // Roxo
];

type BlockType = 'text' | 'h1' | 'task' | 'image';

interface Formatting {
  bold?: boolean;
  underline?: boolean;
  color?: string;
}

interface Block {
  id: string;
  type: BlockType;
  content: string;
  formatting?: Formatting;
  checked?: boolean; // Para tasklists (RF-021)
  imageUri?: string; // Para imagens
  imageName?: string;
  imageSize?: number; // Em MB
}

// Nota inicial mockada (poderia vir de props/params)
const INITIAL_NOTE_DATA = {
  title: 'Reunião segunda-feira',
  category: 'sem_categoria' as Category,
  blocks: [
    { id: '1', type: 'h1', content: 'PAUTA', formatting: { bold: true } },
    { id: '2', type: 'task', content: 'Apresentar OKRs do Q2', checked: true },
    { id: '3', type: 'task', content: 'Demo do novo fluxo de onboarding', checked: true },
    { id: '4', type: 'task', content: 'Coletar feedback do time de design', checked: false },
    { id: '5', type: 'task', content: 'Definir próximos sprints', checked: false },
    { id: '6', type: 'text', content: '', formatting: {} },
    { id: '7', type: 'h1', content: 'OBSERVAÇÕES', formatting: { bold: true } },
    { id: '8', type: 'text', content: 'Levar o laptop com a apresentação já aberta.', formatting: {} },
    { id: '9', type: 'text', content: 'Confirmar sala com a Ana antes das 9h.', formatting: { bold: true, underline: true } },
    { id: '10', type: 'image', content: '', imageUri: 'sala_reuniao.jpg', imageName: 'sala_reuniao.jpg', imageSize: 2.1 }
  ] as Block[]
};

export default function EditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { notes, allCategories, addNote, updateNote, deleteNote, getCategoryColor, getCategoryLabel, addCategory, deleteCategory } = useNotes();
  const insets = useSafeAreaInsets();

  const resolvedData = useMemo(() => {
     if (id === '2') return INITIAL_NOTE_DATA;
     if (id) {
       const found = notes.find(n => n.id === id);
       if (found) {
         if (found.rawBlocks) {
            try {
                const parsed: Block[] = JSON.parse(found.rawBlocks);
                if (Array.isArray(parsed) && parsed.length > 0) {
                   return { title: found.title, category: found.category, blocks: parsed };
                }
            } catch (e) { console.error("Error parsing rawBlocks", e); }
         }
         // Fallback Plain Text Parsing
         let parsedBlocks: Block[] = found.content.split('\n').filter(Boolean).map((line, idx) => ({
             id: `text-${idx}`, type: 'text', content: line, formatting: {}
         }));
         if (found.hasTasklist && found.tasklistItems) {
             found.tasklistItems.forEach(t => {
                parsedBlocks.push({ id: `task-${t.id}`, type: 'task', content: t.text, checked: t.checked });
             });
         }
         if (parsedBlocks.length === 0) {
             parsedBlocks.push({ id: 'empty', type: 'text', content: '', formatting: {} });
         }
         return { title: found.title, category: found.category, blocks: parsedBlocks };
       }
     }
     return { title: '', category: 'sem_categoria' as Category, blocks: [{ id: 'empty-start', type: 'text', content: '', formatting: {} } as Block] };
  }, [id, notes]);

  const [title, setTitle] = useState(resolvedData.title);
  const [category, setCategory] = useState<Category>(resolvedData.category);
  const [blocks, setBlocks] = useState<Block[]>(resolvedData.blocks);

  useEffect(() => {
     setTitle(resolvedData.title);
     setCategory(resolvedData.category);
     setBlocks(resolvedData.blocks);
  }, [resolvedData]);

  // Estados da Toolbar
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [activeFormats, setActiveFormats] = useState<Formatting>({});
  const [currentBlockType, setCurrentBlockType] = useState<BlockType>('text');
  
  // Color Picker
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [lastColor, setLastColor] = useState<string>('#FFFFFF');
  
  // Seletor de Categoria
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const [isTrashPressed, setIsTrashPressed] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [newBlockId, setNewBlockId] = useState<string | null>(null);

  // Undo/Redo History
  const [pastBlocks, setPastBlocks] = useState<Block[][]>([]);
  const [futureBlocks, setFutureBlocks] = useState<Block[][]>([]);

  const saveHistory = (currentBlocks: Block[]) => {
    setPastBlocks(prev => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (JSON.stringify(last) === JSON.stringify(currentBlocks)) return prev;
      }
      return [...prev, JSON.parse(JSON.stringify(currentBlocks))];
    });
    setFutureBlocks([]);
  };

  const undo = () => {
    if (pastBlocks.length === 0) return;
    const previous = pastBlocks[pastBlocks.length - 1];
    setPastBlocks(prev => prev.slice(0, prev.length - 1));
    setFutureBlocks(prev => [JSON.parse(JSON.stringify(blocks)), ...prev]);
    setBlocks(previous);
  };

  const redo = () => {
    if (futureBlocks.length === 0) return;
    const next = futureBlocks[0];
    setFutureBlocks(prev => prev.slice(1));
    setPastBlocks(prev => [...prev, JSON.parse(JSON.stringify(blocks))]);
    setBlocks(next);
  };

  // References
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Salvamento Automático (RF-024)
  useEffect(() => {
    // Ao desmontar (ou sair da tela), executa o save.
    return () => {
      console.log("Salvamento automático realizado (RF-024).");
      // Aqui integraria a chamada de API ou estado global.
    };
  }, []);

  const triggerAutoSave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
       console.log("Mock: Nota Auto-Salva");
    }, 1000);
  };

  useEffect(() => {
    triggerAutoSave();
  }, [title, blocks, category]);

  // Manuseio de Categoria
  const handleSelectCategory = (catId: string) => {
    setCategory(catId as Category);
    setCategoryModalVisible(false);
  };

  const handleCreateCategory = () => {
    const label = newCategoryInput.trim();
    if (!label) return;
    const newCat = addCategory(label);
    setCategory(newCat.id as Category);
    setNewCategoryInput('');
    setCategoryModalVisible(false);
  };

  // Ações de Toolbar
  const handleToggleFormat = (format: keyof Formatting) => {
    saveHistory(blocks);
    setActiveFormats(prev => ({ ...prev, [format]: !prev[format] }));
    
    if (focusedBlockId) {
      setBlocks(prev => prev.map(b => {
        if (b.id === focusedBlockId && b.type !== 'image') {
          return { ...b, formatting: { ...b.formatting, [format]: !b.formatting?.[format] } };
        }
        return b;
      }));
    }
  };

  const handleApplyColor = (color: string) => {
    saveHistory(blocks);
    setLastColor(color);
    setColorPickerVisible(false);
    setActiveFormats(prev => ({ ...prev, color }));
    
    if (focusedBlockId) {
      setBlocks(prev => prev.map(b => {
        if (b.id === focusedBlockId && b.type !== 'image') {
          return { ...b, formatting: { ...b.formatting, color } };
        }
        return b;
      }));
    }
  };

  const handleToggleBlockType = (type: BlockType) => {
    saveHistory(blocks);
    setCurrentBlockType(type);
    
    if (focusedBlockId) {
      setBlocks(prev => prev.map(b => {
        if (b.id === focusedBlockId && b.type !== 'image') {
          // Reset formatting as an H1 is visually distinct
          return { ...b, type, checked: type === 'task' ? false : undefined };
        }
        return b;
      }));
    }
  };

  const handleBlockChangeText = (id: string, newText: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content: newText } : b));
  };

  const handleToggleTaskCheck = (id: string) => {
    saveHistory(blocks);
    setBlocks(prev => prev.map(b => b.id === id && b.type === 'task' ? { ...b, checked: !b.checked } : b));
  };

  const handleDeleteBlockImmediate = (id: string) => {
    saveHistory(blocks);
    setBlocks(prev => {
      const filtered = prev.filter(b => b.id !== id);
      if (filtered.length === 0) {
        return [{ id: 'empty-' + Date.now(), type: 'text', content: '', formatting: {} }];
      }
      return filtered;
    });
    setFocusedBlockId(null);
  };

  const handleAddImage = async () => {
    saveHistory(blocks);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        // Verifica tamanho se disponível (RF-023) - 5MB limite
        const sizeInMb = asset.fileSize ? asset.fileSize / (1024 * 1024) : 0;
        if (sizeInMb > 5) {
          Alert.alert("Erro", "Imagem excede o limite de 5 MB (RF-023)");
          return;
        }

        const uri = asset.uri;
        let fileName = asset.fileName;
        if (!fileName && uri) {
           fileName = uri.split('/').pop() || 'imagem_anexada.jpg';
        }

        const newImage: Block = {
          id: Date.now().toString(),
          type: 'image',
          content: '',
          imageUri: uri,
          imageName: fileName || 'imagem.jpg',
          imageSize: sizeInMb || 0.5 // placeholder visual pro tamanho
        };
        setBlocks([...blocks, newImage]);
      }
    } catch (e) {
      console.log("Erro ao abrir seletor de imagens:", e);
    }
  };

  // Header Actions
  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/05home');
    }
  };

  const handleSaveAction = () => {
    const textBlocks = blocks.filter(b => b.type === 'text' || b.type === 'h1').map(b => b.content).filter(Boolean);
    const content = textBlocks.join('\n');
    const rawBlocks = JSON.stringify(blocks);
    
    const tasks = blocks.filter(b => b.type === 'task').map(b => ({
      id: b.id,
      text: b.content,
      checked: !!b.checked
    }));

    if (id && notes.find(n => n.id === id)) {
      updateNote(id, {
        title: title || 'Nova nota',
        category,
        content,
        rawBlocks,

        hasTasklist: tasks.length > 0,
        tasklistItems: tasks.length > 0 ? tasks : undefined
      });
    } else {
      addNote({
        id: Date.now().toString(),
        title: title || 'Nova nota',
        category,
        content,
        rawBlocks,

        hasTasklist: tasks.length > 0,
        tasklistItems: tasks.length > 0 ? tasks : undefined,
        updatedAt: new Date()
      });
    }

    // Mensagem de sucesso removida para não bloquear a interface
    
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/05home');
    }
  };

  const handleConfirmDelete = () => {
    setDeleteModalVisible(false);
    if (id) deleteNote(id);
    // Mensagem de exclusão removida
    
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/05home');
    }
  };

  // Old handlers removed to use new prompt


  // Rendering
  const renderBlock = (block: Block, index: number) => {
    if (block.type === 'image') {
      return (
        <View key={block.id} style={styles.imageViewerContainer}>
          {block.imageUri ? (
            <Image source={{ uri: block.imageUri }} style={styles.imagePreview} resizeMode="cover" />
          ) : (
            <View style={styles.imagePreviewPlaceholder}>
              <Ionicons name="image-outline" size={32} color="#a0a7b5" />
            </View>
          )}
          <View style={styles.imageOverlay}>
            <Text style={styles.imageOverlayName} numberOfLines={1}>{block.imageName}</Text>
          </View>
          <TouchableOpacity style={styles.deleteImageAbsIcon} onPress={() => handleDeleteBlockImmediate(block.id)} accessibilityLabel="Excluir imagem">
            <View style={styles.deleteIconBg}>
              <Ionicons name="close" size={16} color="#ffffff" />
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    if (block.type === 'task') {
      return (
        <View key={block.id} style={styles.textBlockRow}>
          <View style={styles.taskBlockRow}>
            <TouchableOpacity 
              style={styles.checkbox} 
              onPress={() => handleToggleTaskCheck(block.id)}
              activeOpacity={0.7}
            >
              {block.checked ? (
                <View style={styles.checkboxChecked}>
                  <Ionicons name="checkmark" size={14} color="#ffffff" />
                </View>
              ) : (
                <View style={styles.checkboxUnchecked} />
              )}
            </TouchableOpacity>
            <TextInput
              style={[
                styles.textInput,
                styles.taskText,
                block.checked && styles.taskTextChecked,
                block.formatting?.bold && styles.textBold,
                block.formatting?.underline && (!block.checked) && styles.textUnderline,
                { color: block.formatting?.color || '#d1d5db' },
                Platform.OS === 'web' ? { outlineStyle: 'none', fieldSizing: 'content' } as any : {},
              ]}
              autoFocus={newBlockId === block.id}
              value={block.content}
              onChangeText={(t) => handleBlockChangeText(block.id, t)}
              multiline
              scrollEnabled={false}
              onFocus={() => {
                saveHistory(blocks);
                setFocusedBlockId(block.id);
                setCurrentBlockType('task');
                setActiveFormats(block.formatting || {});
              }}
              placeholder={focusedBlockId === block.id ? "Item da lista" : ""}
              placeholderTextColor="#8e95a5"
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace' && block.content === '') {
                  handleDeleteBlockImmediate(block.id);
                }
              }}
            />
          </View>
          {focusedBlockId === block.id && (
            <TouchableOpacity style={styles.deleteBlockIconText} onPress={() => handleDeleteBlockImmediate(block.id)}>
              <Ionicons name="trash-outline" size={16} color="#4b5563" />
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // Default 'text' or 'h1'
    return (
      <View key={block.id} style={styles.textBlockRow}>
        <TextInput
          style={[
            styles.textInput,
            block.type === 'h1' && styles.textH1,
            block.formatting?.bold && styles.textBold,
            block.formatting?.underline && styles.textUnderline,
            { color: block.formatting?.color || '#d1d5db' },
            { flex: 1 },
            Platform.OS === 'web' ? { outlineStyle: 'none', fieldSizing: 'content' } as any : {},
          ]}
          autoFocus={newBlockId === block.id}
          value={block.content}
          onChangeText={(t) => handleBlockChangeText(block.id, t)}
          multiline
          scrollEnabled={false}
          onFocus={() => {
             saveHistory(blocks);
             setFocusedBlockId(block.id);
             setCurrentBlockType(block.type);
             setActiveFormats(block.formatting || {});
          }}
          placeholder={focusedBlockId === block.id ? (block.type === 'h1' ? 'TÍTULO' : 'Digite algo...') : ''}
          placeholderTextColor="#8e95a5"
          autoCapitalize={block.type === 'h1' ? 'characters' : 'sentences'}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === 'Backspace' && block.content === '') {
              handleDeleteBlockImmediate(block.id);
            }
          }}
        />
          {focusedBlockId === block.id && (
            <TouchableOpacity style={[styles.deleteBlockIconText, block.type === 'h1' && { marginTop: 16 }]} onPress={() => handleDeleteBlockImmediate(block.id)}>
              <Ionicons name="trash-outline" size={14} color="#4b5563" />
            </TouchableOpacity>
          )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Camada global de dismiss do Panel de Color (ALT 03) */}
        {colorPickerVisible && (
          <Pressable style={[StyleSheet.absoluteFill, { zIndex: 9 }]} onPress={() => setColorPickerVisible(false)} />
        )}
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={handleGoBack} accessibilityLabel="Voltar">
            <Ionicons name="chevron-back" size={28} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => setCategoryModalVisible(true)}>
              <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(category) }]}>
                <Text style={styles.categoryBadgeText}>
                  {getCategoryLabel(category)}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAction} accessibilityLabel="Salvar">
              <Text style={styles.saveBtnText}>Salvar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={() => setDeleteModalVisible(true)}
              onPressIn={() => setIsTrashPressed(true)}
              onPressOut={() => setIsTrashPressed(false)}
              accessibilityLabel="Excluir"
            >
              <Ionicons name="trash-outline" size={24} color={isTrashPressed ? "#ef4444" : "#a0a7b5"} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Area */}
        <ScrollView style={styles.contentScroll} contentContainerStyle={[styles.contentScrollContainer, { flexGrow: 1 }]}>
          {/* Título Principal */}
          <TextInput
            style={[styles.mainTitleInput, Platform.OS === 'web' ? { outlineStyle: 'none', fieldSizing: 'content' } as any : {}]}
            value={title}
            onChangeText={setTitle}
            placeholder="Título da Nota"
            placeholderTextColor="#8e95a5"
            multiline
            scrollEnabled={false}
            onFocus={() => setFocusedBlockId(null)}
          />

          {/* Renderização de blocos */}
          <View style={styles.blocksContainer}>
             {blocks.map((block, index) => renderBlock(block, index))}
          </View>

          {/* Invisible area to capture taps at the bottom of the document */}
          <Pressable 
            style={{ flex: 1, minHeight: 200 }} 
            onPress={() => {
              saveHistory(blocks);
              const lastBlock = blocks[blocks.length - 1];
              // Only create a new empty block if the last one isn't already an empty text block
              if (!lastBlock || lastBlock.type !== 'text' || lastBlock.content.trim() !== '') {
                const newId = 'text-' + Date.now();
                setBlocks([...blocks, { id: newId, type: 'text', content: '', formatting: {} }]);
                setNewBlockId(newId);
                setFocusedBlockId(newId);
                setCurrentBlockType('text');
                setActiveFormats({});
              } else {
                // Focus the existing empty block
                setNewBlockId(lastBlock.id);
                setFocusedBlockId(lastBlock.id);
              }
            }}
          />
        </ScrollView>

        {/* Seletor de Cores Inline (ALT 03) */}
        {colorPickerVisible && (
           <View style={[styles.colorPickerPanel, { zIndex: 10 }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorPickerScroll}>
                 {TEXT_COLORS.map(c => (
                     <TouchableOpacity 
                        key={c} 
                        style={[styles.colorCircle, { backgroundColor: c }, (activeFormats.color || lastColor) === c && styles.colorCircleActive]} 
                        onPress={() => handleApplyColor(c)} 
                     />
                 ))}
              </ScrollView>
           </View>
        )}

        {/* Toolbar de Formatação */}
        <View style={[styles.toolbarWrapper, { zIndex: 11, paddingBottom: Math.max(insets.bottom, 0) }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbar}>
              <TouchableOpacity 
                style={[styles.toolbarBtn, currentBlockType === 'h1' && styles.toolbarBtnActive]}
                onPress={() => handleToggleBlockType(currentBlockType === 'h1' ? 'text' : 'h1')}
                accessibilityLabel="Formatar como H1"
              >
                <Text style={[styles.toolbarIconText, currentBlockType === 'h1' && styles.toolbarIconTextActive]}>H1</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.toolbarBtn, activeFormats.bold && styles.toolbarBtnActive]}
                onPress={() => handleToggleFormat('bold')}
                accessibilityLabel="Negrito"
              >
                <Text style={[styles.toolbarIconText, styles.textBold, activeFormats.bold && styles.toolbarIconTextActive]}>B</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.toolbarBtn, activeFormats.underline && styles.toolbarBtnActive]}
                onPress={() => handleToggleFormat('underline')}
                accessibilityLabel="Sublinhado"
              >
                <Text style={[styles.toolbarIconText, styles.textUnderline, activeFormats.underline && styles.toolbarIconTextActive]}>U</Text>
              </TouchableOpacity>

              {/* Color Picker Toggle (ALT 03) */}
              <TouchableOpacity 
                style={styles.toolbarBtn}
                onPress={() => setColorPickerVisible(!colorPickerVisible)}
                accessibilityLabel="Escolher cor"
              >
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                   <Text style={[styles.toolbarIconText, { fontWeight: 'bold', fontSize: 16, marginBottom: 2 }, colorPickerVisible && styles.toolbarIconTextActive]}>A</Text>
                   <View style={{ width: 14, height: 4, backgroundColor: activeFormats.color || lastColor, borderRadius: 2 }} />
                </View>
              </TouchableOpacity>

              <View style={styles.toolbarDivider} />

              <TouchableOpacity 
                style={[styles.toolbarBtn, currentBlockType === 'task' && styles.toolbarBtnActive]}
                onPress={() => handleToggleBlockType(currentBlockType === 'task' ? 'text' : 'task')}
                accessibilityLabel="Lista de tarefas"
              >
                 <Ionicons name="checkbox-outline" size={24} color={currentBlockType === 'task' ? '#ffffff' : '#a0a7b5'} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.toolbarBtn}
                onPress={handleAddImage}
                accessibilityLabel="Adicionar Imagem"
              >
                 <Ionicons name="image-outline" size={24} color="#a0a7b5" />
              </TouchableOpacity>

              <View style={styles.toolbarDivider} />

              <TouchableOpacity 
                style={[styles.toolbarBtn, pastBlocks.length === 0 && { opacity: 0.3 }]}
                onPress={undo}
                disabled={pastBlocks.length === 0}
                accessibilityLabel="Ação anterior"
              >
                 <Ionicons name="arrow-undo-outline" size={24} color="#a0a7b5" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.toolbarBtn, futureBlocks.length === 0 && { opacity: 0.3 }]}
                onPress={redo}
                disabled={futureBlocks.length === 0}
                accessibilityLabel="Ação posterior"
              >
                 <Ionicons name="arrow-redo-outline" size={24} color="#a0a7b5" />
              </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlayContainer}>
          <Pressable style={styles.modalBackdrop} onPress={() => setDeleteModalVisible(false)} />
          <View style={styles.deleteDialog}>
            <Text style={styles.deleteDialogTitle}>Tem certeza que deseja excluir essa nota?</Text>
            <Text style={styles.deleteDialogSubtext}>Essa ação não pode ser desfeita.</Text>
            <View style={styles.deleteDialogActions}>
              <TouchableOpacity style={styles.deleteDialogCancelBtn} onPress={() => setDeleteModalVisible(false)}>
                <Text style={styles.deleteDialogCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteDialogConfirmBtn} onPress={handleConfirmDelete}>
                <Text style={styles.deleteDialogConfirmText}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Picker Bottom Sheet */}
      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={styles.catModalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setCategoryModalVisible(false)} />
          <View style={styles.catBottomSheet}>
            <View style={styles.catHeader}>
              <Text style={styles.catTitle}>Categoria</Text>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                <Ionicons name="close" size={24} color="#a0a7b5" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 250 }}>
              {/* Sem categoria */}
              <TouchableOpacity
                style={[styles.catOption, category === 'sem_categoria' && styles.catOptionActive]}
                onPress={() => handleSelectCategory('sem_categoria')}
              >
                <View style={[styles.catDot, { backgroundColor: '#2a324a' }]} />
                <Text style={[styles.catOptionText, category === 'sem_categoria' && styles.catOptionTextActive]}>Sem categoria</Text>
              </TouchableOpacity>

              {allCategories.map(cat => {
                const isCustom = !DEFAULT_CATEGORIES.includes(cat.id);
                return (
                  <View key={cat.id} style={[styles.catOption, category === cat.id && styles.catOptionActive, { justifyContent: 'space-between' }]}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                      onPress={() => handleSelectCategory(cat.id)}
                    >
                      <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                      <Text style={[styles.catOptionText, category === cat.id && styles.catOptionTextActive]}>{cat.label}</Text>
                    </TouchableOpacity>
                    {isCustom && (
                      <TouchableOpacity
                        onPress={() => {
                          deleteCategory(cat.id);
                          if (category === cat.id) setCategory('sem_categoria' as Category);
                        }}
                        style={{ padding: 6 }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {/* Criar nova */}
            <View style={styles.catInputRow}>
              <TextInput
                style={[styles.catInput, Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}]}
                value={newCategoryInput}
                onChangeText={setNewCategoryInput}
                placeholder="Nova categoria..."
                placeholderTextColor="#8e95a5"
                onSubmitEditing={handleCreateCategory}
                maxLength={20}
              />
              <TouchableOpacity style={styles.catAddBtn} onPress={handleCreateCategory}>
                <Ionicons name="add" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(42, 50, 74, 0.5)',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  saveBtnText: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  categoryBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  categoryBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  iconButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentScroll: {
    flex: 1,
  },
  contentScrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
  mainTitleInput: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 24,
  },
  blocksContainer: {
    gap: 12, // Espaço entre parágrafos
  },
  textInput: {
    fontSize: 16,
    color: '#d1d5db', // cinza claro
    lineHeight: 24,
  },
  textH1: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9500', // Âmbar/Laranja M3
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 4,
  },
  textBold: {
    fontWeight: 'bold',
  },
  textUnderline: {
    textDecorationLine: 'underline',
  },
  taskBlockRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 4,
  },
  checkbox: {
    marginTop: 2,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    width: 20,
    height: 20,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxUnchecked: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#4b5563', // gray-600
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  textBlockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  deleteBlockIcon: {
    padding: 4,
    marginLeft: 8,
  },
  deleteBlockIconText: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    padding: 4,
  },
  taskText: {
    flex: 1,
    color: '#d1d5db',
  },
  taskTextChecked: {
    color: '#6b7280', // opacidade reduzida / cinza médio
    textDecorationLine: 'line-through',
  },
  imageViewerContainer: {
    borderRadius: 12,
    marginVertical: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#151b2b',
    borderWidth: 1,
    borderColor: '#2a324a',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#151b2b',
  },
  imagePreviewPlaceholder: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  imageOverlayName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteImageAbsIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    padding: 4,
  },
  deleteIconBg: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolbarWrapper: {
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#2a324a',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    justifyContent: 'center',
    minWidth: '100%',
  },
  toolbarBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 4,
  },
  toolbarBtnActive: {
    backgroundColor: '#007AFF',
  },
  toolbarIconText: {
    color: '#a0a7b5',
    fontSize: 16,
    fontWeight: '600',
  },
  toolbarIconTextActive: {
    color: '#ffffff',
  },
  toolbarDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#2a324a',
    marginHorizontal: 8,
  },
  modalOverlayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
  colorPickerPanel: {
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#2a324a',
    paddingVertical: 12,
  },
  colorPickerScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCircleActive: {
    borderColor: '#ffffff',
    transform: [{ scale: 1.1 }]
  },
  catModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  catBottomSheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  catTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  catOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 6,
  },
  catOptionActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  catDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  catOptionText: {
    color: '#d1d5db',
    fontSize: 15,
  },
  catOptionTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  catInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a324a',
    paddingTop: 16,
  },
  catInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#374151',
  },
  catAddBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
});
