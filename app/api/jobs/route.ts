// file: api/jobs/route.ts

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { BoardData, Column, Task } from "@/types";
import { baseColumns, START_COLUMN_ID } from "@/lib/baseColumns";

// --- Path Definitions ---
const STORAGE_DIR = path.join(process.cwd(), "public", "storage");
const TASKS_STORAGE_DIR = path.join(STORAGE_DIR, "tasks");
const META_FILE = path.join(STORAGE_DIR, "metadata.json");
// ------------------------

// A helper to get the current board data or initialize it
async function getBoardData(): Promise<BoardData> {
  try {
    const raw = await fs.readFile(META_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (data.tasks && data.columns) return data;
    throw new Error("Invalid metadata format");
  } catch {
    return { tasks: {}, columns: baseColumns };
  }
}

// GET: Returns the entire board data object (no changes)
export async function GET() {
  const boardData = await getBoardData();
  return NextResponse.json(boardData);
}

// POST: Creates a new job with folder support
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    // LOGIC CHANGE: Get all files and their relative paths
    const files = formData.getAll("files") as File[];
    const filePaths = formData.getAll("filePaths") as string[];
    
    const customerName = formData.get("customerName") as string;
    const representative = formData.get("representative") as string;
    const orderDate = formData.get("orderDate") as string;
    const notes = formData.get("notes") as string;

    if (files.length === 0 || !customerName || !representative || !orderDate) {
      return NextResponse.json(
        { error: "Missing required fields or folder" },
        { status: 400 }
      );
    }

    const taskId = Date.now().toString();
    const taskDirectoryPath = path.join(TASKS_STORAGE_DIR, taskId);
    await fs.mkdir(taskDirectoryPath, { recursive: true });

    const savedFilePaths: string[] = [];

    // LOGIC CHANGE: Loop through all files and save them with their directory structure
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = filePaths[i];

      // Sanitize the relative path to prevent directory traversal attacks
      const safeRelativePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
      if (safeRelativePath.includes('..')) continue; // Skip potentially malicious paths
      
      const destinationPath = path.join(taskDirectoryPath, safeRelativePath);
      
      // Ensure the sub-directory exists before writing the file
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });

      const buf = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(destinationPath, buf);
      savedFilePaths.push(safeRelativePath);
    }

    const newTask: Task = {
      id: taskId,
      columnId: START_COLUMN_ID,
      customerName: customerName.trim(),
      representative: representative.trim(),
      orderDate: orderDate.trim(),
      notes: notes.trim(),
      taskFolderPath: `/storage/tasks/${taskId}`,
      // Store the array of relative file paths
      files: savedFilePaths,
    };

    const boardData = await getBoardData();

    boardData.tasks[taskId] = newTask;
    const startCol = boardData.columns.find((c) => c.id === START_COLUMN_ID);
    if (startCol) {
      startCol.taskIds.push(taskId);
    } else {
      boardData.columns[0].taskIds.push(taskId);
    }

    await fs.writeFile(META_FILE, JSON.stringify(boardData, null, 2));

    return NextResponse.json(newTask);
  } catch (err) {
    console.error("Failed to create job:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT: Updates the entire board state (used for drag & drop, no changes)
export async function PUT(req: NextRequest) {
  try {
    const boardData = (await req.json()) as BoardData;
    if (!boardData.tasks || !boardData.columns) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    await fs.writeFile(META_FILE, JSON.stringify(boardData, null, 2));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update board:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}