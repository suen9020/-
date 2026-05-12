import { requireAuth, logout } from './auth.js';
import { subscribeOrders, subscribeBusinesses, setBusinessStatus, deleteBusinessUser, saveWorkReport, getBeforePhotos, getAfterPhotos } from './data.js';
import { formatPrice, formatDateTime, formatDate, escapeHtml, showToast, getAcLabel } from './utils.js';
import { compressImage, openLightbox, MAX_PHOTOS_PER_SIDE } from './photo.js';

let currentProfile = null;
let allOrders = [];
let allBusinesses = [];
let businessSort = 'createdAt';

(async function init() {
  currentProfile = await requireAuth('admin');
  document.getElementById('user-chip').textContent = `${currentProfile.email} · 관리자`;

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await logout();
    location.replace('login.html');
  });

  document.querySelectorAll('.filter-tab[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab[data-tab]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach((p) => {
        p.classList.toggle('hidden', p.dataset.panel !== btn.dataset.tab);
      });
    });
  });

  initReportModal();
  initBusinessSort();
  document.getElementById('order-table').addEventListener('click', onOrderRowClick);

  subscribeBusinesses((list) => {
    allBusinesses = list;
    renderBusinesses();
    renderBusinessStats();
  });

  subscribeOrders((list) => {
    allOrders = list;
    renderKpi();
    renderOrderTable();
    renderBusinessStats();
    renderRevenue();
  });
})();

function renderKpi() {
  const total = allOrders.length;
  const pending = allOrders.filter((o) => o.status === '대기').length;
  const progress = allOrders.filter((o) => o.status === '수락' || o.status === '진행중').length;
  const done = allOrders.filter((o) => o.status === '완료').length;
  const commission = allOrders
    .filter((o) => o.status === '완료')
    .reduce((s, o) => s + (o.commission || 0), 0);

  document.getElementById('kpi-total').textContent = total;
  document.getElementById('kpi-pending').textContent = pending;
  document.getElementById('kpi-progress').textContent = progress;
  document.getElementById('kpi-done').textContent = done;
  document.getElementById('kpi-commission').textContent = formatPrice(commission);
}

function renderBusinesses() {
  const tbody = document.getElementById('business-list');
  if (allBusinesses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="td-empty">등록된 사업자가 없습니다.</td></tr>`;
    return;
  }
  const list = getSortedBusinesses();
  tbody.innerHTML = list.map((b) => `
    <tr>
      <td data-label="업체명"><strong>${escapeHtml(b.businessName || '-')}</strong></td>
      <td data-label="대표자">${escapeHtml(b.ownerName || '-')}</td>
      <td data-label="사업자번호">${escapeHtml(formatBizRegNo(b.bizRegNo) || '-')}</td>
      <td data-label="이메일">${escapeHtml(b.email || '-')}</td>
      <td data-label="연락처">${escapeHtml(b.phone || '-')}</td>
      <td data-label="가입일">${b.createdAt ? formatDateTime(b.createdAt) : '-'}</td>
      <td data-label="상태"><span class="badge biz-${b.status}">${labelStatus(b.status)}</span></td>
      <td data-label="관리" style="text-align:right; white-space:nowrap;">${renderBizActions(b)}</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      const act = btn.dataset.act;
      try {
        if (act === 'approve') {
          await setBusinessStatus(uid, 'active');
          showToast('승인되었습니다.', 'success');
        } else if (act === 'reject') {
          if (!confirm('이 사업자를 거절(차단)할까요?')) return;
          await setBusinessStatus(uid, 'rejected');
          showToast('거절 처리했습니다.');
        } else if (act === 'reactivate') {
          await setBusinessStatus(uid, 'active');
          showToast('재활성화되었습니다.', 'success');
        } else if (act === 'delete') {
          if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
          await deleteBusinessUser(uid);
          showToast('사업자가 삭제되었습니다.', 'success');
        }
      } catch (e) {
        console.error('[admin] biz action failed:', act, uid, e);
        showToast(`처리 실패: ${e?.code || e?.message || '알 수 없는 오류'}`, 'error');
      }
    });
  });
}

function getSortedBusinesses() {
  const list = [...allBusinesses];
  if (businessSort === 'businessName') {
    list.sort((a, b) => (a.businessName || '').localeCompare(b.businessName || '', 'ko'));
  } else {
    list.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
  }
  return list;
}

function initBusinessSort() {
  document.querySelectorAll('.biz-sort-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      businessSort = btn.dataset.sort;
      updateBusinessSortStyles();
      renderBusinesses();
    });
  });
  updateBusinessSortStyles();
}

function updateBusinessSortStyles() {
  document.querySelectorAll('.biz-sort-btn').forEach((btn) => {
    if (btn.dataset.sort === businessSort) {
      btn.style.background = '#1D9E75';
      btn.style.color = '#fff';
      btn.style.borderColor = '#1D9E75';
    } else {
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }
  });
}

function renderBizActions(b) {
  const deleteBtn = `<button class="btn btn-sm" style="background:#FF4444; color:#fff; border-color:#FF4444;" data-act="delete" data-uid="${b.uid}">삭제</button>`;
  if (b.status === 'pending') {
    return `
      <button class="btn btn-primary btn-sm" data-act="approve" data-uid="${b.uid}">승인</button>
      <button class="btn btn-danger btn-sm" data-act="reject" data-uid="${b.uid}">거절</button>
      ${deleteBtn}`;
  }
  if (b.status === 'active') {
    return `<button class="btn btn-danger btn-sm" data-act="reject" data-uid="${b.uid}">차단</button> ${deleteBtn}`;
  }
  if (b.status === 'rejected') {
    return `<button class="btn btn-outline btn-sm" data-act="reactivate" data-uid="${b.uid}">재승인</button> ${deleteBtn}`;
  }
  return deleteBtn;
}

function labelStatus(s) {
  return { pending: '승인대기', active: '활성', rejected: '거절' }[s] || s || '-';
}

function formatBizRegNo(value) {
  if (!value) return '';
  const d = String(value).replace(/[^0-9]/g, '');
  if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5)}`;
  if (d.length === 13) return `${d.slice(0,6)}-${d.slice(6)}`;
  return value;
}

function renderOrderTable() {
  const tbody = document.getElementById('order-table');
  if (allOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="td-empty">아직 들어온 오더가 없어요.</td></tr>`;
    return;
  }
  tbody.innerHTML = allOrders.map((o) => {
    const itemsText = (o.items || []).map((it) => `${getAcLabel(it.type)} ${it.count}`).join(', ');
    const brandText = o.brand ? `<span class="td-sub">🏷️ ${escapeHtml(o.brand)}</span>` : '';
    const canEditReport = o.status === '진행중' || o.status === '완료';
    let reportCell = '-';
    if (o.workReport) {
      reportCell = `<button class="btn btn-outline btn-sm" data-report-action="view" data-id="${o.id}">📷 보기</button>`;
    } else if (canEditReport) {
      reportCell = `<button class="btn btn-ghost btn-sm" data-report-action="add" data-id="${o.id}">＋ 추가</button>`;
    }
    return `
      <tr>
        <td data-label="주문번호"><span class="order-id">${escapeHtml(o.displayId || o.id)}</span></td>
        <td data-label="고객">${escapeHtml(o.customerName)}<br><span class="td-sub">${escapeHtml(o.phone)}</span></td>
        <td data-label="주소">${escapeHtml(o.address)}</td>
        <td data-label="품목">${escapeHtml(itemsText)}${brandText ? '<br>' + brandText : ''}<br><span class="td-sub">총 ${o.totalUnits || 0}대</span></td>
        <td data-label="방문일">${escapeHtml(o.preferredDate)}<br><span class="td-sub">${escapeHtml(o.preferredTime)}</span></td>
        <td data-label="금액">${formatPrice(o.estimate)}</td>
        <td data-label="수수료">${formatPrice(o.commission)}</td>
        <td data-label="담당 사업자">${o.acceptedBy ? escapeHtml(o.acceptedBy.businessName) : '-'}</td>
        <td data-label="상태"><span class="badge ${o.status}">${o.status}</span></td>
        <td data-label="보고서">${reportCell}</td>
        <td data-label="접수일시"><span class="td-sub">${formatDateTime(o.createdAt)}</span></td>
      </tr>`;
  }).join('');
}

function renderBusinessStats() {
  const tbody = document.getElementById('business-stats');
  const tfoot = document.getElementById('business-stats-total');
  const businesses = allBusinesses.filter((b) => b.role === 'business');

  const rows = businesses.map((b) => {
    const myOrders = allOrders.filter((o) => o.acceptedBy && o.acceptedBy.uid === b.uid);
    const accepted = myOrders.filter((o) => o.status === '수락').length;
    const inProgress = myOrders.filter((o) => o.status === '진행중').length;
    const done = myOrders.filter((o) => o.status === '완료').length;
    const completedOrders = myOrders.filter((o) => o.status === '완료');
    const revenue = completedOrders.reduce((s, o) => s + (o.estimate || 0), 0);
    const commission = completedOrders.reduce((s, o) => s + (o.commission || 0), 0);
    const payout = revenue - commission;
    return { b, accepted, inProgress, done, revenue, commission, payout };
  });

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="td-empty">등록된 사업자가 없습니다.</td></tr>`;
    tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = rows.map((r) => `
    <tr>
      <td data-label="사업자"><strong>${escapeHtml(r.b.businessName || '-')}</strong><br><span class="td-sub">${escapeHtml(r.b.email || '')}</span></td>
      <td data-label="수락">${r.accepted}</td>
      <td data-label="진행중">${r.inProgress}</td>
      <td data-label="완료">${r.done}</td>
      <td data-label="총 매출">${formatPrice(r.revenue)}</td>
      <td data-label="수수료"><strong style="color:var(--primary-dark);">${formatPrice(r.commission)}</strong></td>
      <td data-label="정산액">${formatPrice(r.payout)}</td>
    </tr>
  `).join('');

  const totals = rows.reduce((acc, r) => ({
    accepted: acc.accepted + r.accepted,
    inProgress: acc.inProgress + r.inProgress,
    done: acc.done + r.done,
    revenue: acc.revenue + r.revenue,
    commission: acc.commission + r.commission,
    payout: acc.payout + r.payout,
  }), { accepted: 0, inProgress: 0, done: 0, revenue: 0, commission: 0, payout: 0 });

  tfoot.innerHTML = `
    <td data-label="구분"><strong>합계</strong></td>
    <td data-label="수락"><strong>${totals.accepted}</strong></td>
    <td data-label="진행중"><strong>${totals.inProgress}</strong></td>
    <td data-label="완료"><strong>${totals.done}</strong></td>
    <td data-label="총 매출"><strong>${formatPrice(totals.revenue)}</strong></td>
    <td data-label="수수료"><strong style="color:var(--primary-dark);">${formatPrice(totals.commission)}</strong></td>
    <td data-label="정산액"><strong>${formatPrice(totals.payout)}</strong></td>
  `;
}

/* ================ 보고서 모달 (관리자용) ================ */
let reportContext = null;

function onOrderRowClick(e) {
  const btn = e.target.closest('button[data-report-action]');
  if (!btn) return;
  const order = allOrders.find((o) => o.id === btn.dataset.id);
  if (!order) return;
  openReportModal(order);
}

function initReportModal() {
  const modal = document.getElementById('report-modal');
  const cancel = document.getElementById('report-cancel');
  const submit = document.getElementById('report-submit');

  modal.querySelectorAll('.slot-grid').forEach((grid) => {
    grid.innerHTML = '';
    for (let i = 0; i < MAX_PHOTOS_PER_SIDE; i++) {
      grid.appendChild(buildPhotoSlot(grid.dataset.side, i));
    }
  });

  cancel.addEventListener('click', closeReportModal);
  modal.addEventListener('click', (ev) => { if (ev.target === modal) closeReportModal(); });
  submit.addEventListener('click', submitReport);
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
  input.addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
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

function openReportModal(order) {
  const modal = document.getElementById('report-modal');
  reportContext = { orderId: order.id };
  document.getElementById('report-target').textContent = `${order.displayId || order.id} · ${order.customerName}`;
  document.getElementById('report-desc').value = order.workReport?.description || '';

  fillSide(modal, 'before', getBeforePhotos(order.workReport));
  fillSide(modal, 'after', getAfterPhotos(order.workReport));

  document.getElementById('report-submit').textContent = order.workReport ? '수정 저장' : '저장';
  modal.classList.add('show');
}

function fillSide(modal, side, photos) {
  const slots = modal.querySelectorAll(`.photo-slot[data-side="${side}"]`);
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

function collectSide(modal, side) {
  const slots = modal.querySelectorAll(`.photo-slot[data-side="${side}"]`);
  return Array.from(slots).map((s) => s.dataset.url).filter(Boolean);
}

function closeReportModal() {
  document.getElementById('report-modal').classList.remove('show');
  reportContext = null;
}

async function submitReport() {
  if (!reportContext) return;
  const modal = document.getElementById('report-modal');
  const beforePhotos = collectSide(modal, 'before');
  const afterPhotos = collectSide(modal, 'after');
  if (beforePhotos.length === 0 || afterPhotos.length === 0) {
    showToast('작업 전/후 사진을 각각 1장 이상 업로드해 주세요.', 'error');
    return;
  }
  const submit = document.getElementById('report-submit');
  submit.disabled = true;
  const orig = submit.textContent;
  submit.textContent = '저장 중...';
  try {
    await saveWorkReport(reportContext.orderId, {
      beforePhotos,
      afterPhotos,
      description: document.getElementById('report-desc').value.trim(),
      uploader: { uid: currentProfile.uid, name: currentProfile.email, role: 'admin' },
    }, false);
    showToast('보고서가 저장되었어요.', 'success');
    closeReportModal();
  } catch (err) {
    showToast('저장에 실패했습니다.', 'error');
  } finally {
    submit.disabled = false;
    submit.textContent = orig;
  }
}

function renderRevenue() {
  const completed = allOrders.filter((o) => o.status === '완료');
  const totalRev = completed.reduce((s, o) => s + (o.estimate || 0), 0);
  const totalCom = completed.reduce((s, o) => s + (o.commission || 0), 0);

  document.getElementById('rev-total').textContent = formatPrice(totalRev);
  document.getElementById('rev-count').textContent = completed.length;
  document.getElementById('rev-commission').textContent = formatPrice(totalCom);
  document.getElementById('rev-payout').textContent = formatPrice(totalRev - totalCom);

  // 일별 14일 차트
  const buckets = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets[formatDate(d)] = { revenue: 0, commission: 0 };
  }
  completed.forEach((o) => {
    if (!o.completedAt) return;
    const key = formatDate(o.completedAt);
    if (buckets[key]) {
      buckets[key].revenue += o.estimate || 0;
      buckets[key].commission += o.commission || 0;
    }
  });

  const max = Math.max(1, ...Object.values(buckets).map((b) => b.revenue));
  const chart = document.getElementById('rev-chart');
  chart.innerHTML = Object.entries(buckets).map(([day, v]) => {
    const h = (v.revenue / max) * 140;
    const ch = (v.commission / max) * 140;
    return `
      <div class="bar-col">
        <div class="bar-stack">
          <div class="bar bar-revenue" style="height:${h}px;" title="매출 ${formatPrice(v.revenue)}"></div>
          <div class="bar bar-commission" style="height:${ch}px;" title="수수료 ${formatPrice(v.commission)}"></div>
        </div>
        <div class="bar-label">${day.slice(5)}</div>
      </div>`;
  }).join('') + `
    <div class="bar-legend">
      <span><span class="dot rev"></span> 매출</span>
      <span><span class="dot com"></span> 수수료</span>
    </div>`;
}
