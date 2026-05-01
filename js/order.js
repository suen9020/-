import { AC_TYPES, getAcType, formatTime, formatPrice, showToast } from './utils.js';
import { createOrder } from './data.js';

const optionsEl = document.getElementById('ac-type-options');
const estimateValue = document.getElementById('estimate-value');
const estimateTime = document.getElementById('estimate-time');
const form = document.getElementById('order-form');
const dateInput = document.getElementById('date');
const countInput = document.getElementById('count');
const brandSelect = document.getElementById('brand');

/* 에어컨 종류 카드 (라디오) */
optionsEl.innerHTML = AC_TYPES.map((t) => `
  <label class="ac-type-card">
    <input type="radio" name="airconType" value="${t.key}">
    <div class="ac-card-body">
      <div class="ac-card-name">${t.label}</div>
      <div class="ac-card-time">⏱ 예상 소요시간 ${formatTime(t.estimatedTime)}</div>
      <div class="ac-card-price">${formatPrice(t.price)} <span class="ac-card-unit">/ 1대</span></div>
    </div>
  </label>
`).join('');

optionsEl.addEventListener('change', updateEstimate);
countInput.addEventListener('input', updateEstimate);

function getSelected() {
  const r = form.querySelector('input[name="airconType"]:checked');
  return r ? getAcType(r.value) : null;
}

function updateEstimate() {
  const t = getSelected();
  const count = Math.max(1, parseInt(countInput.value, 10) || 1);
  if (!t) {
    estimateValue.textContent = '0원';
    estimateTime.textContent = '';
    return;
  }
  estimateValue.textContent = formatPrice(t.price * count);
  estimateTime.textContent = `예상 소요시간 ${formatTime(t.estimatedTime * count)}`;
}

/* 날짜 기본값: 오늘 + 1일 */
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
dateInput.min = new Date().toISOString().slice(0, 10);
dateInput.value = tomorrow.toISOString().slice(0, 10);

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = form.name.value.trim();
  const phone = form.phone.value.trim();
  const address = form.address.value.trim();
  const date = form.date.value;
  const timeRadio = form.querySelector('input[name="time"]:checked');
  const time = timeRadio ? timeRadio.value : '';
  const notes = form.notes.value.trim();
  const acType = getSelected();
  const brand = brandSelect.value;
  const count = Math.max(1, parseInt(countInput.value, 10) || 1);

  if (!name || !phone || !address || !date || !time) {
    showToast('필수 항목을 모두 입력해 주세요.', 'error');
    return;
  }
  if (!/^[0-9-+\s()]{8,20}$/.test(phone)) {
    showToast('연락처 형식을 확인해 주세요.', 'error');
    return;
  }
  if (!acType) {
    showToast('에어컨 종류를 선택해 주세요.', 'error');
    return;
  }
  if (!brand) {
    showToast('브랜드를 선택해 주세요.', 'error');
    return;
  }
  if (count < 1) {
    showToast('수량은 1대 이상이어야 합니다.', 'error');
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = '접수 중...';

  try {
    const newOrder = await createOrder({
      customerName: name,
      phone,
      address,
      airconType: acType.key,
      brand,
      count,
      preferredDate: date,
      preferredTime: time,
      notes,
    });

    document.getElementById('created-id').textContent = newOrder.displayId;
    document.getElementById('success-modal').classList.add('show');
    form.reset();
    optionsEl.querySelectorAll('input[name="airconType"]').forEach((r) => (r.checked = false));
    countInput.value = 1;
    updateEstimate();
  } catch (err) {
    showToast('접수 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '신청 접수하기';
  }
});

updateEstimate();
