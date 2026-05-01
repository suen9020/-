/* 에어컨 종류 정의 — key는 Firestore 저장용 식별자, label은 화면 표시용 */
export const AC_TYPES = [
  { key: '벽걸이형',     label: '벽걸이형',                 price: 70000,  estimatedTime: 60 },
  { key: '스탠드형',     label: '스탠드형',                 price: 110000, estimatedTime: 90 },
  { key: '천장형_1way',  label: '천장형(시스템) 1 way',     price: 80000,  estimatedTime: 90 },
  { key: '천장형_4way',  label: '천장형(시스템) 4 way',     price: 130000, estimatedTime: 90 },
];

export const AC_BRANDS = ['삼성', 'LG', '캐리어'];

export const PRICE_TABLE = Object.fromEntries(AC_TYPES.map((t) => [t.key, t.price]));
export const TIME_TABLE = Object.fromEntries(AC_TYPES.map((t) => [t.key, t.estimatedTime]));

export const COMMISSION_PER_UNIT = 10000;

export function getAcType(key) {
  return AC_TYPES.find((t) => t.key === key) || null;
}

export function getAcLabel(key) {
  if (!key) return '';
  const t = AC_TYPES.find((t) => t.key === key);
  return t ? t.label : key; // 구버전(라벨이 곧 키였던 데이터)도 그대로 노출
}

export function formatTime(minutes) {
  const m = Number(minutes) || 0;
  if (m <= 0) return '';
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h}시간 ${r}분`;
  if (h) return `${h}시간`;
  return `${r}분`;
}

export function calcTotal(items) {
  return items.reduce((sum, it) => {
    const price = PRICE_TABLE[it.type] || 0;
    return sum + price * (Number(it.count) || 0);
  }, 0);
}

export function calcTotalUnits(items) {
  return items.reduce((sum, it) => sum + (Number(it.count) || 0), 0);
}

export function calcCommission(items) {
  return calcTotalUnits(items) * COMMISSION_PER_UNIT;
}

export function formatPrice(n) {
  return Number(n || 0).toLocaleString('ko-KR') + '원';
}

export function formatDateTime(value) {
  if (!value) return '-';
  const d = value.toDate ? value.toDate() : new Date(value);
  return (
    d.getFullYear() + '. ' +
    String(d.getMonth() + 1).padStart(2, '0') + '. ' +
    String(d.getDate()).padStart(2, '0') + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0')
  );
}

export function formatDate(value) {
  if (!value) return '-';
  const d = value.toDate ? value.toDate() : new Date(value);
  return (
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

export function generateDisplayId() {
  const now = new Date();
  const stamp =
    String(now.getFullYear()).slice(2) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AC-${stamp}-${rand}`;
}

export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function showToast(msg, type = '') {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.className = 'toast ' + type;
  el.textContent = msg;
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

export function normalizePhone(phone) {
  return (phone || '').replace(/[^0-9]/g, '');
}
