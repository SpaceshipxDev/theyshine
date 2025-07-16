// app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { BoardData } from "@/types";

const META_FILE = path.join(process.cwd(), "public", "storage", "metadata.json");

// --------------- helpers -----------------

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

/** --- NEW --- call the relay instead of Google directly */
async function getMatchingIdsViaRelay(prompt: string): Promise<string[]> {
  const resp = await fetch(process.env.GENAI_PROXY_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
    // 10 s timeout – tweak if your relay is slower
    // @ts-ignore – Next.js fetch accepts this option even though types don’t list it
    timeout: 10_000,
  });

  if (!resp.ok) {
    console.error("Relay error:", resp.status, await resp.text());
    return [];
  }

  const data = await resp.json(); // { text: "123,456,789" }
  return (data.text as string)
    .replace(/[^\d,]/g, "")
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

// --------------- route handler -----------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();
  if (!query) return NextResponse.json([]);

  try {
    const raw = await fs.readFile(META_FILE, "utf-8");
    const boardData: BoardData = JSON.parse(raw);
    if (!boardData.tasks || !boardData.columns) return NextResponse.json([]);

    // 1. prepare prompt
    const prompt = makePrompt(serialiseTasks(boardData.tasks), query);

    // 2. ask Gemini (via relay) for IDs
    const ids = await getMatchingIdsViaRelay(prompt);

    // 3. shape for UI
    return NextResponse.json(formatResults(ids, boardData));
  } catch (err) {
    console.error("AI search error:", err);
    return NextResponse.json([]);
  }
}