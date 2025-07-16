import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { BoardData } from "@/types";

// --- Path Definitions ---
const STORAGE_DIR = path.join(process.cwd(), "public", "storage");
const TASKS_STORAGE_DIR = path.join(STORAGE_DIR, "tasks");
const META_FILE = path.join(STORAGE_DIR, "metadata.json");
// ------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;
  if (!taskId) {
    return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { filename } = body;

    if (!filename) {
      return NextResponse.json({ error: "Filename is required" }, { status: 400 });
    }

    const taskDirectoryPath = path.join(TASKS_STORAGE_DIR, taskId);
    const filePath = path.join(taskDirectoryPath, filename);

    // 1. Delete the file from the filesystem
    try {
      await fs.unlink(filePath);
    } catch (e: any) {
      if (e.code !== 'ENOENT') { // If error is not "File Not Found", re-throw
        throw e;
      }
      // If file is not found, we can proceed as the goal is to remove it from metadata
      console.warn(`File to be deleted not found on disk, proceeding to update metadata: ${filePath}`);
    }

    // 2. Read metadata
    const rawMeta = await fs.readFile(META_FILE, "utf-8");
    const boardData: BoardData = JSON.parse(rawMeta);

    const taskToUpdate = boardData.tasks[taskId];
    if (!taskToUpdate) {
      return NextResponse.json({ error: "Task not found in metadata" }, { status: 404 });
    }

    // 3. IMPORTANT: Update metadata by filtering the existing array to preserve order
    if (taskToUpdate.files) {
      taskToUpdate.files = taskToUpdate.files.filter(f => f !== filename);
    }

    // 4. Write the updated metadata back
    await fs.writeFile(META_FILE, JSON.stringify(boardData, null, 2));

    // 5. Return the fully updated task object to the client
    return NextResponse.json(taskToUpdate);

  } catch (err) {
    console.error(`Failed to delete file for task ${taskId}:`, err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}