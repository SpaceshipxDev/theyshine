// file: src/app/api/jobs/[taskId]/zip/route.ts

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import JSZip from "jszip";
import type { BoardData, Task } from "@/types"; // Import types to understand the data structure

// --- Path Definitions ---
const STORAGE_DIR = path.join(process.cwd(), "public", "storage");
const TASKS_STORAGE_DIR = path.join(STORAGE_DIR, "tasks");
const META_FILE = path.join(STORAGE_DIR, "metadata.json"); // We need the path to our master list
// ------------------------


// Helper function to recursively add files to the zip (no changes here)
async function addFilesToZip(zip: JSZip, directoryPath: string, relativePathPrefix = "") {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    const relativePath = path.join(relativePathPrefix, entry.name);

    if (entry.isDirectory()) {
      await addFilesToZip(zip, fullPath, relativePath);
    } else if (entry.isFile()) {
      const fileContent = await fs.readFile(fullPath);
      zip.file(relativePath, fileContent);
    }
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;
  if (!taskId) {
    return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
  }

  try {
    // --- STEP 1 & 2: Read metadata to find the task details ---
    const rawMeta = await fs.readFile(META_FILE, "utf-8");
    const boardData: BoardData = JSON.parse(rawMeta);
    const task = boardData.tasks[taskId];

    if (!task) {
      return NextResponse.json({ error: "Task not found in metadata" }, { status: 404 });
    }

    // --- STEP 3: Create a clean, human-readable folder name ---
    const desiredName = `${task.customerName} - ${task.representative}`;
    // Sanitize the name to remove characters that are invalid in filenames
    const sanitizedFolderName = desiredName.replace(/[\\/:*?"<>|]/g, '_').trim();


    const taskDirectoryPath = path.join(TASKS_STORAGE_DIR, taskId);
    await fs.access(taskDirectoryPath); // Check if the physical folder exists

    const zip = new JSZip();

    // --- STEP 4: Use the new name for the folder inside the zip ---
    const rootZipFolder = zip.folder(sanitizedFolderName);
    if (!rootZipFolder) { throw new Error("Could not create root folder in zip."); }

    // Add all files from the task's storage directory into our new named folder
    await addFilesToZip(rootZipFolder, taskDirectoryPath);

    if (Object.keys(zip.files).length === 0) {
      return NextResponse.json({ error: "No files to zip" }, { status: 404 });
    }

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    const headers = new Headers();
    headers.set("Content-Type", "application/zip");

    // --- FIX: Use RFC 6266 to handle non-ASCII filenames ---
    
    // 1. This is the full, correct filename with potential Unicode characters.
    const fullFilename = `${sanitizedFolderName}.zip`;

    // 2. Create a simple, safe, ASCII-only version for the old `filename` parameter as a fallback.
    const asciiFilename = fullFilename.replace(/[^\x00-\x7F]/g, '_'); // Replaces non-ASCII chars with '_'

    // 3. URI-encode the full filename for the new `filename*` parameter.
    const encodedFilename = encodeURIComponent(fullFilename);

    // 4. Set the header with both the fallback and the modern UTF-8 version.
    headers.set(
      "Content-Disposition",
      `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`
    );
    
    return new NextResponse(zipBuffer, { status: 200, headers });

  } catch (err: any) {
    if (err.code === 'ENOENT') {
        return NextResponse.json({ error: "Task folder or metadata not found." }, { status: 404 });
    }
    // Log the actual error for better debugging, but send a generic message to the client.
    console.error(`Failed to create zip for task ${taskId}:`, err);
    return NextResponse.json(
        { error: "Internal Server Error while creating zip file.", details: err.message },
        { status: 500 }
    );
  }
}
