export type Category = string;
export type FilterCategory = string;

// Categorias padrão do sistema (vazio — usuário cria as suas)
export const DEFAULT_CATEGORIES: Category[] = [];

export const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  sem_categoria: '#2a324a'
};

export const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  todas: 'Todas',
  sem_categoria: 'Sem categoria'
};

// Paleta de cores para categorias novas
export const NEW_CATEGORY_PALETTE = [
  '#5856D6',
  '#007AFF',
  '#0A84FF',
  '#64D2FF',
  '#00C7BE',
  '#30D158',
  '#A3E635',
  '#FFD60A',
  '#FF9F0A',
  '#FF6B35',
  '#FF453A',
  '#FF2D55',
  '#BF5AF2',
  '#AF52DE',
  '#8E8E93',
  '#FFFFFF',
];

export interface TaskItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  category: Category;
  hasTasklist: boolean;
  tasklistItems?: TaskItem[];
  rawBlocks?: string; // Formatos avançados de bloco e cores (JSON)
  updatedAt: Date;
}

export const MOCK_NOTES: Note[] = [];
