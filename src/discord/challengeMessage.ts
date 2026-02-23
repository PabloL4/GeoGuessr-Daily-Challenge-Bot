import { t } from "../i18n/index.js"; 

type Mode = "Move" | "NM" | "NMPZ";

type ChallengeMeta = {
    mode: Mode;
    timeLimit: number;
    roundCount: number;
};

export function buildChallengeIntro(meta: ChallengeMeta): string {
  const { mode, timeLimit, roundCount } = meta;

  const lines: string[] = [];

  // RONDAS
  if (roundCount === 10) {
    lines.push(t("challenge.intro.rounds.special10"));
  }

  // TIEMPO
  if (timeLimit === 10) {
    lines.push(t("challenge.intro.time.10"));
  } else if (timeLimit <= 20) {
    lines.push(t("challenge.intro.time.20"));
  } else if (timeLimit <= 30) {
    lines.push(t("challenge.intro.time.30"));
  } else if (timeLimit <= 60) {
    lines.push(t("challenge.intro.time.60"));
  } else {
    lines.push(t("challenge.intro.time.relax"));
  }

  // MODO
  if (mode === "NMPZ") {
    lines.push(t("challenge.intro.mode.nmpz"));
  } else if (mode === "NM") {
    lines.push(t("challenge.intro.mode.nm"));
  } else {
    lines.push(t("challenge.intro.mode.move"));
  }

  if (lines.length === 0) return "";
  return lines.join("\n");
}