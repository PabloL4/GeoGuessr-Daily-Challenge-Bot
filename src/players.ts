const COUNTRY_ALIASES: Record<string, string> = {
    UK: "GB",
    EN: "GB",
    SCO: "GB",
    WAL: "GB",
    EL: "GR",
};

export function normalizeCountryCode(input?: string): string | undefined {
    if (!input) return undefined;

    const code = input.trim().toUpperCase();
    return COUNTRY_ALIASES[code] ?? code;
}