import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { loadImage } from "canvas";
import fetch from "node-fetch";

type RenderTableOptions = {
    title?: string;
    lines: string[];
    outputFile: string;
};

const FLAG_CACHE_DIR = path.join(process.cwd(), "data", "flags");
const COLOR_TEXT = "#e5e7eb";
const COLOR_TOTAL = "#facc15"; // amarillo suave


function ensureFlagCacheDir() {
    if (!fs.existsSync(FLAG_CACHE_DIR)) fs.mkdirSync(FLAG_CACHE_DIR, { recursive: true });
}

// Convierte "DE" -> "1f1e9-1f1ea" (formato Twemoji)
function countryCodeToTwemojiKey(cc: string): string | null {
    const c = cc.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) return null;

    const base = 0x1f1e6;
    const A = "A".charCodeAt(0);

    const cp1 = base + (c.charCodeAt(0) - A);
    const cp2 = base + (c.charCodeAt(1) - A);

    return `${cp1.toString(16)}-${cp2.toString(16)}`;
}

async function getFlagPngPath(cc: string): Promise<string | null> {
    const key = countryCodeToTwemojiKey(cc);
    if (!key) return null;

    ensureFlagCacheDir();

    const filePath = path.join(FLAG_CACHE_DIR, `${key}.png`);
    if (fs.existsSync(filePath)) return filePath;

    // Twemoji CDN
    const url = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/${key}.png`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filePath, buf);

    return filePath;
}

export async function renderTableImage({
    title,
    lines,
    outputFile,
}: RenderTableOptions): Promise<string> {
    const fontSize = 28;
    const lineHeight = 40;
    const padding = 40;
    const titleSize = title ? 36 : 0;

    // Tabla
const monoFont = `"Cascadia Mono", "Consolas", monospace`;
const emojiFont = `"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji"`;

    // 1) Canvas provisional para medir texto
    const tmp = createCanvas(10, 10);
    const tctx = tmp.getContext("2d");

    tctx.font = `${fontSize}px monospace`;
    const maxTextWidth = Math.max(...lines.map((l) => tctx.measureText(l).width));

    const width = Math.ceil(maxTextWidth + padding * 2);
    const height =
        padding * 2 +
        (title ? titleSize + 20 : 0) +
        lines.length * lineHeight;

    // 2) Canvas final
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Fondo
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    let y = padding;

    // Título
    if (title) {
        ctx.font = `bold ${titleSize}px Sans`;
        ctx.fillStyle = "#e5e7eb";
        ctx.fillText(title, padding, y + titleSize);
        y += titleSize + 20;
    }

    // Tabla
    ctx.font = `${fontSize}px monospace`;
    ctx.fillStyle = "#e5e7eb";

ctx.fillStyle = "#e5e7eb";

const flagSize = 28;   // tamaño icono bandera

    for (const line of lines) {
        const isPlayerRow = /^\s*\d+/.test(line);
        if (!isPlayerRow) {
            ctx.font = `${fontSize}px ${monoFont}`;
            ctx.fillText(line, padding, y + fontSize);
            y += lineHeight;
            continue;
        }
        // Detecta marcador al inicio del "nombre": [FR] Nick...
        // OJO: tus líneas empiezan por rank y espacios, así que buscamos el primer [CC]
        const m = line.match(/\[([A-Z]{2})\]/);

        if (m) {
        const cc = m[1];

        // Partimos la línea en: antes + marcador + después
        const before = line.slice(0, m.index);
        const after = line.slice((m.index ?? 0) + m[0].length);

        // Dibuja "before" en monospace
        ctx.fillText(before, padding, y + fontSize);
        ctx.font = `${fontSize}px ${monoFont}`;
// Asegura que medimos con la misma fuente monospace
ctx.font = `${fontSize}px ${monoFont}`;

const beforeW = ctx.measureText(before).width;

// ancho que ocuparía el marcador original en monospace
const marker = `[${cc}] `;
const markerW = ctx.measureText(marker).width;

// Descarga/carga bandera
const flagPath = await getFlagPngPath(cc);
if (flagPath) {
    const img = await loadImage(flagPath);

    // Bandera centrada dentro del espacio reservado del marcador
    const flagX = padding + beforeW + (markerW - flagSize) / 2;
    ctx.drawImage(img, flagX, y + (lineHeight - flagSize) / 2, flagSize, flagSize);
} else {
    // fallback: si no hay imagen, escribe el marcador literal (mantiene alineación)
    ctx.fillText(marker, padding + beforeW, y + fontSize);
}

// ✅ Muy importante: el resto empieza donde empezaría si existiera "[CC] "
ctx.fillText(after.trimStart(), padding + beforeW + markerW, y + fontSize);
    } else {
        // Línea normal
        ctx.font = `${fontSize}px ${monoFont}`;
        ctx.fillText(line, padding, y + fontSize);
    }

    y += lineHeight;
}


    const outPath = path.resolve(outputFile);
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(outPath, buffer);

    return outPath;
}
