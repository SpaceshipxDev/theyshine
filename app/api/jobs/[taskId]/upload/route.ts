// src/app/api/jobs/[taskId]/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { BoardData, Task } from "@/types";

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
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const taskDirectoryPath = path.join(TASKS_STORAGE_DIR, taskId);
    await fs.mkdir(taskDirectoryPath, { recursive: true });

    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      const filePath = path.join(taskDirectoryPath, file.name.replace(/[^\w.]/g, "_"));
      await fs.writeFile(filePath, buf);
    }

    const rawMeta = await fs.readFile(META_FILE, "utf-8");
    const boardData: BoardData = JSON.parse(rawMeta);

    // Direct lookup - much faster!
    const taskToUpdate = boardData.tasks[taskId];

    if (!taskToUpdate) {
      throw new Error("Task not found in metadata");
    }

    // Update file list by re-reading the directory
    const updatedFileList = await fs.readdir(taskDirectoryPath);
    taskToUpdate.files = updatedFileList;

    await fs.writeFile(META_FILE, JSON.stringify(boardData, null, 2));

    return NextResponse.json(taskToUpdate);
  } catch (err) {
    console.error(`Failed to upload files for task ${taskId}:`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}