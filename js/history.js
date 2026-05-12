import {
  subscribeCompletedReviews,
  subscribeWorkPosts,
  createWorkPost,
  updateWorkPost,
  deleteWorkPost,
  getBeforePhotos,
  getAfterPhotos,
} from './data.js';
import { onAuthChange } from './auth.js';
import { formatDateTime, escapeHtml, showToast, getAcLabel } from './utils.js';
import { openLightbox, compressImage, MAX_PHOTOS_PER_SIDE } from './photo.js';

const listEl = document.getElementById('history-list');
let allCompleted = [];
let allPosts = [];
let currentTab = 'all';
let currentUser = null;

const writeBtn = document.getElementById('post-create-btn');
const postModal = document.getElementById('post-modal');
const titleEl = document.getElementById('post-title');
const acTypeEl = document.getElementById('post-actype');
const descEl = document.getElementById('post-desc');
const submitBtn = document.getElementById('post-submit');
const cancelBtn = document.getElementById('post-cancel');
const deleteBtn = document.getElementById('post-delete');
const modalTitleEl = document.getElementById('post-modal-title');
let editingPostId = null;

/* SVG 플레이스홀더 */
function svgPlaceholder({ from, to, label, sub }) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='${from}'/>
        <stop offset='100%' stop-color='${to}'/>
      </linearGradient>
    </defs>
    <rect width='800' height='600' fill='url(#g)'/>
    <circle cx='400' cy='240' r='90' fill='rgba(255,255,255,0.18)'/>
    <text x='400' y='265' font-family='Arial,sans-serif' font-size='80' font-weight='bold' fill='white' text-anchor='middle'>${label}</text>
    <text x='400' y='395' font-family='Arial,sans-serif' font-size='26' fill='rgba(255,255,255,0.85)' text-anchor='middle'>${sub}</text>
    <text x='400' y='445' font-family='Arial,sans-serif' font-size='18' fill='rgba(255,255,255,0.6)' text-anchor='middle'>SAMPLE PHOTO</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const ph = (from, to, label, sub) => svgPlaceholder({ from, to, label, sub });

const EXAMPLE_REVIEWS = [
  {
    isSample: true,
    customerName: '김민지',
    acceptedBy: { businessName: '깔끔에어 클리닝' },
    items: [{ type: '벽걸이형', count: 2 }],
    totalUnits: 2,
    preferredDate: '2026-04-21',
    completedAtDisplay: '2026. 04. 21 14:30',
    workReport: {
      beforePhotos: [
        ph('#475569', '#1e293b', 'BEFORE', '외관 - 먼지 누적'),
        ph('#3f3f46', '#18181b', 'BEFORE', '필터 - 곰팡이'),
        ph('#52525b', '#27272a', 'BEFORE', '송풍팬 오염'),
        ph('#404040', '#171717', 'BEFORE', '드레인 막힘'),
      ],
      afterPhotos: [
        ph('#0ea5e9', '#bae6fd', 'AFTER', '외관 - 깨끗'),
        ph('#0284c7', '#7dd3fc', 'AFTER', '필터 - 살균 완료'),
        ph('#06b6d4', '#a5f3fc', 'AFTER', '송풍팬 세척'),
        ph('#0891b2', '#67e8f9', 'AFTER', '드레인 정상'),
      ],
      description: '벽걸이형 2대 분해 세척 완료. 송풍팬에 곰팡이가 다량 발견되어 살균 세제로 추가 세척 진행했습니다. 드레인 호스도 막힘 없이 잘 흐르는 것 확인했어요.',
    },
    review: {
      rating: 5,
      comment: '곰팡이 냄새가 완전히 사라졌어요. 기사님도 너무 친절하시고 작업 끝나고 바닥까지 깨끗이 정리해주셔서 감동! 내년에도 꼭 다시 부탁드릴게요.',
    },
  },
  {
    isSample: true,
    customerName: '박상우',
    acceptedBy: { businessName: '서울 에어케어' },
    items: [{ type: '스탠드형', count: 1 }, { type: '벽걸이형', count: 1 }],
    totalUnits: 2,
    preferredDate: '2026-04-15',
    completedAtDisplay: '2026. 04. 15 11:10',
    workReport: {
      beforePhotos: [
        ph('#78716c', '#44403c', 'BEFORE', '스탠드 외관'),
        ph('#57534e', '#292524', 'BEFORE', '시로코팬'),
        ph('#71717a', '#3f3f46', 'BEFORE', '벽걸이 내부'),
      ],
      afterPhotos: [
        ph('#14b8a6', '#a7f3d0', 'AFTER', '스탠드 외관'),
        ph('#0d9488', '#5eead4', 'AFTER', '시로코팬 세척'),
        ph('#0f766e', '#2dd4bf', 'AFTER', '벽걸이 내부'),
        ph('#115e59', '#14b8a6', 'AFTER', '실외기 점검'),
      ],
      description: '스탠드 1대 + 벽걸이 1대. 스탠드 내부 시로코팬 분리 후 고압 세척, 벽걸이는 약품 도포 후 30분 후 세척했습니다. 실외기 점검도 완료.',
    },
    review: {
      rating: 4,
      comment: '분해해서 보여주신 부품 상태에 깜짝 놀랐네요. 그동안 이런 상태로 사용했다니… 지금은 바람도 시원하고 냄새도 안 나서 만족합니다.',
    },
  },
  {
    isSample: true,
    customerName: '이수진',
    acceptedBy: { businessName: '프로 에어컨 케어' },
    items: [{ type: '천장형_4way', count: 1 }],
    totalUnits: 1,
    preferredDate: '2026-04-08',
    completedAtDisplay: '2026. 04. 08 16:45',
    workReport: {
      beforePhotos: [
        ph('#3f3f46', '#18181b', 'BEFORE', '천장형 외관'),
        ph('#52525b', '#27272a', 'BEFORE', '필터 곰팡이'),
        ph('#27272a', '#0a0a0a', 'BEFORE', '디퓨저 오염'),
        ph('#44403c', '#1c1917', 'BEFORE', '내부 송풍구'),
      ],
      afterPhotos: [
        ph('#06b6d4', '#cffafe', 'AFTER', '천장형 외관'),
        ph('#0e7490', '#22d3ee', 'AFTER', '필터 살균'),
        ph('#155e75', '#67e8f9', 'AFTER', '디퓨저 청소'),
        ph('#164e63', '#06b6d4', 'AFTER', '내부 송풍구'),
      ],
      description: '4WAY 천장형 시스템에어컨 분해 세척. 각 토출구 디퓨저 제거 후 별도 세척 진행했습니다. 바람 토출 점검 결과 풍량 정상 회복 확인.',
    },
    review: {
      rating: 5,
      comment: '천장형이라 청소 까다로울까 걱정했는데, 약속 시간 정확히 지켜주시고 작업 전후 사진도 찍어서 보내주셔서 신뢰가 갔습니다. 가격도 합리적이었어요. 추천합니다 :)',
    },
  },
];

document.querySelectorAll('.filter-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    render();
  });
});

listEl.addEventListener('click', (e) => {
  const zoomImg = e.target.closest('img[data-zoom]');
  if (zoomImg) { openLightbox(zoomImg.src); return; }
  const editBtn = e.target.closest('button[data-edit-post]');
  if (editBtn) { openModalEdit(editBtn.dataset.editPost); return; }
});

writeBtn.addEventListener('click', () => openModalCreate());
cancelBtn.addEventListener('click', closeModal);
postModal.addEventListener('click', (e) => { if (e.target === postModal) closeModal(); });
submitBtn.addEventListener('click', submitPost);
deleteBtn.addEventListener('click', deletePostHandler);

initPhotoSlots();

onAuthChange((profile) => {
  currentUser = profile;
  // 로그인된 사업자(활성) 또는 관리자만 작성 버튼 표시
  const canPost = !!profile && (profile.role === 'admin' || (profile.role === 'business' && profile.status === 'active'));
  writeBtn.classList.toggle('hidden', !canPost);
  render();
});

subscribeCompletedReviews((list) => {
  allCompleted = list;
  renderStats();
  render();
});

subscribeWorkPosts((list) => {
  allPosts = list;
  renderStats();
  render();
});

function renderStats() {
  const reported = allCompleted.filter((o) => o.workReport);
  const reviewed = reported.filter((o) => o.review);
  const ratings = reviewed.map((o) => Number(o.review.rating) || 0);
  const avg = ratings.length ? ratings.reduce((s, n) => s + n, 0) / ratings.length : 0;
  const totalUnits = allCompleted.reduce((s, o) => s + (o.totalUnits || 0), 0);

  document.getElementById('hist-done').textContent = allCompleted.length + allPosts.length;
  document.getElementById('hist-reviews').textContent = reviewed.length;
  document.getElementById('hist-rating').textContent = ratings.length ? `${avg.toFixed(1)} ★` : '-';
  document.getElementById('hist-units').textContent = `${totalUnits}대`;
}

function render() {
  // 보고서가 있는 주문 작업 (실데이터)
  const orderItems = allCompleted
    .filter((o) => o.workReport && (getBeforePhotos(o.workReport).length || getAfterPhotos(o.workReport).length))
    .map((o) => ({ kind: 'order', data: o, ts: o.completedAt?.toMillis ? o.completedAt.toMillis() : 0 }));

  // 자유 게시물 (실데이터)
  const postItems = allPosts.map((p) => ({
    kind: 'post',
    data: p,
    ts: p.createdAt?.toMillis ? p.createdAt.toMillis() : 0,
  }));

  let realList = [...orderItems, ...postItems];
  if (currentTab === 'orders') realList = orderItems;
  else if (currentTab === 'posts') realList = postItems;
  else if (currentTab === 'reviewed') realList = orderItems.filter((it) => it.data.review);
  realList.sort((a, b) => b.ts - a.ts);

  const realCardsHtml = realList.map(renderItem).join('');

  // 샘플 (전체 / 리뷰 있음 탭에서만 노출)
  const showSample = currentTab === 'all' || currentTab === 'reviewed' || currentTab === 'orders';
  const sampleList = showSample
    ? (currentTab === 'reviewed' ? EXAMPLE_REVIEWS.filter((o) => o.review) : EXAMPLE_REVIEWS)
    : [];
  const sampleCardsHtml = sampleList
    .map((o) => renderOrderCard(o, true))
    .join('');

  let html = '';
  if (realList.length > 0) {
    html += realCardsHtml;
    if (sampleList.length) html += `<div class="sample-divider"><span>아래는 샘플입니다</span></div>`;
  } else {
    const emptyMsg = {
      all: '아직 등록된 작업이 없어요.',
      orders: '아직 등록된 주문 작업 보고서가 없어요.',
      posts: '아직 작성된 게시물이 없어요.',
      reviewed: '아직 등록된 리뷰가 없어요.',
    }[currentTab];
    html += `<div class="empty" style="margin-bottom:16px;">
      <div class="empty-icon">🌟</div>
      <div>${emptyMsg}</div>
      ${sampleList.length ? '<div style="margin-top:6px; font-size:13px; color:var(--muted);">아래는 서비스 소개용 샘플입니다.</div>' : ''}
    </div>`;
  }
  html += sampleCardsHtml;
  listEl.innerHTML = html;
}

function renderItem(item) {
  if (item.kind === 'order') return renderOrderCard(item.data, false);
  if (item.kind === 'post') return renderPostCard(item.data);
  return '';
}

function renderOrderCard(o, asSample) {
  const itemsText = (o.items || []).map((it) => `${getAcLabel(it.type)} ${it.count}대`).join(', ');
  const businessName = o.acceptedBy?.businessName || 'MAIND 사업자';
  const completedTxt = asSample
    ? o.completedAtDisplay
    : (o.completedAt ? formatDateTime(o.completedAt) : '-');
  const customerInitial = (o.customerName || '고').slice(0, 1) + '*';
  const sampleBadge = asSample ? `<span class="badge sample-badge">샘플</span>` : '';

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
  if (o.review) {
    reviewBlock = `
      <div class="review-block ${o.isSample ? 'review-sample' : ''}">
        <div class="review-stars">${renderStars(o.review.rating)} <span class="review-rating-num">${Number(o.review.rating).toFixed(1)}</span></div>
        ${o.review.comment ? `<div class="review-comment">"${escapeHtml(o.review.comment)}"</div>` : '<div class="review-comment" style="color:var(--muted);">코멘트 없음</div>'}
        <div class="review-meta">— ${escapeHtml(customerInitial)} 고객님</div>
      </div>`;
  } else {
    reviewBlock = `<div class="review-block review-empty">고객 리뷰가 등록되지 않은 작업입니다.</div>`;
  }

  return `
    <div class="order-card ${asSample ? 'card-sample' : ''}" style="grid-template-columns: 1fr;">
      <div>
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span class="badge 완료">완료</span>
          ${sampleBadge}
          <strong>${escapeHtml(businessName)}</strong>
          <span class="td-sub" style="font-size:12px; color:var(--muted);">${completedTxt}</span>
        </div>
        <div class="order-title" style="margin-top:6px;">${escapeHtml(itemsText)}</div>
        <div class="order-meta">
          <div>총 <strong>${o.totalUnits || 0}대</strong></div>
          <div>방문일 <strong>${escapeHtml(o.preferredDate)}</strong></div>
        </div>
        ${reportBlock}
        ${reviewBlock}
      </div>
    </div>`;
}

function renderPostCard(p) {
  const before = getBeforePhotos(p);
  const after = getAfterPhotos(p);
  const beforeHtml = before.map((src) =>
    `<div class="photo-thumb"><img src="${src}" alt="작업 전" data-zoom><div class="photo-tag">BEFORE</div></div>`
  ).join('');
  const afterHtml = after.map((src) =>
    `<div class="photo-thumb"><img src="${src}" alt="작업 후" data-zoom><div class="photo-tag photo-tag-after">AFTER</div></div>`
  ).join('');
  const createdTxt = p.createdAt ? formatDateTime(p.createdAt) : '방금 전';
  const canEdit = !!currentUser && (currentUser.role === 'admin' || currentUser.uid === p.authorUid);
  const editBtn = canEdit ? `<button class="btn btn-ghost btn-sm" data-edit-post="${p.id}">✏️ 수정</button>` : '';

  return `
    <div class="order-card card-post" style="grid-template-columns: 1fr;">
      <div>
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span class="badge post-badge">📝 게시물</span>
          ${p.acType ? `<span class="badge ac-badge">${escapeHtml(p.acType)}</span>` : ''}
          <strong>${escapeHtml(p.authorName || '사업자')}</strong>
          <span class="td-sub" style="font-size:12px; color:var(--muted);">${createdTxt}</span>
          <span style="margin-left:auto;">${editBtn}</span>
        </div>
        <div class="order-title" style="margin-top:6px;">${escapeHtml(p.title || '(제목 없음)')}</div>
        ${(before.length || after.length) ? `
          <div class="report-preview">
            <div class="report-photos">${beforeHtml}${afterHtml}</div>
            ${p.description ? `<div class="report-desc">${escapeHtml(p.description)}</div>` : ''}
          </div>` : (p.description ? `<div class="report-desc" style="margin-top:12px;">${escapeHtml(p.description)}</div>` : '')}
      </div>
    </div>`;
}

function renderStars(rating) {
  const r = Math.round(Number(rating) || 0);
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span class="star-icon ${i <= r ? 'on' : ''}">★</span>`;
  return s;
}

/* ================ 작성/수정 모달 ================ */

function initPhotoSlots() {
  postModal.querySelectorAll('.slot-grid').forEach((grid) => {
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

function fillSide(side, photos) {
  const slots = postModal.querySelectorAll(`.photo-slot[data-side="${side}"]`);
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
  const slots = postModal.querySelectorAll(`.photo-slot[data-side="${side}"]`);
  return Array.from(slots).map((s) => s.dataset.url).filter(Boolean);
}

function resetForm() {
  titleEl.value = '';
  acTypeEl.value = '';
  descEl.value = '';
  fillSide('before', []);
  fillSide('after', []);
}

function openModalCreate() {
  if (!currentUser) {
    showToast('로그인이 필요합니다.', 'error');
    return;
  }
  editingPostId = null;
  modalTitleEl.textContent = '작업 히스토리 작성';
  submitBtn.textContent = '등록';
  deleteBtn.classList.add('hidden');
  resetForm();
  postModal.classList.add('show');
}

function openModalEdit(postId) {
  const p = allPosts.find((x) => x.id === postId);
  if (!p) return;
  if (!currentUser) return;
  if (currentUser.role !== 'admin' && currentUser.uid !== p.authorUid) {
    showToast('이 게시물을 수정할 권한이 없습니다.', 'error');
    return;
  }
  editingPostId = postId;
  modalTitleEl.textContent = '게시물 수정';
  submitBtn.textContent = '저장';
  deleteBtn.classList.remove('hidden');
  titleEl.value = p.title || '';
  acTypeEl.value = p.acType || '';
  descEl.value = p.description || '';
  fillSide('before', getBeforePhotos(p));
  fillSide('after', getAfterPhotos(p));
  postModal.classList.add('show');
}

function closeModal() {
  postModal.classList.remove('show');
  editingPostId = null;
}

async function submitPost() {
  if (!currentUser) return;
  const title = titleEl.value.trim();
  const acType = acTypeEl.value;
  const description = descEl.value.trim();
  const beforePhotos = collectSide('before');
  const afterPhotos = collectSide('after');

  if (!title) { showToast('제목을 입력해 주세요.', 'error'); return; }
  if (!acType) { showToast('에어컨 종류를 선택해 주세요.', 'error'); return; }
  if (beforePhotos.length === 0 || afterPhotos.length === 0) {
    showToast('작업 전/후 사진을 각각 1장 이상 올려주세요.', 'error');
    return;
  }

  submitBtn.disabled = true;
  const orig = submitBtn.textContent;
  submitBtn.textContent = '저장 중...';
  try {
    if (editingPostId) {
      await updateWorkPost(editingPostId, { title, acType, description, beforePhotos, afterPhotos });
      showToast('게시물이 수정되었어요.', 'success');
    } else {
      await createWorkPost({
        title,
        acType,
        description,
        beforePhotos,
        afterPhotos,
        authorUid: currentUser.uid,
        authorRole: currentUser.role,
        authorName: currentUser.businessName || currentUser.email || '관리자',
      });
      showToast('게시물이 등록되었어요.', 'success');
    }
    closeModal();
  } catch (err) {
    console.error(err);
    showToast('저장에 실패했습니다.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = orig;
  }
}

async function deletePostHandler() {
  if (!editingPostId) return;
  if (!confirm('이 게시물을 삭제할까요? 되돌릴 수 없습니다.')) return;
  deleteBtn.disabled = true;
  try {
    await deleteWorkPost(editingPostId);
    showToast('게시물이 삭제되었어요.');
    closeModal();
  } catch (err) {
    showToast('삭제에 실패했습니다.', 'error');
  } finally {
    deleteBtn.disabled = false;
  }
}
