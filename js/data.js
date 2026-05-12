import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  runTransaction,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from './firebase.js';
import { calcTotal, calcTotalUnits, calcCommission, generateDisplayId, normalizePhone, PRICE_TABLE, TIME_TABLE } from './utils.js';

export const ORDER_STATUSES = ['대기', '수락', '진행중', '완료', '취소'];

export async function createOrder(payload) {
  // 신규 단일 모델 흐름: airconType + brand + count
  // 호환을 위해 items[] 배열로도 함께 저장
  const airconType = payload.airconType;
  const brand = payload.brand || null;
  const count = Math.max(1, Number(payload.count) || 1);
  const unitPrice = PRICE_TABLE[airconType] || 0;
  const estimatedTime = TIME_TABLE[airconType] || 0;
  const items = [{ type: airconType, count, brand }];

  const order = {
    customerName: payload.customerName,
    phone: payload.phone,
    phoneNormalized: normalizePhone(payload.phone),
    address: payload.address,
    // 단일 필드 (사용자 요청 스키마)
    airconType,
    brand,
    count,
    estimatedTime,            // 분 단위 (1대 기준)
    price: unitPrice,         // 1대 기준 가격
    // 호환 필드
    items,
    preferredDate: payload.preferredDate,
    preferredTime: payload.preferredTime,
    notes: payload.notes || '',
    estimate: calcTotal(items),
    totalUnits: calcTotalUnits(items),
    commission: calcCommission(items),
    status: '대기',
    displayId: generateDisplayId(),
    acceptedBy: null,
    acceptedAt: null,
    completedAt: null,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'orders'), order);
  return { id: ref.id, ...order };
}

export async function findOrdersByPhone(phone) {
  const target = normalizePhone(phone);
  if (!target) return [];
  const q = query(collection(db, 'orders'), where('phoneNormalized', '==', target));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });
  return list;
}

export function subscribeOrders(callback, filter = {}) {
  let q = collection(db, 'orders');
  const constraints = [];
  if (filter.status) constraints.push(where('status', '==', filter.status));
  if (filter.acceptedByUid) constraints.push(where('acceptedBy.uid', '==', filter.acceptedByUid));
  if (constraints.length) q = query(q, ...constraints);

  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
    callback(list);
  });
}

export async function acceptOrder(orderId, businessUser) {
  const ref = doc(db, 'orders', orderId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('주문이 존재하지 않습니다.');
    const data = snap.data();
    if (data.status !== '대기') {
      throw new Error('이미 다른 사업자가 수락했거나 처리된 오더입니다.');
    }
    tx.update(ref, {
      status: '수락',
      acceptedBy: { uid: businessUser.uid, businessName: businessUser.businessName },
      acceptedAt: serverTimestamp(),
    });
  });
}

export async function setOrderStatus(orderId, status, extra = {}) {
  const ref = doc(db, 'orders', orderId);
  const patch = { status, ...extra };
  if (status === '완료') patch.completedAt = serverTimestamp();
  await updateDoc(ref, patch);
}

export async function addReview(orderId, { rating, comment }) {
  const ref = doc(db, 'orders', orderId);
  await updateDoc(ref, {
    review: {
      rating: Number(rating),
      comment: String(comment || '').slice(0, 500),
      createdAt: new Date().toISOString(),
    },
    reviewedAt: serverTimestamp(),
  });
}

export async function saveWorkReport(orderId, { beforePhotos = [], afterPhotos = [], description, uploader }, completeOrder = false) {
  const ref = doc(db, 'orders', orderId);
  const patch = {
    workReport: {
      beforePhotos: beforePhotos.filter(Boolean).slice(0, 4),
      afterPhotos: afterPhotos.filter(Boolean).slice(0, 4),
      description: String(description || '').slice(0, 1000),
      uploadedAt: new Date().toISOString(),
      uploadedBy: {
        uid: uploader.uid,
        name: uploader.name,
        role: uploader.role,
      },
    },
  };
  if (completeOrder) {
    patch.status = '완료';
    patch.completedAt = serverTimestamp();
  }
  await updateDoc(ref, patch);
}

/* 구버전 단일 필드(beforePhoto/afterPhoto)도 호환되게 배열로 정규화 */
export function getBeforePhotos(wr) {
  if (!wr) return [];
  if (Array.isArray(wr.beforePhotos)) return wr.beforePhotos.filter(Boolean);
  if (wr.beforePhoto) return [wr.beforePhoto];
  return [];
}
export function getAfterPhotos(wr) {
  if (!wr) return [];
  if (Array.isArray(wr.afterPhotos)) return wr.afterPhotos.filter(Boolean);
  if (wr.afterPhoto) return [wr.afterPhoto];
  return [];
}

export function subscribeCompletedReviews(callback) {
  const q = query(collection(db, 'orders'), where('status', '==', '완료'));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => {
      const ta = a.completedAt?.toMillis ? a.completedAt.toMillis() : 0;
      const tb = b.completedAt?.toMillis ? b.completedAt.toMillis() : 0;
      return tb - ta;
    });
    callback(list);
  });
}

/* ---------- Users ---------- */

export async function createBusinessUserDoc(uid, info) {
  await setDoc(doc(db, 'users', uid), {
    role: 'business',
    status: 'pending',
    email: info.email,
    businessName: info.businessName,
    ownerName: info.ownerName,
    phone: info.phone,
    bizRegNo: info.bizRegNo,
    createdAt: serverTimestamp(),
  });
}

export async function getUserDoc(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export function subscribeBusinesses(callback) {
  const q = query(collection(db, 'users'), where('role', '==', 'business'));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    list.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
    callback(list);
  });
}

export async function setBusinessStatus(uid, status) {
  await updateDoc(doc(db, 'users', uid), { status });
}

export async function deleteBusinessUser(uid) {
  await deleteDoc(doc(db, 'users', uid));
}

/* ---------- Work Posts (자유 게시물) ---------- */

export async function createWorkPost(post) {
  const ref = await addDoc(collection(db, 'workPosts'), {
    title: String(post.title || '').slice(0, 100),
    acType: post.acType || '',
    description: String(post.description || '').slice(0, 1000),
    beforePhotos: (post.beforePhotos || []).filter(Boolean).slice(0, 4),
    afterPhotos: (post.afterPhotos || []).filter(Boolean).slice(0, 4),
    authorUid: post.authorUid,
    authorRole: post.authorRole,
    authorName: post.authorName,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateWorkPost(postId, updates) {
  const ref = doc(db, 'workPosts', postId);
  await updateDoc(ref, {
    title: String(updates.title || '').slice(0, 100),
    acType: updates.acType || '',
    description: String(updates.description || '').slice(0, 1000),
    beforePhotos: (updates.beforePhotos || []).filter(Boolean).slice(0, 4),
    afterPhotos: (updates.afterPhotos || []).filter(Boolean).slice(0, 4),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteWorkPost(postId) {
  await deleteDoc(doc(db, 'workPosts', postId));
}

export function subscribeWorkPosts(callback) {
  const q = query(collection(db, 'workPosts'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
