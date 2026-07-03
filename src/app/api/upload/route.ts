export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function isConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Cloudinary não configurado. Defina CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET nas variáveis de ambiente." },
      { status: 503 }
    );
  }

  try {
    const formData = await req.formData();
    const file     = formData.get("file") as File | null;
    const folder   = (formData.get("folder") as string) || "azul-cowork/pagamentos";

    if (!file) return NextResponse.json({ error: "Ficheiro em falta." }, { status: 400 });

    // validate type
    const allowed = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: "Tipo de ficheiro não permitido. Use PDF, PNG ou JPG." }, { status: 400 });
    }

    // max 10 MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Ficheiro demasiado grande (máx. 10 MB)." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);
    const b64         = buffer.toString("base64");
    const dataUri     = `data:${file.type};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      resource_type: "auto",
      use_filename: true,
      unique_filename: true,
    });

    return NextResponse.json({ url: result.secure_url, publicId: result.public_id });
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json({ error: "Erro ao fazer upload." }, { status: 500 });
  }
}
