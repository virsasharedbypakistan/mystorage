import { promises as fs } from "node:fs";
import path from "node:path";
import { lookup as lookupMimeType } from "mime-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uploadsDir = path.join(process.cwd(), "uploads");

function sanitizeName(name: string) {
  return path.basename(name).replace(/[/\\]/g, "");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params;
  const safeName = sanitizeName(decodeURIComponent(name));

  if (!safeName) {
    return Response.json({ error: "Invalid file name." }, { status: 400 });
  }

  const fullPath = path.join(uploadsDir, safeName);

  try {
    const [content, stats] = await Promise.all([fs.readFile(fullPath), fs.stat(fullPath)]);
    const contentType = lookupMimeType(safeName) || "application/octet-stream";

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": stats.size.toString(),
        "Content-Disposition": `inline; filename=\"${safeName}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "File not found." }, { status: 404 });
  }
}