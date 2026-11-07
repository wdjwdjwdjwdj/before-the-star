import { newMemory } from './state.js';
import { KNOWLEDGE, LOGS, QUESTIONS } from './config.js';
const KEY = 'dawn-station-memory-v1';
const QUESTION_IDS = new Set(QUESTIONS.map(q => q.id));
export function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY)); if (!d || d.version !== 1) return null;
    const m = newMemory();
    m.discoveries = [...new Set((d.discoveries || []).filter(x => x in KNOWLEDGE))];
    m.logs = [...new Set((d.logs || []).filter(x => x in LOGS))];
    m.solvedQuestions = [...new Set((d.solvedQuestions || []).filter(x => QUESTION_IDS.has(x)))];
    m.activeQuestionId = QUESTION_IDS.has(d.activeQuestionId) && !m.solvedQuestions.includes(d.activeQuestionId) ? d.activeQuestionId : null;
    for (const k of ['cycles','total','wins','hintLevel']) m[k] = Number.isFinite(d[k]) ? Math.max(0, d[k]) : 0;
    const residual = Number(d.residualHeat);
    m.residualHeat = Number.isFinite(residual) ? Math.max(2, Math.min(5, residual)) : 2;
    m.scarHeat = d.scarHeat === true;
    m.scarFrost = d.scarFrost === true;
    m.boardAlert = d.boardAlert === true;
    m.lastTrace = typeof d.lastTrace === 'string' ? d.lastTrace.slice(0, 240) : '';
    const volume = Number(d.settings?.volume ?? .45);
    m.settings.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : .45;
    m.settings.shake = d.settings?.shake !== false; m.settings.flash = d.settings?.flash === true;
    return m;
  } catch { return null; }
}
export function save(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); return true; } catch { return false; } }
export function formatTime(t) { return `${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`; }
