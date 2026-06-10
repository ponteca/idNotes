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
  Modal,
  Pressable,
  StatusBar,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Category, DEFAULT_CATEGORIES, NEW_CATEGORY_PALETTE } from '../data/mockData';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useNotes } from '../data/NotesContext';
import { useToast } from '../components/Toast';
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
  formatting?: Formatting;     // legado: formatação do bloco inteiro (fallback)
  spans?: TextSpan[];          // formatação inline por trecho (tem prioridade)
  checked?: boolean; // Para tasklists (RF-021)
  imageUri?: string; // Para imagens
  imageName?: string;
  imageSize?: number; // Em MB
}

// Trecho de texto com formatação própria (formatação inline por seleção).
interface TextSpan {
  text: string;
  formatting: Formatting;
}

// Comparação de formatação (para fundir trechos contíguos iguais).
const sameFmt = (a: Formatting, b: Formatting) =>
  !!a.bold === !!b.bold && !!a.underline === !!b.underline && (a.color || '') === (b.color || '');

// Lista de trechos do bloco; se não houver spans, usa o formatting do bloco.
const getSpans = (block: Block): TextSpan[] => {
  if (block.spans && block.spans.length) return block.spans;
  return [{ text: block.content, formatting: block.formatting || {} }];
};

// Explode o bloco em caracteres com sua formatação (índices em code units,
// alinhados com a seleção do TextInput).
const blockToChars = (block: Block): { ch: string; fmt: Formatting }[] => {
  const arr: { ch: string; fmt: Formatting }[] = [];
  for (const s of getSpans(block)) {
    for (let i = 0; i < s.text.length; i++) arr.push({ ch: s.text[i], fmt: { ...s.formatting } });
  }
  return arr;
};

// Reagrupa caracteres em trechos contíguos com a mesma formatação.
const charsToSpans = (arr: { ch: string; fmt: Formatting }[]): TextSpan[] => {
  const spans: TextSpan[] = [];
  for (const c of arr) {
    const last = spans[spans.length - 1];
    if (last && sameFmt(last.formatting, c.fmt)) last.text += c.ch;
    else spans.push({ text: c.ch, formatting: { ...c.fmt } });
  }
  return spans;
};

// Aplica a edição (texto novo) preservando a formatação dos trechos não tocados.
// Diff por prefixo/sufixo comum; o texto inserido herda a formatação do
// caractere anterior (ou da formatação ativa, se inserido no início).
const reconcileChars = (
  oldArr: { ch: string; fmt: Formatting }[],
  newText: string,
  fallbackFmt: Formatting
): { ch: string; fmt: Formatting }[] => {
  const oldText = oldArr.map(c => c.ch).join('');
  if (oldText === newText) return oldArr;
  let p = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (p < minLen && oldText[p] === newText[p]) p++;
  let s = 0;
  while (
    s < oldText.length - p &&
    s < newText.length - p &&
    oldText[oldText.length - 1 - s] === newText[newText.length - 1 - s]
  ) s++;
  const removed = oldText.length - p - s;
  const inserted = newText.substring(p, newText.length - s);
  const fmt = p > 0 ? oldArr[p - 1].fmt
    : (oldArr[p + removed] ? oldArr[p + removed].fmt : (fallbackFmt || {}));
  const insArr = inserted.split('').map(ch => ({ ch, fmt: { ...fmt } }));
  return [...oldArr.slice(0, p), ...insArr, ...oldArr.slice(p + removed)];
};

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
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  // Id estável da nota: o param da rota OU um rascunho gerado (nota nova).
  // Mantido aqui para que o resolvedData consiga localizar a nota recém-criada.
  const draftIdRef = useRef(id || `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const resolvedData = useMemo(() => {
     if (id === '2') return INITIAL_NOTE_DATA;
     const found = notes.find(n => n.id === (id || draftIdRef.current));
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
     return { title: '', category: 'sem_categoria' as Category, blocks: [{ id: 'empty-start', type: 'text', content: '', formatting: {} } as Block] };
  }, [id, notes]);

  const [title, setTitle] = useState(resolvedData.title);
  const [category, setCategory] = useState<Category>(resolvedData.category);
  const [blocks, setBlocks] = useState<Block[]>(resolvedData.blocks);

  // Sincroniza só quando muda a NOTA (id), não a cada alteração em `notes`.
  // Evita que salvar (que altera `notes`) recarregue/limpe o editor.
  useEffect(() => {
     setTitle(resolvedData.title);
     setCategory(resolvedData.category);
     setBlocks(resolvedData.blocks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Estados da Toolbar
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [activeFormats, setActiveFormats] = useState<Formatting>({});
  const [currentBlockType, setCurrentBlockType] = useState<BlockType>('text');
  // Seleção atual dentro do bloco focado (índices em code units).
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  
  // Color Picker
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [lastColor, setLastColor] = useState<string>('#FFFFFF');
  
  // Seletor de Categoria
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(NEW_CATEGORY_PALETTE[0]);

  const [isTrashPressed, setIsTrashPressed] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [discardModalVisible, setDiscardModalVisible] = useState(false);
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
  const savedRef = useRef(false);            // evita salvar 2x (Salvar/Excluir + saída)
  const initialSnapshotRef = useRef<string>('');

  // Snapshot do estado carregado, para detectar alterações reais.
  useEffect(() => {
    initialSnapshotRef.current = JSON.stringify({
      title: resolvedData.title,
      category: resolvedData.category,
      blocks: resolvedData.blocks,
    });
    savedRef.current = false;
    draftIdRef.current = id || draftIdRef.current;
  }, [id, resolvedData]);

  // Persiste a nota na memória local do dispositivo (via NotesContext ->
  // AsyncStorage). Só grava quando houve mudança e ainda não foi salva.
  const persistNote = () => {
    if (savedRef.current || id === '2') return;
    const snapshot = JSON.stringify({ title, category, blocks });
    if (snapshot === initialSnapshotRef.current) return; // nada mudou

    const textBlocks = blocks.filter(b => b.type === 'text' || b.type === 'h1').map(b => b.content).filter(Boolean);
    const content = textBlocks.join('\n');
    const rawBlocks = JSON.stringify(blocks);
    const tasks = blocks.filter(b => b.type === 'task').map(b => ({ id: b.id, text: b.content, checked: !!b.checked }));
    const payload = {
      title: title || 'Nova nota',
      category,
      content,
      rawBlocks,
      hasTasklist: tasks.length > 0,
      tasklistItems: tasks.length > 0 ? tasks : undefined,
    };

    const targetId = (id && notes.find(n => n.id === id)) ? id
      : (notes.find(n => n.id === draftIdRef.current) ? draftIdRef.current : null);
    if (targetId) {
      updateNote(targetId, payload);
    } else {
      const hasContent = (title && title.trim().length > 0) ||
        blocks.some(b => (b.content && b.content.trim().length > 0) || b.type === 'image');
      if (hasContent) {
        addNote({ id: draftIdRef.current, ...payload, updatedAt: new Date() });
        savedRef.current = true;
      }
    }
  };

  const hasUnsavedChanges = () => {
    if (savedRef.current || id === '2') return false;
    return JSON.stringify({ title, category, blocks }) !== initialSnapshotRef.current;
  };

  // RF-024: salvamento automático na memória local ao sair da tela.
  const persistRef = useRef(persistNote);
  persistRef.current = persistNote;
  useEffect(() => {
    return () => { persistRef.current(); };
  }, []);

  // Manuseio de Categoria
  const handleSelectCategory = (catId: string) => {
    setCategory(catId as Category);
    setCategoryModalVisible(false);
  };

  const handleCreateCategory = () => {
    const label = newCategoryInput.trim();
    if (!label) return;
    const newCat = addCategory(label, newCategoryColor);
    setCategory(newCat.id as Category);
    setNewCategoryInput('');
    setNewCategoryColor(NEW_CATEGORY_PALETTE[0]);
    setCategoryModalVisible(false);
  };

  // Atualiza a seleção e o destaque da toolbar conforme o trecho selecionado.
  const handleSelectionChange = (block: Block, e: any) => {
    const sel = e?.nativeEvent?.selection;
    if (!sel) return;
    setSelection(sel);
    const chars = blockToChars(block);
    const range = sel.start === sel.end
      ? (sel.start > 0 ? chars.slice(sel.start - 1, sel.start) : [])
      : chars.slice(sel.start, sel.end);
    const fmt: Formatting = {};
    if (range.length) {
      fmt.bold = range.every(c => !!c.fmt.bold);
      fmt.underline = range.every(c => !!c.fmt.underline);
      const colors = new Set(range.map(c => c.fmt.color || ''));
      fmt.color = colors.size === 1 ? (range[0].fmt.color || undefined) : undefined;
    }
    setActiveFormats(fmt);
  };

  // Ações de Toolbar — aplicam formatação SOMENTE ao trecho selecionado.
  // Sem seleção (cursor sem texto marcado), aplica ao bloco inteiro (fallback).
  const applyFormatToSelection = (format: keyof Formatting, colorValue?: string) => {
    if (!focusedBlockId) return;
    saveHistory(blocks);
    setBlocks(prev => prev.map(b => {
      if (b.id !== focusedBlockId || b.type === 'image') return b;
      const chars = blockToChars(b);
      let start = Math.max(0, Math.min(selection.start, chars.length));
      let end = Math.max(0, Math.min(selection.end, chars.length));
      if (start > end) [start, end] = [end, start];
      const from = start === end ? 0 : start;
      const to = start === end ? chars.length : end;
      let newChars;
      if (format === 'color') {
        newChars = chars.map((c, i) => (i >= from && i < to) ? { ch: c.ch, fmt: { ...c.fmt, color: colorValue } } : c);
      } else {
        const slice = chars.slice(from, to);
        const allOn = slice.length > 0 && slice.every(c => !!c.fmt[format]);
        newChars = chars.map((c, i) => (i >= from && i < to) ? { ch: c.ch, fmt: { ...c.fmt, [format]: !allOn } } : c);
      }
      return { ...b, content: newChars.map(c => c.ch).join(''), spans: charsToSpans(newChars), formatting: undefined };
    }));
  };

  const handleToggleFormat = (format: keyof Formatting) => {
    applyFormatToSelection(format);
    setActiveFormats(prev => ({ ...prev, [format]: !prev[format] }));
  };

  const handleApplyColor = (color: string) => {
    setLastColor(color);
    setColorPickerVisible(false);
    applyFormatToSelection('color', color);
    setActiveFormats(prev => ({ ...prev, color }));
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
    setBlocks(prev => prev.map(b => {
      if (b.id !== id) return b;
      // Reconcilia mantendo a formatação dos trechos não alterados.
      const chars = reconcileChars(blockToChars(b), newText, activeFormats);
      return { ...b, content: newText, spans: charsToSpans(chars) };
    }));
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
          // RNF009 + RF-023: feedback de erro ao exceder 5 MB
          showToast('Imagem excede o limite de 5 MB', 'error');
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
  const navigateAway = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/05home');
    }
  };

  const handleGoBack = () => {
    if (hasUnsavedChanges()) {
      setDiscardModalVisible(true);
      return;
    }

    navigateAway();
  };

  const handleDiscardChanges = () => {
    savedRef.current = true;
    setDiscardModalVisible(false);
    navigateAway();
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

    const payload = {
      title: title || 'Nova nota',
      category,
      content,
      rawBlocks,
      hasTasklist: tasks.length > 0,
      tasklistItems: tasks.length > 0 ? tasks : undefined,
    };

    // Atualiza se a nota já existe (pelo id da rota OU pelo rascunho criado);
    // caso contrário, cria. Evita duplicar ao salvar a mesma nota nova 2x.
    const existingId = (id && notes.find(n => n.id === id)) ? id
      : (notes.find(n => n.id === draftIdRef.current) ? draftIdRef.current : null);

    if (existingId) {
      updateNote(existingId, payload);
    } else {
      addNote({ id: draftIdRef.current, ...payload, updatedAt: new Date() });
    }

    // Marca o estado atual como "salvo" para o controle de alterações.
    initialSnapshotRef.current = JSON.stringify({ title, category, blocks });

    // RNF009: feedback de salvamento. NÃO fecha a nota — apenas atualiza.
    showToast(existingId ? 'Nota salva' : 'Nota criada', 'success');
  };

  const handleConfirmDelete = () => {
    setDeleteModalVisible(false);
    savedRef.current = true; // não recriar a nota no autosave de saída
    deleteNote(id || draftIdRef.current);
    // RNF009: feedback ao excluir nota
    showToast('Nota excluída', 'info');

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/05home');
    }
  };

  // Old handlers removed to use new prompt

  // Campo editável com formatação inline por trecho (spans).
  // Nativo: usa filhos <Text> por trecho (formatação real por seleção).
  // Web: <textarea> não renderiza inline, então aplica estilo só se uniforme.
  const renderEditableInput = (
    block: Block,
    baseStyle: any[],
    placeholder: string,
    autoCapitalize: 'characters' | 'sentences' = 'sentences',
    forcePlain = false,
  ) => {
    const spans = getSpans(block);
    const plain = spans.map(s => s.text).join('');
    const common = {
      autoFocus: newBlockId === block.id,
      multiline: true as const,
      scrollEnabled: false,
      onChangeText: (t: string) => handleBlockChangeText(block.id, t),
      onSelectionChange: (e: any) => handleSelectionChange(block, e),
      onFocus: () => {
        saveHistory(blocks);
        setFocusedBlockId(block.id);
        setCurrentBlockType(block.type === 'task' ? 'task' : block.type);
      },
      placeholder,
      placeholderTextColor: '#8e95a5',
      autoCapitalize,
      onKeyPress: ({ nativeEvent }: any) => {
        if (nativeEvent.key === 'Backspace' && block.content === '') handleDeleteBlockImmediate(block.id);
      },
    };

    if (forcePlain || Platform.OS === 'web') {
      const uniform = spans.length <= 1;
      const f = spans[0]?.formatting || {};
      return (
        <TextInput
          {...common}
          value={plain}
          style={[
            ...baseStyle,
            !forcePlain && uniform && f.bold && styles.textBold,
            !forcePlain && uniform && f.underline && styles.textUnderline,
            !forcePlain && uniform && f.color ? { color: f.color } : null,
            Platform.OS === 'web' ? ({ outlineStyle: 'none', fieldSizing: 'content' } as any) : {},
          ]}
        />
      );
    }

    return (
      <TextInput {...common} style={baseStyle}>
        {plain.length > 0
          ? spans.map((s, i) => (
              <Text
                key={i}
                style={[
                  s.formatting.bold && styles.textBold,
                  s.formatting.underline && styles.textUnderline,
                  s.formatting.color ? { color: s.formatting.color } : null,
                ]}
              >
                {s.text}
              </Text>
            ))
          : null}
      </TextInput>
    );
  };

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
            {renderEditableInput(
              block,
              [
                styles.textInput,
                styles.taskText,
                block.checked && styles.taskTextChecked,
              ],
              focusedBlockId === block.id ? 'Item da lista' : '',
              'sentences',
              !!block.checked, // tarefa concluída: texto riscado, sem inline
            )}
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
        {renderEditableInput(
          block,
          [
            styles.textInput,
            block.type === 'h1' && styles.textH1,
            { flex: 1 },
          ],
          focusedBlockId === block.id ? (block.type === 'h1' ? 'TÍTULO' : 'Digite algo...') : '',
          block.type === 'h1' ? 'characters' : 'sentences',
        )}
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

      <Modal
        visible={discardModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDiscardModalVisible(false)}
      >
        <View style={styles.modalOverlayContainer}>
          <Pressable style={styles.modalBackdrop} onPress={() => setDiscardModalVisible(false)} />
          <View style={styles.discardDialog}>
            <Text style={styles.deleteDialogTitle}>Tem certeza que deseja descartar as alterações?</Text>
            <Text style={styles.deleteDialogSubtext}>As mudanças feitas desde o último salvamento serão perdidas.</Text>
            <View style={styles.deleteDialogActions}>
              <TouchableOpacity style={styles.deleteDialogCancelBtn} onPress={() => setDiscardModalVisible(false)}>
                <Text style={styles.deleteDialogCancelText}>Continuar editando</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.discardDialogConfirmBtn} onPress={handleDiscardChanges}>
                <Text style={styles.deleteDialogConfirmText}>Descartar</Text>
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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.catModalOverlay}>
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
            <View style={styles.categoryColorSection}>
              <Text style={styles.categoryColorTitle}>Cor da nova categoria</Text>
              <View style={styles.categoryColorGrid}>
                {NEW_CATEGORY_PALETTE.map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.categoryColorOption,
                      { backgroundColor: color },
                      newCategoryColor === color && styles.categoryColorOptionActive,
                    ]}
                    onPress={() => setNewCategoryColor(color)}
                    accessibilityLabel={`Selecionar cor ${color}`}
                  >
                    {newCategoryColor === color && (
                      <Ionicons name="checkmark" size={16} color={color === '#FFFFFF' ? '#111827' : '#ffffff'} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

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
        </KeyboardAvoidingView>
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
  discardDialog: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2a324a',
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
  discardDialogConfirmBtn: {
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
  categoryColorSection: {
    borderTopWidth: 1,
    borderTopColor: '#2a324a',
    paddingTop: 16,
    marginTop: 12,
  },
  categoryColorTitle: {
    color: '#a0a7b5',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  categoryColorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryColorOption: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryColorOptionActive: {
    borderColor: '#ffffff',
    transform: [{ scale: 1.08 }],
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
