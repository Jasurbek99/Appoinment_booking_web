// Server-side role display labels are not internationalized.
// Frontend uses i18n keys; server uses these for tooling/logs/journal exports.

const ROLE_NAMES_RU = {
  secretary: 'Секретарь',
  assistant1: 'Ассистент Б1',
  assistant2: 'Ассистент Б2',
  assistant3: 'Ассистент Б3',
  boss1: 'Босс 1',
  boss2: 'Босс 2',
  boss3: 'Босс 3',
};

export function roleNameById(role) {
  return ROLE_NAMES_RU[role] || role;
}
