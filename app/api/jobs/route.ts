// api/jobs/route.ts

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
    // Basic validation
    if (data.tasks && data.columns) {
      return data;
    }
    throw new Error("Invalid metadata format");
  } catch {
    // If file doesn't exist or is invalid, return a fresh board structure
    return {
      tasks: {},
      columns: baseColumns,
    };
  }
}

// GET: Returns the entire board data object
export async function GET() {
  const boardData = await getBoardData();
  return NextResponse.json(boardData);
}

// POST: Creates a new job
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const customerName = formData.get("customerName") as string;
    const representative = formData.get("representative") as string;
    const orderDate = formData.get("orderDate") as string;
    const notes = formData.get("notes") as string;

    if (!file || !customerName || !representative || !orderDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const taskId = Date.now().toString();
    const taskDirectoryPath = path.join(TASKS_STORAGE_DIR, taskId);
    await fs.mkdir(taskDirectoryPath, { recursive: true });

    const buf = Buffer.from(await file.arrayBuffer());
    const originalFilename = file.name.replace(/[^\w.]/g, "_");
    await fs.writeFile(path.join(taskDirectoryPath, originalFilename), buf);

    const newTask: Task = {
      id: taskId,
      columnId: START_COLUMN_ID, // Assign to the starting column
      customerName: customerName.trim(),
      representative: representative.trim(),
      orderDate: orderDate.trim(),
      notes: notes.trim(),
      taskFolderPath: `/storage/tasks/${taskId}`,
      files: [originalFilename],
    };

    const boardData = await getBoardData();

    // Add the new task to the tasks lookup
    boardData.tasks[taskId] = newTask;

    // Add the new task ID to the start column's taskIds array
    const startCol = boardData.columns.find((c) => c.id === START_COLUMN_ID);
    if (startCol) {
      startCol.taskIds.push(taskId);
    } else {
      // Fallback: add to the first column if start column not found
      boardData.columns[0].taskIds.push(taskId);
    }

    await fs.writeFile(META_FILE, JSON.stringify(boardData, null, 2));

    return NextResponse.json(newTask);
  } catch (err) {
    console.error("Failed to create job:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT: Updates the entire board state (used for drag & drop)
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