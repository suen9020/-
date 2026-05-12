import {
  collection,
  addDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from './firebase.js';
import { generateDisplayId, normalizePhone, formatPrice, showToast, escapeHtml } from './utils.js';

const SERVICE_ITEMS = [
  { key: 'wall',         label: '벽걸이형',                       price:  80000, image: 'images/ac-wall.png' },
  { key: 'stand',        label: '스탠드형',                       price: 120000, image: 'images/ac-stand.png' },
  { key: '2in1',         label: '2IN1',                          price: 170000, image: 'images/ac-2in1.png' },
  { key: 'sys-1way',     label: '시스템에어컨(천장형 1way)',      price:  80000, image: 'images/ac-ceiling1.png' },
  { key: 'sys-2way',     label: '시스템에어컨(천장형 2way)',      price: 100000, image: 'images/ac-ceiling2.png' },
  { key: 'sys-4way',     label: '시스템에어컨(천장형 4way)',      price: 140000, image: 'images/ac-ceiling4.png' },
  { key: 'ceiling-360',  label: '천장형 360',                     price: 160000, image: 'images/ac-ceiling360.png' },
  { key: 'biz-small',    label: '업소형 스탠드 소형(50평 이하)',  price: 160000, image: 'images/ac-shop-s.png' },
  { key: 'biz-large',    label: '업소형 스탠드 대형(50평 이상)',  price: 200000, image: 'images/ac-shop-l.png' },
];
const HIGH_CEILING_FEE = 100000;
const MAX_QTY = 10;
const MIN_QTY = 1;
const DOW_SHORT = ['일', '월', '화', '수', '목', '금', '토'];

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  items: [],          // { key, label, unitPrice, quantity }
  isHighCeiling: null,
  selectedDate: null, // YYYY-MM-DD
  timeSlot: null,     // '오전' | '오후'
  calCursor: new Date(),
};

document.addEventListener('DOMContentLoaded', init);

function init() {
  initPhone();
  initAddress();
  initHighCeiling();
  initItems();
  initAcGuide();
  initCalendar();
  initTimeSlots();
  initRequestNote();
  initTerms();
  initSubmit();
  renderItems();
  updateSummary();
}

/* ---------- 휴대폰 포맷 ---------- */
function initPhone() {
  const phone = $('#customer-phone');
  phone.addEventListener('input', () => {
    let v = phone.value.replace(/[^0-9]/g, '').slice(0, 11);
    if (v.length < 4) phone.value = v;
    else if (v.length < 8) phone.value = `${v.slice(0, 3)}-${v.slice(3)}`;
    else phone.value = `${v.slice(0, 3)}-${v.slice(3, 7)}-${v.slice(7)}`;
  });
}

/* ---------- 다음 우편번호 ---------- */
function initAddress() {
  $('#btn-address-search').addEventListener('click', () => {
    if (!window.daum || !window.daum.Postcode) {
      showToast('주소 검색을 불러올 수 없습니다. 새로고침 후 다시 시도해 주세요.', 'error');
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        const addr = data.roadAddress || data.jibunAddress || data.address || '';
        $('#address-main').value = addr;
        $('#address-main').classList.remove('invalid');
        $('#address-detail').focus();
      },
    }).open();
  });
}

/* ---------- 3m 이상 ---------- */
function initHighCeiling() {
  $$('input[name="high-ceiling"]').forEach((r) => {
    r.addEventListener('change', () => {
      state.isHighCeiling = r.value === 'yes';
      clearSectionInvalid('height');
      updateSummary();
    });
  });
}

/* ---------- 품목 ---------- */
function initItems() {
  const select = $('#item-type-select');
  select.innerHTML =
    '<option value="">에어컨 종류 선택</option>' +
    SERVICE_ITEMS.map(
      (s) => `<option value="${s.key}">${escapeHtml(s.label)} (${formatPrice(s.price)})</option>`
    ).join('');

  $('#btn-add-item').addEventListener('click', () => {
    const key = select.value;
    if (!key) {
      showToast('에어컨 종류를 선택해 주세요.', 'error');
      return;
    }
    if (state.items.some((i) => i.key === key)) {
      showToast('이미 추가된 품목입니다. 수량을 조절해 주세요.', 'error');
      return;
    }
    const def = SERVICE_ITEMS.find((s) => s.key === key);
    state.items.push({ key, label: def.label, unitPrice: def.price, quantity: 1 });
    select.value = '';
    clearSectionInvalid('items');
    renderItems();
  });
}

function renderItems() {
  const wrap = $('#items-list');
  if (state.items.length === 0) {
    wrap.innerHTML = '';
  } else {
    wrap.innerHTML = state.items.map((it, idx) => `
      <div class="item-card">
        <div class="item-card-head">
          <span class="item-card-name">${escapeHtml(it.label)}</span>
          <button type="button" class="item-card-remove" data-idx="${idx}" aria-label="삭제" title="삭제">⊗</button>
        </div>
        <div class="item-card-body">
          <div class="qty-control">
            <button type="button" class="qty-btn" data-act="dec" data-idx="${idx}" ${it.quantity <= MIN_QTY ? 'disabled' : ''}>−</button>
            <span class="qty-value">${it.quantity}</span>
            <button type="button" class="qty-btn" data-act="inc" data-idx="${idx}" ${it.quantity >= MAX_QTY ? 'disabled' : ''}>+</button>
          </div>
          <span class="item-price">${formatPrice(it.unitPrice * it.quantity)}</span>
        </div>
      </div>
    `).join('');

    wrap.querySelectorAll('.item-card-remove').forEach((b) => {
      b.addEventListener('click', () => {
        state.items.splice(Number(b.dataset.idx), 1);
        renderItems();
      });
    });
    wrap.querySelectorAll('.qty-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const idx = Number(b.dataset.idx);
        const it = state.items[idx];
        if (!it) return;
        if (b.dataset.act === 'inc' && it.quantity < MAX_QTY) it.quantity++;
        if (b.dataset.act === 'dec' && it.quantity > MIN_QTY) it.quantity--;
        renderItems();
      });
    });
  }
  updateSummary();
}

function getTotalItemsPrice() {
  return state.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
}
function getTotalCount() {
  return state.items.reduce((s, i) => s + i.quantity, 0);
}
function getGrandTotal() {
  const extra = state.isHighCeiling ? HIGH_CEILING_FEE : 0;
  return getTotalItemsPrice() + extra;
}

function formatRequestDate(iso) {
  if (!iso) return '날짜를 선택해 주세요';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = DOW_SHORT[date.getDay()];
  return `${y}년 ${m}월 ${d}일 (${dow})`;
}

function formatTimeSlot(slot) {
  if (!slot) return '시간대를 선택해 주세요';
  if (slot === '오전') return '오전 (09:00 ~ 12:00)';
  if (slot === '오후') return '오후 (13:00 이후)';
  return slot;
}

function updateSummary() {
  // 품목 라인
  const itemsEl = $('#summary-items');
  if (itemsEl) {
    if (state.items.length === 0) {
      itemsEl.innerHTML = '<div class="summary-empty">선택된 품목이 없습니다.</div>';
    } else {
      itemsEl.innerHTML = state.items.map((it) => `
        <div class="summary-item-line">
          <span class="summary-item-left">
            <span class="summary-bullet">·</span>
            <span class="summary-item-name">${escapeHtml(it.label)}</span>
            <span class="summary-item-qty">x ${it.quantity}개</span>
          </span>
          <span class="summary-item-price">${formatPrice(it.unitPrice * it.quantity)}</span>
        </div>
      `).join('');
    }
  }
  // 날짜/시간
  const dateEl = $('#summary-date');
  if (dateEl) dateEl.textContent = formatRequestDate(state.selectedDate);
  const timeEl = $('#summary-time');
  if (timeEl) timeEl.textContent = formatTimeSlot(state.timeSlot);
  // 3m 추가
  const row = $('#extra-fee-row');
  if (row) row.style.display = state.isHighCeiling ? 'flex' : 'none';
  // 합계
  const total = $('#total-amount');
  if (total) total.textContent = formatPrice(getGrandTotal());
}

/* ---------- 에어컨 품목 안내 모달 ---------- */
function initAcGuide() {
  const link = $('#btn-ac-guide');
  const modal = $('#ac-guide-modal');
  const body = $('#ac-guide-body');
  const closeBtn = $('#ac-guide-close');
  if (!link || !modal || !body || !closeBtn) return;

  body.innerHTML = SERVICE_ITEMS.map((s) => `
    <div class="ac-guide-card">
      <div class="ac-image-wrap">
        <img src="${s.image}" alt="${escapeHtml(s.label)}" loading="lazy"
             onerror="this.outerHTML='<div class=&quot;ac-image-fallback&quot;>❄️</div>'">
      </div>
      <div class="ac-info">
        <div class="ac-name">${escapeHtml(s.label)}</div>
      </div>
    </div>
  `).join('');

  const open = () => {
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  link.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) close();
  });
}

/* ---------- 캘린더 ---------- */
function initCalendar() {
  renderCalendar();
}

function renderCalendar() {
  const wrap = $('#calendar');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const y = state.calCursor.getFullYear();
  const m = state.calCursor.getMonth();
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  let html = `
    <div class="cal-head">
      <button type="button" class="cal-nav-btn" data-act="prev" aria-label="이전 달">‹</button>
      <span class="cal-title">${y}년 ${m + 1}월</span>
      <button type="button" class="cal-nav-btn" data-act="next" aria-label="다음 달">›</button>
    </div>
    <div class="cal-grid">
      <div class="cal-dow sun">일</div>
      <div class="cal-dow">월</div>
      <div class="cal-dow">화</div>
      <div class="cal-dow">수</div>
      <div class="cal-dow">목</div>
      <div class="cal-dow">금</div>
      <div class="cal-dow sat">토</div>
  `;
  for (let i = 0; i < startDow; i++) html += `<div></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    const dow = date.getDay();
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const disabled = date < tomorrow;
    const selected = iso === state.selectedDate;
    const cls = ['cal-day'];
    if (dow === 0) cls.push('sun');
    if (dow === 6) cls.push('sat');
    if (selected) cls.push('selected');
    html += `<button type="button" class="${cls.join(' ')}" data-date="${iso}" ${disabled ? 'disabled' : ''}><span class="day-num">${d}</span></button>`;
  }
  html += `</div>`;
  wrap.innerHTML = html;

  wrap.querySelector('[data-act="prev"]').addEventListener('click', () => {
    state.calCursor = new Date(y, m - 1, 1);
    renderCalendar();
  });
  wrap.querySelector('[data-act="next"]').addEventListener('click', () => {
    state.calCursor = new Date(y, m + 1, 1);
    renderCalendar();
  });
  wrap.querySelectorAll('.cal-day').forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener('click', () => {
      state.selectedDate = btn.dataset.date;
      clearSectionInvalid('datetime');
      renderCalendar();
      updateSummary();
    });
  });
}

/* ---------- 시간대 ---------- */
function initTimeSlots() {
  $$('#time-slots .time-slot').forEach((b) => {
    b.addEventListener('click', () => {
      $$('#time-slots .time-slot').forEach((x) => x.classList.remove('selected'));
      b.classList.add('selected');
      state.timeSlot = b.dataset.slot;
      clearSectionInvalid('datetime');
      updateSummary();
    });
  });
}

/* ---------- 요청사항 드롭다운 ---------- */
function initRequestNote() {
  const sel = $('#request-note');
  const custom = $('#request-custom');
  sel.addEventListener('change', () => {
    if (sel.value === '__custom__') {
      custom.style.display = 'block';
      custom.focus();
    } else {
      custom.style.display = 'none';
      custom.value = '';
    }
  });
}

/* ---------- 약관 ---------- */
function initTerms() {
  // 펼치기/접기 토글 — 버튼 자체에 위임
  $$('.terms-toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const item = btn.closest('.terms-item');
      if (!item) return;
      const open = item.classList.toggle('open');
      btn.textContent = open ? '접기' : '펼치기';
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  // 전체 동의 → 개별
  $('#terms-all').addEventListener('change', (e) => {
    $$('.term-check').forEach((c) => { c.checked = e.target.checked; });
    if (e.target.checked) {
      $$('.terms-item').forEach((t) => t.classList.remove('invalid'));
      clearSectionInvalid('terms');
    }
  });
  // 개별 → 전체 동기화
  $$('.term-check').forEach((c) => {
    c.addEventListener('change', () => {
      const all = $$('.term-check').every((x) => x.checked);
      $('#terms-all').checked = all;
      if (c.checked) {
        c.closest('.terms-item').classList.remove('invalid');
      }
    });
  });
}

/* ---------- 유효성 ---------- */
function clearSectionInvalid(name) {
  const sec = document.querySelector(`[data-section="${name}"]`);
  if (sec) sec.classList.remove('invalid-section');
}

function validate() {
  let firstInvalid = null;
  const markInput = (el, ok) => {
    if (!el) return;
    if (ok) el.classList.remove('invalid');
    else {
      el.classList.add('invalid');
      if (!firstInvalid) firstInvalid = el;
    }
  };
  const markSection = (name, ok) => {
    const sec = document.querySelector(`[data-section="${name}"]`);
    if (!sec) return;
    if (ok) sec.classList.remove('invalid-section');
    else {
      sec.classList.add('invalid-section');
      if (!firstInvalid) firstInvalid = sec;
    }
  };

  const name = $('#customer-name');
  const phone = $('#customer-phone');
  markInput(name, !!name.value.trim());
  markInput(phone, /^010-\d{4}-\d{4}$/.test(phone.value.trim()));

  markInput($('#address-main'), !!$('#address-main').value.trim());

  markSection('height', state.isHighCeiling !== null);
  markSection('items', state.items.length > 0);
  markSection('datetime', !!state.selectedDate && !!state.timeSlot);

  const allOk = $$('.term-check').every((c) => c.checked);
  $$('.terms-item').forEach((t) => t.classList.remove('invalid'));
  if (!allOk) {
    $$('.term-check').forEach((c) => {
      if (!c.checked) c.closest('.terms-item').classList.add('invalid');
    });
  }
  markSection('terms', allOk);

  if (firstInvalid) {
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('필수 항목을 확인해 주세요.', 'error');
    return false;
  }
  return true;
}

/* ---------- 제출 ---------- */
function initSubmit() {
  $('#order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const customerName = $('#customer-name').value.trim();
    const phone = $('#customer-phone').value.trim();
    const address = $('#address-main').value.trim();
    const addressDetail = $('#address-detail').value.trim();
    const requestSel = $('#request-note').value;
    const requestCustom = $('#request-custom').value.trim();
    const requestNote = requestSel === '__custom__' ? requestCustom : requestSel;

    const items = state.items.map((it) => ({
      type: it.label,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      subtotal: it.unitPrice * it.quantity,
    }));
    const totalCount = getTotalCount();
    const totalPrice = getGrandTotal();
    const displayId = generateDisplayId();

    const order = {
      customerName,
      phone,
      phoneNormalized: normalizePhone(phone),
      address,
      addressDetail,
      isHighCeiling: !!state.isHighCeiling,
      items,
      totalPrice,
      requestDate: state.selectedDate,
      timeSlot: state.timeSlot,
      requestNote,
      statusLabel: '접수완료',
      // 기존 시스템 호환 필드 (admin/business 대시보드용)
      status: '대기',
      airconType: state.items[0]?.label || '',
      brand: null,
      count: totalCount,
      totalUnits: totalCount,
      estimate: totalPrice,
      price: state.items[0]?.unitPrice || 0,
      estimatedTime: 0,
      commission: totalCount * 10000,
      preferredDate: state.selectedDate,
      preferredTime: state.timeSlot,
      notes: requestNote,
      displayId,
      acceptedBy: null,
      acceptedAt: null,
      completedAt: null,
      createdAt: serverTimestamp(),
    };

    const btn = $('#submit-btn');
    btn.disabled = true;
    btn.textContent = '접수 중...';
    try {
      await addDoc(collection(db, 'orders'), order);
      $('#created-id').textContent = displayId;
      $('#success-modal').classList.add('show');
    } catch (err) {
      console.error('[order] submit failed:', err);
      showToast('접수 실패: ' + (err?.message || '잠시 후 다시 시도해 주세요.'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '예약 접수하기';
    }
  });
}
