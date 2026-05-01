import { requireAuth, logout } from './auth.js';
import { subscribeOrders, acceptOrder, setOrderStatus, saveWorkReport, getBeforePhotos, getAfterPhotos } from './data.js';
import { formatPrice, formatDateTime, escapeHtml, showToast, getAcLabel } from './utils.js';
import { compressImage, openLightbox, MAX_PHOTOS_PER_SIDE } from './photo.js';

let profile = null;
let poolOrders = [];
let myOrders = [];
let currentTab = 'pool';

const listEl = document.getElementById('order-list');

// 보고서 모달 관련 상태
const reportModal = document.getElementById('report-modal');
const reportTarget = document.getElementById('report-target');
const reportDesc = document.getElementById('report-desc');
const reportSubmit = document.getElementById('report-submit');
const reportCancel = document.getElementById('report-cancel');
let reportContext = null; // { orderId, before, after }

(async function init() {
  profile = await requireAuth('business');
  document.getElementById('user-chip').textContent = `${profile.businessName} · 사업자`;

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await logout();
    location.replace('login.html');
  });

  document.querySelectorAll('.filter-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      render();
    });
  });

  listEl.addEventListener('click', onCardAction);

  initPhotoSlots();
  reportCancel.addEventListener('click', closeReport);
  reportModal.addEventListener('click', (e) => { if (e.target === reportModal) closeReport(); });
  reportSubmit.addEventListener('click', submitReport);

  subscribeOrders((list) => {
    poolOrders = list;
    renderStats();
    if (currentTab === 'pool') render();
  }, { status: '대기' });

  subscribeOrders((list) => {
    myOrders = list;
    renderStats();
    if (currentTab === 'mine') render();
  }, { acceptedByUid: profile.uid });
})();

function renderStats() {
  document.getElementById('stat-pool').textContent = poolOrders.length;
  const active = myOrders.filter((o) => o.status === '수락' || o.status === '진행중').length;
  const done = myOrders.filter((o) => o.status === '완료');
  const totalRevenue = done.reduce((s, o) => s + (o.estimate || 0), 0);
  const totalCommission = done.reduce((s, o) => s + (o.commission || 0), 0);

  document.getElementById('stat-mine-active').textContent = active;
  document.getElementById('stat-mine-done').textContent = done.length;
  document.getElementById('stat-mine-payout').textContent = formatPrice(totalRevenue - totalCommission);
  document.getElementById('stat-mine-commission').textContent = formatPrice(totalCommission);
}

function render() {
  const orders = currentTab === 'pool' ? poolOrders : myOrders;
  if (orders.length === 0) {
    const msg = currentTab === 'pool' ? '현재 수락 가능한 대기 오더가 없어요.' : '아직 수락한 오더가 없어요.';
    listEl.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><div>${msg}</div></div>`;
    return;
  }
  listEl.innerHTML = orders.map(renderCard).join('');
}

function renderCard(o) {
  const itemsText = (o.items || []).map((it) => `${getAcLabel(it.type)} ${it.count}대`).join(', ');
  const notesBlock = o.notes ? `<div class="order-notes">📝 ${escapeHtml(o.notes)}</div>` : '';
  const commission = o.commission || 0;
  const payout = (o.estimate || 0) - commission;
  const reportBlock = renderReportPreview(o);
  const brandLine = o.brand ? `<div>🏷️ <strong>${escapeHtml(o.brand)}</strong></div>` : '';

  return `
    <div class="order-card">
      <div>
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span class="order-id">${escapeHtml(o.displayId || o.id)}</span>
          <span class="badge ${o.status}">${o.status}</span>
        </div>
        <div class="order-title">${escapeHtml(o.customerName)} · ${escapeHtml(itemsText)}</div>
        <div class="order-meta">
          <div>📞 <strong>${escapeHtml(o.phone)}</strong></div>
          <div>📍 <strong>${escapeHtml(o.address)}</strong></div>
          <div>📅 <strong>${escapeHtml(o.preferredDate)} ${escapeHtml(o.preferredTime)}</strong></div>
          ${brandLine}
          <div>💰 고객결제 <strong>${formatPrice(o.estimate || 0)}</strong></div>
          <div>🧾 수수료 <strong>${formatPrice(commission)}</strong></div>
          <div>💵 정산액 <strong style="color:var(--primary-dark);">${formatPrice(payout)}</strong></div>
          <div style="grid-column:1/-1; font-size:12px;">접수 ${formatDateTime(o.createdAt)}</div>
        </div>
        ${notesBlock}
        ${reportBlock}
      </div>
      <div class="order-actions">${renderActions(o)}</div>
    </div>`;
}

function renderReportPreview(o) {
  if (!o.workReport) return '';
  const before = getBeforePhotos(o.workReport);
  const after = getAfterPhotos(o.workReport);
  const description = o.workReport.description;
  if (!before.length && !after.length) return '';
  const beforeHtml = before.map((src) =>
    `<div class="photo-thumb"><img src="${src}" alt="작업 전" data-zoom><div class="photo-tag">BEFORE</div></div>`
  ).join('');
  const afterHtml = after.map((src) =>
    `<div class="photo-thumb"><img src="${src}" alt="작업 후" data-zoom><div class="photo-tag photo-tag-after">AFTER</div></div>`
  ).join('');
  return `
    <div class="report-preview">
      <div class="report-photos">${beforeHtml}${afterHtml}</div>
      ${description ? `<div class="report-desc">${escapeHtml(description)}</div>` : ''}
    </div>`;
}

function renderActions(o) {
  if (o.status === '대기') {
    return `<button class="btn btn-primary btn-sm" data-action="accept" data-id="${o.id}">수락하기</button>`;
  }
  if (o.status === '수락') {
    return `
      <button class="btn btn-primary btn-sm" data-action="start" data-id="${o.id}">작업 시작</button>
      <button class="btn btn-danger btn-sm" data-action="cancel" data-id="${o.id}">취소</button>`;
  }
  if (o.status === '진행중') {
    return `<button class="btn btn-success btn-sm" data-action="complete-with-report" data-id="${o.id}">📷 완료 + 보고서</button>`;
  }
  if (o.status === '완료') {
    if (!o.workReport) {
      return `
        <button class="btn btn-outline btn-sm" data-action="add-report" data-id="${o.id}">📷 보고서 추가</button>
        <div style="font-size:12px; color:var(--muted); text-align:right;">완료<br>${formatDateTime(o.completedAt)}</div>`;
    }
    return `<div style="font-size:12px; color:var(--muted); text-align:right;">완료<br>${formatDateTime(o.completedAt)}</div>`;
  }
  if (o.status === '취소') {
    return `<div style="font-size:12px; color:var(--muted); text-align:right;">취소된 오더</div>`;
  }
  return '';
}

async function onCardAction(e) {
  const zoomImg = e.target.closest('img[data-zoom]');
  if (zoomImg) { openLightbox(zoomImg.src); return; }

  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === 'complete-with-report' || action === 'add-report') {
    const order = myOrders.find((o) => o.id === id);
    openReport(order, action === 'complete-with-report');
    return;
  }

  btn.disabled = true;
  try {
    if (action === 'accept') {
      await acceptOrder(id, { uid: profile.uid, businessName: profile.businessName });
      showToast('오더를 수락했어요. "내 오더" 탭에서 확인하세요.', 'success');
    } else if (action === 'start') {
      await setOrderStatus(id, '진행중');
      showToast('진행중 상태로 변경했어요.');
    } else if (action === 'cancel') {
      if (!confirm('이 오더를 취소할까요? (취소 후 되돌릴 수 없습니다.)')) {
        btn.disabled = false;
        return;
      }
      await setOrderStatus(id, '취소');
      showToast('오더를 취소했어요.');
    }
  } catch (err) {
    showToast(err.message || '처리에 실패했습니다.', 'error');
    btn.disabled = false;
  }
}

/* ================ 보고서 모달 (다중 사진) ================ */

function initPhotoSlots() {
  reportModal.querySelectorAll('.slot-grid').forEach((grid) => {
    grid.innerHTML = '';
    for (let i = 0; i < MAX_PHOTOS_PER_SIDE; i++) {
      grid.appendChild(buildPhotoSlot(grid.dataset.side, i));
    }
  });
}

function buildPhotoSlot(side, index) {
  const slot = document.createElement('div');
  slot.className = 'photo-slot mini';
  slot.dataset.side = side;
  slot.dataset.index = index;
  slot.innerHTML = `
    <input type="file" accept="image/*" hidden>
    <div class="photo-empty">📷<br><span>+</span></div>
    <img alt="작업 사진">
    <button type="button" class="photo-remove" aria-label="삭제">×</button>
  `;
  const input = slot.querySelector('input[type="file"]');
  const empty = slot.querySelector('.photo-empty');
  const img = slot.querySelector('img');
  const removeBtn = slot.querySelector('.photo-remove');

  empty.addEventListener('click', () => input.click());
  img.addEventListener('click', () => slot.dataset.url && openLightbox(slot.dataset.url));

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      slot.classList.add('loading');
      const dataUrl = await compressImage(file);
      slot.classList.remove('loading');
      img.src = dataUrl;
      slot.classList.add('has-image');
      slot.dataset.url = dataUrl;
    } catch (err) {
      slot.classList.remove('loading');
      showToast(err.message || '이미지 처리 실패', 'error');
    }
    input.value = '';
  });

  removeBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    img.src = '';
    slot.classList.remove('has-image');
    delete slot.dataset.url;
  });
  return slot;
}

function openReport(order, completeOnSubmit) {
  if (!order) return;
  reportContext = { orderId: order.id, completeOnSubmit };
  reportTarget.textContent = `${order.displayId || order.id} · ${order.customerName}`;
  reportDesc.value = order.workReport?.description || '';

  const beforePhotos = getBeforePhotos(order.workReport);
  const afterPhotos = getAfterPhotos(order.workReport);
  fillSide('before', beforePhotos);
  fillSide('after', afterPhotos);

  reportSubmit.textContent = completeOnSubmit ? '완료 처리' : '보고서 저장';
  reportModal.classList.add('show');
}

function fillSide(side, photos) {
  const slots = reportModal.querySelectorAll(`.photo-slot[data-side="${side}"]`);
  slots.forEach((slot, i) => {
    const img = slot.querySelector('img');
    const url = photos[i];
    if (url) {
      img.src = url;
      slot.classList.add('has-image');
      slot.dataset.url = url;
    } else {
      img.src = '';
      slot.classList.remove('has-image');
      delete slot.dataset.url;
    }
  });
}

function collectSide(side) {
  const slots = reportModal.querySelectorAll(`.photo-slot[data-side="${side}"]`);
  return Array.from(slots).map((s) => s.dataset.url).filter(Boolean);
}

function closeReport() {
  reportModal.classList.remove('show');
  reportContext = null;
}

async function submitReport() {
  if (!reportContext) return;
  const beforePhotos = collectSide('before');
  const afterPhotos = collectSide('after');
  if (beforePhotos.length === 0 || afterPhotos.length === 0) {
    showToast('작업 전/후 사진을 각각 1장 이상 업로드해 주세요.', 'error');
    return;
  }

  reportSubmit.disabled = true;
  reportSubmit.textContent = '저장 중...';
  try {
    await saveWorkReport(reportContext.orderId, {
      beforePhotos,
      afterPhotos,
      description: reportDesc.value.trim(),
      uploader: { uid: profile.uid, name: profile.businessName, role: 'business' },
    }, reportContext.completeOnSubmit);
    showToast(reportContext.completeOnSubmit ? '완료 처리되었어요!' : '보고서가 저장되었어요.', 'success');
    closeReport();
  } catch (err) {
    showToast('저장에 실패했습니다.', 'error');
  } finally {
    reportSubmit.disabled = false;
    reportSubmit.textContent = reportContext?.completeOnSubmit ? '완료 처리' : '보고서 저장';
  }
}
