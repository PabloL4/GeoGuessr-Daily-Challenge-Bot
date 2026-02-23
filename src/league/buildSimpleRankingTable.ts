export function buildSimpleRankingTable(params: {
    title: string;
    rows: Array<{ name: string; total: number }>;
}): { title: string; lines: string[] } {
    const { title, rows } = params;

    const nameWidth = Math.max(
        12,
        ...rows.map((r) => r.name.length)
    );

    const totalWidth = Math.max(
        6,
        ...rows.map((r) => r.total.toLocaleString("es-ES").length)
    );

    const padR = (s: string, w: number) =>
        s.length >= w ? s : s + " ".repeat(w - s.length);
    const padL = (s: string, w: number) =>
        s.length >= w ? s : " ".repeat(w - s.length) + s;

    const header =
        padL("#", 2) + "  " +
        padR("NOMBRE", nameWidth) + "  " +
        padL("TOTAL", totalWidth);

    const divider =
        "--  " +
        "-".repeat(nameWidth) + "  " +
        "-".repeat(totalWidth);

    const lines = [header, divider];

    rows.forEach((r, i) => {
        lines.push(
            padL(String(i + 1), 2) + "  " +
            padR(r.name, nameWidth) + "  " +
            padL(r.total.toLocaleString("es-ES"), totalWidth)
        );
    });

    return { title, lines };
}
