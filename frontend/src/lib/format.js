// All display formatting goes through here so the time-zone choice
// (Asia/Ashgabat per SPEC.md §12) is in one place.

const TZ = 'Asia/Ashgabat';

export function fmtTime(iso, lang = 'ru') {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleTimeString(lang === 'tk' ? 'en-GB' : 'ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });
}

export function fmtDate(yyyymmdd, lang = 'ru') {
  if (!yyyymmdd) return '';
  const d = new Date(yyyymmdd + 'T00:00:00');
  return d.toLocaleDateString(lang === 'tk' ? 'en-GB' : 'ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

export function todayLocalISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function visitorName(appt) {
  if (appt.employee) return `${appt.employee.firstName} ${appt.employee.lastName}`;
  if (appt.visitor) return `${appt.visitor.firstName} ${appt.visitor.lastName}`;
  return '—';
}

export function visitorCompany(appt) {
  return appt.employee?.company || appt.visitor?.company || '';
}
