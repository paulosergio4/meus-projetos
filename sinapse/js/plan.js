// Cronograma reverso: distribui o conteúdo novo até uma semana antes da prova
// e reserva a reta final para revisão e simulados.
const DAY = 86400000;

export function daysBetween(fromMs, isoDate) {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const start = new Date(fromMs);
  start.setHours(0, 0, 0, 0);
  return Math.round((target - start.getTime()) / DAY);
}

export function buildPlan({ now, examDate, newLeft, finalWeekDays = 7, minNew = 5, maxNew = 40 }) {
  const daysLeft = daysBetween(now, examDate);
  if (daysLeft == null) return null;
  const studyDays = Math.max(1, daysLeft - finalWeekDays);
  const newPerDay = newLeft ? Math.min(maxNew, Math.max(minNew, Math.ceil(newLeft / studyDays))) : 0;
  const daysForNew = newPerDay ? Math.ceil(newLeft / newPerDay) : 0;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const newEnds = new Date(start.getTime() + Math.max(0, daysForNew - 1) * DAY);
  const finalStart = new Date(start.getTime() + Math.max(0, daysLeft - finalWeekDays) * DAY);
  const phase = daysLeft < 0 ? 'past' : daysLeft <= finalWeekDays ? 'final' : 'content';
  return { daysLeft, newPerDay, newEnds, finalStart, phase, onTrack: daysForNew <= studyDays };
}
