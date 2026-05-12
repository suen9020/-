import { findOrdersByPhone, addReview, getBeforePhotos, getAfterPhotos } from './data.js';
import { formatPrice, formatDateTime, escapeHtml, showToast, getAcLabel } from './utils.js';
import { openLightbox } from './photo.js';

const form = document.getElementById('search-form');
const phoneInput = document.getElementById('phone');
const resultList = document.getElementById('result-list');
const submitBtn = form.querySelector('button[type="submit"]');

const reviewModal = document.getElementById('review-modal');
const starInput = document.getElementById('star-input');
const commentInput = document.getElementById('review-comment');
const reviewTarget = document.getElementById('review-target');
const reviewSubmit = document.getElementById('review-submit');
const reviewCancel = document.getElementById('review-cancel');

let lastQueriedPhone = '';
let currentOrderId = null;
let currentRating = 0;

resultList.innerHTML = `
  <div class="empty">
    <div class="empty-icon">📞</div>
    <div>위에 연락처를 입력하고 조회 버튼을 눌러주세요.</div>
  </div>`;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = phoneInput.value.trim();
  if (!phone) {
    showToast('연락처를 입력해 주세요.', 'error');
    return;
  }
  lastQueriedPhone = phone;
  await reload();
});

async function reload() {
  submitBtn.disabled = true;
  submitBtn.textContent = '조회 중...';
  try {
    const orders = await findOrdersByPhone(lastQueriedPhone);
    render(orders, lastQueriedPhone);
  } catch (err) {
    showToast('조회에 실패했습니다.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '조회';
  }
}

resultList.addEventListener('click', (e) => {
  const zoomImg = e.target.closest('img[data-zoom]');
  if (zoomImg) { openLightbox(zoomImg.src); return; }
  const btn = e.target.closest('button[data-review-id]');
  if (!btn) return;
  openReviewModal(btn.dataset.reviewId, btn.dataset.reviewLabel);
});

function openReviewModal(orderId, label) {
  currentOrderId = orderId;
  currentRating = 0;
  commentInput.value = '';
  reviewTarget.textContent = label || '';
  updateStars();
  reviewModal.classList.add('show');
}
function closeReviewModal() {
  reviewModal.classList.remove('show');
  currentOrderId = null;
}

starInput.addEventListener('click', (e) => {
  const btn = e.target.closest('button.star');
  if (!btn) return;
  currentRating = Number(btn.dataset.v);
  updateStars();
});
starInput.addEventListener('mouseover', (e) => {
  const btn = e.target.closest('button.star');
  if (!btn) return;
  highlightStars(Number(btn.dataset.v));
});
starInput.addEventListener('mouseleave', () => updateStars());

function highlightStars(n) {
  starInput.querySelectorAll('button.star').forEach((b) => {
    b.classList.toggle('on', Number(b.dataset.v) <= n);
  });
}
function updateStars() {
  highlightStars(currentRating);
}

reviewCancel.addEventListener('click', closeReviewModal);
reviewModal.addEventListener('click', (e) => {
  if (e.target === reviewModal) closeReviewModal();
});

reviewSubmit.addEventListener('click', async () => {
  if (!currentOrderId) return;
  if (currentRating < 1) {
    showToast('별점을 선택해 주세요.', 'error');
    return;
  }
  reviewSubmit.disabled = true;
  reviewSubmit.textContent = '등록 중...';
  try {
    await addReview(currentOrderId, {
      rating: currentRating,
      comment: commentInput.value.trim(),
    });
    showToast('리뷰가 등록되었어요. 감사합니다!', 'success');
    closeReviewModal();
    await reload();
  } catch (err) {
    showToast('리뷰 등록에 실패했습니다.', 'error');
  } finally {
    reviewSubmit.disabled = false;
    reviewSubmit.textContent = '등록';
  }
});

function render(orders, queriedPhone) {
  if (orders.length === 0) {
    resultList.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🔍</div>
        <div><strong>${escapeHtml(queriedPhone)}</strong> 으로 접수된 예약이 없어요.</div>
        <div style="margin-top:8px; font-size:13px;">
          <a href="order.html" style="color:var(--primary-dark); font-weight:600;">새로 예약하기 →</a>
        </div>
      </div>`;
    return;
  }
  resultList.innerHTML = orders.map(renderCard).join('');
}

function renderCard(o) {
  const itemsText = (o.items || []).map((it) => `${getAcLabel(it.type)} ${it.count}대`).join(', ');
  const brandLine = o.brand ? `<div>🏷️ <strong>${escapeHtml(o.brand)}</strong></div>` : '';
  const statusInfo = getStatusInfo(o.status);
  const notesBlock = o.notes ? `<div class="order-notes">📝 ${escapeHtml(o.notes)}</div>` : '';

  let reportBlock = '';
  if (o.workReport) {
    const before = getBeforePhotos(o.workReport);
    const after = getAfterPhotos(o.workReport);
    if (before.length || after.length) {
      const beforeHtml = before.map((src) =>
        `<div class="photo-thumb"><img src="${src}" alt="작업 전" data-zoom><div class="photo-tag">BEFORE</div></div>`
      ).join('');
      const afterHtml = after.map((src) =>
        `<div class="photo-thumb"><img src="${src}" alt="작업 후" data-zoom><div class="photo-tag photo-tag-after">AFTER</div></div>`
      ).join('');
      reportBlock = `
        <div class="report-preview">
          <div class="report-photos">${beforeHtml}${afterHtml}</div>
          ${o.workReport.description ? `<div class="report-desc">${escapeHtml(o.workReport.description)}</div>` : ''}
        </div>`;
    }
  }

  let reviewBlock = '';
  if (o.status === '완료') {
    if (o.review) {
      reviewBlock = `
        <div class="review-block">
          <div class="review-stars">${renderStars(o.review.rating)} <span class="review-rating-num">${o.review.rating.toFixed(1)}</span></div>
          ${o.review.comment ? `<div class="review-comment">"${escapeHtml(o.review.comment)}"</div>` : ''}
        </div>`;
    } else if (o.workReport) {
      const label = `${escapeHtml(itemsText)} · ${escapeHtml(o.preferredDate)}`;
      reviewBlock = `
        <div style="margin-top:12px;">
          <button class="btn btn-outline btn-sm" data-review-id="${o.id}" data-review-label="${label}">
            ⭐ 리뷰 작성하기
          </button>
        </div>`;
    } else {
      reviewBlock = `
        <div class="review-block review-empty" style="margin-top:12px;">
          📷 작업 보고서가 등록되면 리뷰를 작성할 수 있어요.
        </div>`;
    }
  }

  return `
    <div class="order-card">
      <div>
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span class="order-id">${escapeHtml(o.displayId || o.id)}</span>
          <span class="badge ${o.status}">${o.status}</span>
        </div>
        <div class="order-title">${escapeHtml(itemsText)}</div>
        <div class="order-meta">
          <div>📍 <strong>${escapeHtml(o.address)}</strong></div>
          <div>📅 <strong>${escapeHtml(o.preferredDate)} ${escapeHtml(o.preferredTime)}</strong></div>
          ${brandLine}
          <div>💰 <strong>${formatPrice(o.estimate || 0)}</strong></div>
          <div style="grid-column:1/-1; font-size:12px;">접수 ${formatDateTime(o.createdAt)}</div>
        </div>
        ${notesBlock}
        <div style="margin-top:12px; padding:10px 14px; background:${statusInfo.bg}; color:${statusInfo.color}; border-radius:6px; font-size:13px;">
          ${statusInfo.message}
        </div>
        ${reportBlock}
        ${reviewBlock}
      </div>
    </div>`;
}

function renderStars(rating) {
  const r = Math.round(Number(rating) || 0);
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span class="star-icon ${i <= r ? 'on' : ''}">★</span>`;
  return s;
}

function getStatusInfo(status) {
  switch (status) {
    case '대기':
      return { bg: '#fef3c7', color: '#92400e', message: '⏳ 사업자가 오더를 확인 중입니다. 잠시만 기다려 주세요.' };
    case '수락':
      return { bg: '#dbeafe', color: '#1e40af', message: '✅ 사업자가 오더를 수락했어요. 약속한 일시에 방문드릴 예정입니다.' };
    case '진행중':
      return { bg: '#e0f2fe', color: '#0284c7', message: '🛠️ 청소 작업이 진행 중입니다.' };
    case '완료':
      return { bg: '#d1fae5', color: '#065f46', message: '🎉 작업이 완료되었습니다. 이용해 주셔서 감사합니다!' };
    case '취소':
      return { bg: '#fee2e2', color: '#991b1b', message: '❌ 취소된 예약입니다.' };
    default:
      return { bg: '#f1f5f9', color: '#475569', message: '' };
  }
}
