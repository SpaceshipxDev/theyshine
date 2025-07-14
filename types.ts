// types.ts

export interface Task {
  id: string;
  columnId: string; // <-- NEW
  customerName: string;
  representative: string;
  orderDate: string;
  notes: string;
  taskFolderPath: string;
  files: string[];
}

export interface Column {
  id: string;
  title: string;
  taskIds: string[]; // <-- CHANGED from tasks: Task[]
}

// NEW: A type for the entire board data
export interface BoardData {
  tasks: Record<string, Task>;
  columns: Column[];
}