import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uploadsDir = path.join(process.cwd(), "uploads");

type FileRecord = {
  name: string;
  size: number;
  updatedAt: string;
  url: string;
};

function safeFileName(value: string) {
  return value
    .replace(/[/\\]/g, "_")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

async function ensureUploadsDir() {
  await fs.mkdir(uploadsDir, { recursive: true });
}

async function readFiles(): Promise<FileRecord[]> {
  await ensureUploadsDir();
  const dirEntries = await fs.readdir(uploadsDir, { withFileTypes: true });
  const files = dirEntries.filter((entry) => entry.isFile());

  const records = await Promise.all(
    files.map(async (entry) => {
      const fullPath = path.join(uploadsDir, entry.name);
      const stats = await fs.stat(fullPath);

      return {
        name: entry.name,
        size: stats.size,
        updatedAt: stats.mtime.toISOString(),
        url: `/uploads/${encodeURIComponent(entry.name)}`,
      };
    }),
  );

  return records.sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name),
  );
}

export async function GET() {
  try {
    const files = await readFiles();
    return Response.json({ files });
  } catch (error) {
    console.error("Unable to list files", error);
    return Response.json({ error: "Unable to list files." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const incoming = formData.get("file");

    if (!(incoming instanceof File)) {
      return Response.json({ error: "Please choose a file to upload." }, { status: 400 });
    }

    await ensureUploadsDir();

    const sourceName = incoming.name || "upload";
    const parsed = path.parse(sourceName);
    const base = safeFileName(parsed.name) || "file";
    const ext = safeFileName(parsed.ext) || "";
    const finalName = `${Date.now()}-${base}${ext}`;
    const targetPath = path.join(uploadsDir, finalName);

    const bytes = await incoming.arrayBuffer();
    await fs.writeFile(targetPath, Buffer.from(bytes));

    const files = await readFiles();
    return Response.json(
      {
        message: "Upload completed.",
        uploaded: finalName,
        files,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unable to upload file", error);
    return Response.json({ error: "Unable to upload file." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const rawName = url.searchParams.get("name");

    if (!rawName) {
      return Response.json({ error: "File name is required." }, { status: 400 });
    }

    const fileName = path.basename(decodeURIComponent(rawName));
    if (!fileName) {
      return Response.json({ error: "Invalid file name." }, { status: 400 });
    }

    const targetPath = path.join(uploadsDir, fileName);
    await fs.unlink(targetPath);

    const files = await readFiles();
    return Response.json({ message: "File deleted.", files });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return Response.json({ error: "File not found." }, { status: 404 });
    }

    console.error("Unable to delete file", error);
    return Response.json({ error: "Unable to delete file." }, { status: 500 });
  }
}