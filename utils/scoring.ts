export type Letter = 'A' | 'B' | 'C' | 'D';
export type ScoreParams =
  | { correct: string; chosen: Letter; timeLeft?: number }
  | { isCorrect: boolean; timeMs?: number };

// Overloads for strict typing across call sites
export function scoreQuestion(params: ScoreParams): number;
export function scoreQuestion(isCorrect: boolean, timeMs?: number): number;

export function scoreQuestion(a: any, b?: any): number {
  let isCorrect = false;
  let timeMs = 0;

  if (typeof a === 'object' && a !== null) {
    if ('chosen' in a && 'correct' in a) {
      const chosen = String(a.chosen || '').toUpperCase();
      const correct = String(a.correct || '').toUpperCase();
      isCorrect = chosen === correct;
      if (typeof a.timeLeft === 'number' && isFinite(a.timeLeft)) {
        timeMs = Math.max(0, Math.floor(a.timeLeft * 1000));
      }
    } else if ('isCorrect' in a) {
      isCorrect = !!a.isCorrect;
      if (typeof a.timeMs === 'number' && isFinite(a.timeMs)) {
        timeMs = Math.max(0, Math.floor(a.timeMs));
      }
    }
  } else {
    isCorrect = !!a;
    if (typeof b === 'number' && isFinite(b)) {
      timeMs = Math.max(0, Math.floor(b));
    }
  }

  if (!isCorrect) return 0;
  const base = 700;
  const bonus = Math.max(0, 300 - Math.floor(timeMs / 100));
  return base + bonus;
}
