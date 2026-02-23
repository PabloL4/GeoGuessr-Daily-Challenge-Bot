import es from "./locales/es.json" with { type: "json" };
import en from "./locales/en.json" with { type: "json" };
import de from "./locales/de.json" with { type: "json" };
import fr from "./locales/fr.json" with { type: "json" };
import it from "./locales/it.json" with { type: "json" };
import pt from "./locales/pt.json" with { type: "json" };

export type Lang = "es" | "en" | "de" | "fr" | "it" | "pt";

const dictionaries: Record<Lang, Record<string, string>> = { es, en, de, fr, it, pt };

let currentLang: Lang = "es";

export function setLang(lang: Lang) {
    currentLang = lang;
}

export function getLang(): Lang {
    return currentLang;
}

export function t(
    key: string,
    vars?: Record<string, string | number>,
    langOverride?: Lang
): string {
    const lang = langOverride ?? currentLang;
    const dict = dictionaries[lang] ?? dictionaries.es;

    let text = dict[key] ?? dictionaries.es[key] ?? key;

    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.split(`{${k}}`).join(String(v));
        }
    }
    return text;
}

export const availableLangs = Object.keys(dictionaries) as Lang[];

export function resolveLang(input?: string): Lang {
    const normalized = input?.toLowerCase();
    return (normalized && normalized in dictionaries
        ? normalized
        : "es") as Lang;
}

export function getLocale(langOverride?: Lang): string {
    const lang = (langOverride ?? currentLang)?.toLowerCase();

    try {
        return Intl.NumberFormat(lang).resolvedOptions().locale;
    } catch {
        return "en-US";
    }
}