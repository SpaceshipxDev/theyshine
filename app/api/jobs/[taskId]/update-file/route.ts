// src/app/api/jobs/[taskId]/update-file/route.ts

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { BoardData } from "@/types";

const STORAGE_DIR = path.join(process.cwd(), "public", "storage");
const TASKS_STORAGE_DIR = path.join(STORAGE_DIR, "tasks");
const META_FILE = path.join(STORAGE_DIR, "metadata.json");

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;
  if (!taskId) {
    return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const newFile = formData.get("newFile") as File | null;
    const oldFilename = formData.get("oldFilename") as string | null;
    if (!newFile || !oldFilename) {
      return NextResponse.json({ error: "Missing newFile or oldFilename" }, { status: 400 });
    }

    const taskDirectoryPath = path.join(TASKS_STORAGE_DIR, taskId);
    const oldFilePath = path.join(taskDirectoryPath, oldFilename);

    // --- FIX: Use a less restrictive regex that allows Unicode characters ---
    const sanitizedNewFilename = newFile.name.replace(/[\\/:*?"<>|]/g, '_');
    // ----------------------------------------------------------------------
    
    const newFilePath = path.join(taskDirectoryPath, sanitizedNewFilename);

    await fs.mkdir(taskDirectoryPath, { recursive: true });

    // Try to delete the old file
    try {
      await fs.unlink(oldFilePath);
    } catch (e: any) {
      if (e.code !== 'ENOENT') { throw e; }
      console.warn(`File to be updated not found, proceeding to add new file: ${oldFilePath}`);
    }

    // Write the new file
    const buf = Buffer.from(await newFile.arrayBuffer());
    await fs.writeFile(newFilePath, buf);

    // Update metadata
    const rawMeta = await fs.readFile(META_FILE, "utf-8");
    const boardData: BoardData = JSON.parse(rawMeta);
    const taskToUpdate = boardData.tasks[taskId];
    if (!taskToUpdate) {
      return NextResponse.json({ error: "Task not found in metadata" }, { status: 404 });
    }

    // Replace the item in the array to preserve order
    const fileIndex = taskToUpdate.files?.indexOf(oldFilename);
    if (taskToUpdate.files && fileIndex !== undefined && fileIndex > -1) {
      taskToUpdate.files[fileIndex] = sanitizedNewFilename;
    } else {
      // Fallback: if the old file wasn't in the list, add the new one
      taskToUpdate.files = [...(taskToUpdate.files || []), sanitizedNewFilename];
    }

    await fs.writeFile(META_FILE, JSON.stringify(boardData, null, 2));

    return NextResponse.json(taskToUpdate);
  } catch (err) {
    console.error(`Failed to update file for task ${taskId}:`, err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}