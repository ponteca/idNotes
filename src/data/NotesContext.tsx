import React, { createContext, useState, useContext, ReactNode } from 'react';
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
  addCategory: (label: string) => CategoryInfo;
  deleteCategory: (catId: string) => void;
  getCategoryColor: (catId: string) => string;
  getCategoryLabel: (catId: string) => string;
}

const NotesContext = createContext<NotesContextProps | undefined>(undefined);

export const NotesProvider = ({ children }: { children: ReactNode }) => {
  const [notes, setNotes] = useState<Note[]>(MOCK_NOTES);
  const [isCustomOrder, setIsCustomOrder] = useState<boolean>(false);
  const [customCategories, setCustomCategories] = useState<CategoryInfo[]>([]);

  const allCategories = [...BUILT_IN, ...customCategories];

  const getCategoryColor = (catId: string): string => {
    const found = allCategories.find(c => c.id === catId);
    return found?.color || DEFAULT_CATEGORY_COLORS[catId] || '#2a324a';
  };

  const getCategoryLabel = (catId: string): string => {
    const found = allCategories.find(c => c.id === catId);
    return found?.label || DEFAULT_CATEGORY_LABELS[catId] || catId;
  };

  const addCategory = (label: string): CategoryInfo => {
    const id = label.trim().toLowerCase().replace(/\s+/g, '-');
    const existing = allCategories.find(c => c.id === id);
    if (existing) return existing;

    const colorIndex = customCategories.length % NEW_CATEGORY_PALETTE.length;
    const newCat: CategoryInfo = { id, label: label.trim(), color: NEW_CATEGORY_PALETTE[colorIndex] };
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
    setNotes((prevNotes) => [note, ...prevNotes]);
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
