import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

type RenderTableOptions = {
    title?: string;
    lines: string[];
    outputFile: string;
};

const FLAG_CACHE_DIR = path.join(process.cwd(), "data", "flags");

const COLOR_TEXT = "#e5e7eb";
const COLOR_TOTAL = "#facc15"; // amarillo suave
const COLOR_TOTAL_BG = "rgba(250, 204, 21, 0.15)"; // fondo suave para TOTAL

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

/**
 * Separa el último "token" de la línea (TOTAL).
 * Devuelve:
 *  - left: todo hasta el espacio justo antes del TOTAL (incluye ese espacio)
 *  - total: último token no-espacio
 */
function splitTotalSegment(line: string): { left: string; total: string } | null {
    const m = line.match(/^(.*\s)(\S+)\s*$/);
    if (!m) return null;
    return { left: m[1], total: m[2] };
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

    const monoFont = `"Cascadia Mono", "Consolas", monospace`;

    // 1) Canvas provisional para medir texto
    const tmp = createCanvas(10, 10);
    const tctx = tmp.getContext("2d");
    tctx.font = `${fontSize}px ${monoFont}`;
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
        ctx.fillStyle = COLOR_TEXT;
        ctx.fillText(title, padding, y + titleSize);
        y += titleSize + 20;
    }

    const normalMono = `${fontSize}px ${monoFont}`;
    const boldMono = `bold ${fontSize}px ${monoFont}`;

    const flagSize = 28; // tamaño icono bandera

    for (const line of lines) {
        // Detecta filas de jugadores (rank al inicio: " 1." / "12." etc)
        const isPlayerRow = /\[[A-Z]{2}\]/.test(line);

        // Líneas que no son jugadores (header, separadores, etc)
        if (!isPlayerRow) {
            ctx.font = normalMono;
            ctx.fillStyle = COLOR_TEXT;
            ctx.fillText(line, padding, y + fontSize);
            y += lineHeight;
            continue;
        }

        // Para resaltar TOTAL, preparamos split (sobre la línea completa)
        const totalSeg = splitTotalSegment(line);

        // Buscamos el marcador [CC]
        const m = line.match(/\[([A-Z]{2})\]/);

        // Caso con bandera
        if (m) {
            const cc = m[1];

            // Partimos la línea en: before + "[CC]" + after
            const before = line.slice(0, m.index);
            const after = line.slice((m.index ?? 0) + m[0].length);

            ctx.font = normalMono;
            ctx.fillStyle = COLOR_TEXT;

            // Dibuja before
            ctx.fillText(before, padding, y + fontSize);

            // Medimos before (con la misma fuente monospace)
            const beforeW = ctx.measureText(before).width;

            // Espacio reservado del marcador original en monospace: "[CC] "
            const marker = `[${cc}] `;
            const markerW = ctx.measureText(marker).width;

            // Dibuja bandera (o fallback con el marcador literal)
            const flagPath = await getFlagPngPath(cc);
            if (flagPath) {
                const img = await loadImage(flagPath);
                const flagX = padding + beforeW + (markerW - flagSize) / 2;
                ctx.drawImage(img, flagX, y + (lineHeight - flagSize) / 2, flagSize, flagSize);
            } else {
                ctx.fillText(marker, padding + beforeW, y + fontSize);
            }

            // Dibuja after (texto normal)
            const afterText = after.trimStart();
            const afterX = padding + beforeW + markerW;

            ctx.font = normalMono;
            ctx.fillStyle = COLOR_TEXT;
            ctx.fillText(afterText, afterX, y + fontSize);

            // Resalta TOTAL (fondo + bold + color)
            if (totalSeg) {
                const leftW = ctx.measureText(totalSeg.left).width;
                const totalW = ctx.measureText(totalSeg.total).width;

                const totalX = padding + leftW;
                const rectY = y + (lineHeight - fontSize) / 2 - 2;
                const rectH = fontSize + 6;

                // ctx.fillStyle = COLOR_TOTAL_BG;
                // ctx.fillRect(totalX - 6, rectY, totalW + 12, rectH);

                ctx.font = boldMono;
                ctx.fillStyle = COLOR_TOTAL;
                ctx.fillText(totalSeg.total, totalX, y + fontSize);

                // vuelve a normal
                ctx.font = normalMono;
                ctx.fillStyle = COLOR_TEXT;
            }
        } else {
            // Fila jugador sin marcador [CC]
            ctx.font = normalMono;
            ctx.fillStyle = COLOR_TEXT;
            ctx.fillText(line, padding, y + fontSize);

            if (totalSeg) {
                const leftW = ctx.measureText(totalSeg.left).width;
                const totalW = ctx.measureText(totalSeg.total).width;

                const totalX = padding + leftW;
                const rectY = y + (lineHeight - fontSize) / 2 - 2;
                const rectH = fontSize + 6;

                // ctx.fillStyle = COLOR_TOTAL_BG;
                // ctx.fillRect(totalX - 6, rectY, totalW + 12, rectH);

                ctx.font = boldMono;
                ctx.fillStyle = COLOR_TOTAL;
                ctx.fillText(totalSeg.total, totalX, y + fontSize);

                ctx.font = normalMono;
                ctx.fillStyle = COLOR_TEXT;
            }
        }

        y += lineHeight;
    }

    const outPath = path.resolve(outputFile);
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(outPath, buffer);

    return outPath;
}
