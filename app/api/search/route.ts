// app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import type { BoardData } from "@/types";

const META_FILE = path.join(process.cwd(), "public", "storage", "metadata.json");


const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });

/** One concise line per task so the prompt stays short. */
function serialiseTasks(tasks: BoardData["tasks"]): string {
  return Object.values(tasks)
    .map(
      (t) =>
        `ID:${t.id} COL:${t.columnId} CUSTOMER:${t.customerName} REPRESENTATIVE:${t.representative} DATE:${t.orderDate} NOTES:${t.notes}`
    )
    .join("\n");
}

/** Build the prompt exactly as a single string (no role/parts objects). */
function makePrompt(taskLines: string, query: string): string {
  return `
    You are an AI search helper for a Kanban board.
    Return ONLY the comma-separated task IDs (no spaces, no prose) of the TOP 3 most relevant tasks to the user query.
    If fewer than three match, return what you have.

    TASKS:
    ${taskLines}

    QUERY: ${query}
    `.trim();
}


async function getMatchingIds(prompt: string): Promise<string[]> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite-preview-06-17",
    contents: prompt,
  });
  console.log(prompt)

  const raw = (response as any).text?.trim?.() ?? "";
  console.log(raw) 
  return raw
    .replace(/[^\d,]/g, "") // keep digits & commas only
    .split(",")
    .filter(Boolean)
    .slice(0, 3);
}

/** Map IDs back to the shape the front-end already expects */
function formatResults(ids: string[], data: BoardData) {
  const colMap = new Map(data.columns.map((c) => [c.id, c.title]));
  return ids
    .map((id) => data.tasks[id])
    .filter(Boolean)
    .map((task) => ({
      task,
      columnTitle: colMap.get(task.columnId) ?? "Unknown Column",
    }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();
  if (!query) return NextResponse.json([]);

  try {
    const raw = await fs.readFile(META_FILE, "utf-8");
    const boardData: BoardData = JSON.parse(raw);
    if (!boardData.tasks || !boardData.columns) return NextResponse.json([]);

    // 1 prepare prompt
    const prompt = makePrompt(serialiseTasks(boardData.tasks), query);

    // 2 ask Gemini for IDs
    const ids = await getMatchingIds(prompt);

    // 3 shape for UI
    return NextResponse.json(formatResults(ids, boardData));
  } catch (err) {
    console.error("AI search error:", err);
    return NextResponse.json([]);
  }
}