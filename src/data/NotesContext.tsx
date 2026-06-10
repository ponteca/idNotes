import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { MOCK_NOTES, Note, DEFAULT_CATEGORIES, DEFAULT_CATEGORY_COLORS, DEFAULT_CATEGORY_LABELS, NEW_CATEGORY_PALETTE } from './mockData';

export interface CategoryInfo {
  id: string;        // chave interna (ex: "financas", "meu-projeto")
  label: string;     // rótulo visual (ex: "Finanças", "Meu Projeto")
  color: string;     // cor do badge
}

// Montar categorias padrão como CategoryInfo
const BUILT_IN: CategoryInfo[] = DEFAULT_CATEGORIES.map(id => ({
  id,
  label: DEFAULT_CATEGORY_LABELS[id] || id,
  color: DEFAULT_CATEGORY_COLORS[id] || '#2a324a'
}));

interface NotesContextProps {
  notes: Note[];
  isCustomOrder: boolean;
  allCategories: CategoryInfo[];
  addNote: (note: Note) => void;
  updateNote: (id: string, updatedNote: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  reorderNotes: (newNotes: Note[]) => void;
  addCategory: (label: string, color?: string) => CategoryInfo;
  deleteCategory: (catId: string) => void;
  getCategoryColor: (catId: string) => string;
  getCategoryLabel: (catId: string) => string;
}

const NotesContext = createContext<NotesContextProps | undefined>(undefined);

export const NotesProvider = ({ children }: { children: ReactNode }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isCustomOrder, setIsCustomOrder] = useState<boolean>(false);
  const [customCategories, setCustomCategories] = useState<CategoryInfo[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedNotes = await AsyncStorage.getItem('@idnotes_notes');
        const storedCats = await AsyncStorage.getItem('@idnotes_cats');
        
        if (storedNotes) {
          const parsedNotes = JSON.parse(storedNotes);
          setNotes(parsedNotes.map((n: any) => ({ ...n, updatedAt: n.updatedAt ? new Date(n.updatedAt) : new Date() })));
        } else {
          setNotes(MOCK_NOTES);
        }
        
        if (storedCats) {
          setCustomCategories(JSON.parse(storedCats));
        }
      } catch (e) {
        console.error('Erro ao carregar dados locais:', e);
        setNotes(MOCK_NOTES);
      } finally {
        setIsReady(true);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isReady) {
      AsyncStorage.setItem('@idnotes_notes', JSON.stringify(notes)).catch(e => console.error(e));
    }
  }, [notes, isReady]);

  useEffect(() => {
    if (isReady) {
      AsyncStorage.setItem('@idnotes_cats', JSON.stringify(customCategories)).catch(e => console.error(e));
    }
  }, [customCategories, isReady]);

  const allCategories = [...BUILT_IN, ...customCategories];

  if (!isReady) return null;

  const getCategoryColor = (catId: string): string => {
    const found = allCategories.find(c => c.id === catId);
    return found?.color || DEFAULT_CATEGORY_COLORS[catId] || '#2a324a';
  };

  const getCategoryLabel = (catId: string): string => {
    const found = allCategories.find(c => c.id === catId);
    return found?.label || DEFAULT_CATEGORY_LABELS[catId] || catId;
  };

  const addCategory = (label: string, color?: string): CategoryInfo => {
    const id = label.trim().toLowerCase().replace(/\s+/g, '-');
    const existing = allCategories.find(c => c.id === id);
    if (existing) return existing;

    const colorIndex = customCategories.length % NEW_CATEGORY_PALETTE.length;
    const newCat: CategoryInfo = { id, label: label.trim(), color: color || NEW_CATEGORY_PALETTE[colorIndex] };
    setCustomCategories(prev => [...prev, newCat]);
    return newCat;
  };

  const deleteCategory = (catId: string) => {
    // Só permite excluir categorias customizadas
    const isBuiltIn = BUILT_IN.some(c => c.id === catId);
    if (isBuiltIn) return;
    
    setCustomCategories(prev => prev.filter(c => c.id !== catId));
    // Migrar notas da categoria excluída para 'sem_categoria'
    setNotes(prev => prev.map(n => n.category === catId ? { ...n, category: 'sem_categoria' } : n));
  };

  const addNote = (note: Note) => {
    setNotes((prevNotes) => {
      const existingIndex = prevNotes.findIndex(existing => existing.id === note.id);
      if (existingIndex >= 0) {
        return prevNotes.map(existing => existing.id === note.id ? note : existing);
      }

      return [note, ...prevNotes];
    });
  };

  const updateNote = (id: string, updatedNote: Partial<Note>) => {
    setNotes((prevNotes) =>
      prevNotes.map((note) => (note.id === id ? { ...note, ...updatedNote, updatedAt: new Date() } : note))
    );
  };

  const deleteNote = (id: string) => {
    setNotes((prevNotes) => prevNotes.filter((note) => note.id !== id));
  };

  const reorderNotes = (newNotes: Note[]) => {
    setNotes(newNotes);
    setIsCustomOrder(true);
  };

  return (
    <NotesContext.Provider value={{
      notes, isCustomOrder, allCategories,
      addNote, updateNote, deleteNote, reorderNotes,
      addCategory, deleteCategory, getCategoryColor, getCategoryLabel
    }}>
      {children}
    </NotesContext.Provider>
  );
};

export const useNotes = () => {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes deve ser usado dentro de um NotesProvider');
  }
  return context;
};
