// lib/baseColumns.ts

import type { Column } from "@/types";

export const START_COLUMN_ID = "create";

// Updated to use taskIds
export const baseColumns: Column[] = [
  { id: "create",      title: "建单",   taskIds: [] },
  { id: "quote",       title: "报价",   taskIds: [] },
  { id: "send",        title: "发出",   taskIds: [] },
  { id: "archive",     title: "存档",   taskIds: [] },
  { id: "sheet",       title: "制单",   taskIds: [] },
  { id: "approval",    title: "审批",   taskIds: [] },
  { id: "production",  title: "投产",   taskIds: [] }
];