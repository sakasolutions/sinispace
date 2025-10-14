// app/api/uploads/route.ts
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs"; // wichtig: kein Edge, wir schreiben auf Disk

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// simple whitelist – erweiterbar
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
]);

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "no file" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "file too large" }, { status: 413 });
    }
    const mime = file.type || "application/octet-stream";
    if (!ALLOWED.has(mime)) {
      return NextResponse.json({ error: `mime not allowed: ${mime}` }, { status: 415 });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const ext = (() => {
      const original = file.name?.split(".").pop() || "";
      return original ? `.${original.toLowerCase()}` : "";
    })();
    const base = crypto.randomBytes(12).toString("hex");
    const filename = `${base}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buf);

    const url = `/uploads/${filename}`; // öffentlich serviert aus /public/uploads
    return NextResponse.json({
      url,
      name: file.name || filename,
      size: file.size,
      mime,
    });
  } catch (e: any) {
    console.error("upload failed:", e);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
