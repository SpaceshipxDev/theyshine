// src/app/api/jobs/[taskId]/zip/route.ts

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import JSZip from "jszip";

// --- NOTE: Re-declare paths or import from a shared file ---
const TASKS_STORAGE_DIR = path.join(process.cwd(), "public", "storage", "tasks");
// -----------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;
  if (!taskId) {
    return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
  }

  const taskDirectoryPath = path.join(TASKS_STORAGE_DIR, taskId);
  const zip = new JSZip();

  try {
    const fileNames = await fs.readdir(taskDirectoryPath);

    if (fileNames.length === 0) {
      return NextResponse.json({ error: "No files to zip" }, { status: 404 });
    }

    // Add each file in the directory to the zip archive
    for (const fileName of fileNames) {
      const filePath = path.join(taskDirectoryPath, fileName);
      const fileContent = await fs.readFile(filePath);
      zip.file(fileName, fileContent);
    }
    
    // Generate the zip file as a buffer
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: {
        level: 9, // Max compression
      },
    });

    const headers = new Headers();
    headers.set("Content-Type", "application/zip");
    headers.set(
      "Content-Disposition",
      `attachment; filename="task-${taskId}.zip"`
    );
    
    return new NextResponse(zipBuffer, { status: 200, headers });

  } catch (err: any) {
    if (err.code === 'ENOENT') {
        return NextResponse.json({ error: "Task folder not found." }, { status: 404 });
    }
    console.error(`Failed to create zip for task ${taskId}:`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}