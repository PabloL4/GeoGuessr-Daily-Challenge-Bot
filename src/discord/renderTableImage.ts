import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";

type RenderTableOptions = {
    title?: string;
    lines: string[];
    outputFile: string;
};

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

for (const line of lines) {
    // Detecta banderas al inicio: 🇪🇸 (son 2 codepoints)
    const m = line.match(/^(\p{RI}\p{RI})\s+(.*)$/u);

    if (m) {
        const flag = m[1];
        const rest = m[2];

        // 1) bandera en fuente emoji
        ctx.font = `${fontSize}px ${emojiFont}`;
        ctx.fillText(flag, padding, y + fontSize);

        // medir ancho de bandera para colocar el resto
        const flagW = ctx.measureText(flag + " ").width;

        // 2) resto en monospace
        ctx.font = `${fontSize}px ${monoFont}`;
        ctx.fillText(rest, padding + flagW, y + fontSize);
    } else {
        // normal (sin bandera)
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
