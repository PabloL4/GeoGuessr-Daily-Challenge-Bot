type Mode = "Move" | "NM" | "NMPZ";

type ChallengeMeta = {
    mode: Mode;
    timeLimit: number;
    roundCount: number;
};

export function buildChallengeIntro(meta: ChallengeMeta): string {
    const { mode, timeLimit, roundCount } = meta;

    const lines: string[] = [];

    /* =========
       RONDAS
       ========= */
    if (roundCount === 10) {
        lines.push("🔟 **Especial 10 rondas** — hoy toca maratón 🏃‍♂️");
    }

    /* =========
       TIEMPO
       ========= */
    if (timeLimit === 10) {
        lines.push("⚡ **Rondas relámpago** — ¡decide en 10 segundos!");
    } else if (timeLimit <= 20) {
        lines.push("🔥 **Muy rápido** — sin tiempo para dudar");
    } else if (timeLimit <= 30) {
        lines.push("⏱️ **Ritmo ágil** — piensa rápido");
    } else if (timeLimit <= 60) {
        lines.push("😌 **Día tranquilito** — respira y observa");
    } else {
        lines.push("🧘 **Modo relax** — explora con calma");
    }

    /* =========
       MODO
       ========= */
    if (mode === "NMPZ") {
        lines.push("🚫🧭 **No Move, No Pan, No Zoom**");
    } else if (mode === "NM") {
        lines.push("🚫 **No Move**");
    } else {
        lines.push("🕹️ **Move permitido**");
    }

    if (lines.length === 0) return "";

    return lines.join("\n");
}
