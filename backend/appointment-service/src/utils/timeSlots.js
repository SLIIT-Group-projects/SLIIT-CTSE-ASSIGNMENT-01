function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map((x) => Number(x));
  return h * 60 + m;
}

function toHHMM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addMinutesToHHMM(hhmm, minutes) {
  const base = toMinutes(hhmm);
  return toHHMM(base + minutes);
}

function buildSlotsForRange(range, slotMinutes) {
  const start = toMinutes(range.start);
  const end = toMinutes(range.end);
  const slots = [];
  for (let t = start; t + slotMinutes <= end; t += slotMinutes) {
    const slotStart = toHHMM(t);
    const slotEnd = toHHMM(t + slotMinutes);
    slots.push({ start: slotStart, end: slotEnd });
  }
  return slots;
}

function normalizeDateString(dateStr) {
  // expects YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  return dateStr;
}

module.exports = { toMinutes, toHHMM, addMinutesToHHMM, buildSlotsForRange, normalizeDateString };

