import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { auth } from './firebase.js';
import { createBusinessUserDoc, getUserDoc } from './data.js';

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

export async function signupBusiness({ email, password, businessName, ownerName, phone, bizRegNo }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await createBusinessUserDoc(cred.user.uid, { email, businessName, ownerName, phone, bizRegNo });
  return cred.user;
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }
    const profile = await getUserDoc(user.uid);
    callback(profile ? { ...profile, email: user.email } : null);
  });
}

/**
 * Page guard. Redirects according to role/status.
 * @param {'business'|'admin'} requiredRole
 * @returns Promise<profile> resolved when access is granted
 */
export function requireAuth(requiredRole) {
  return new Promise((resolve) => {
    onAuthChange((profile) => {
      if (!profile) {
        location.replace('login.html');
        return;
      }
      if (requiredRole === 'admin' && profile.role !== 'admin') {
        location.replace(profile.role === 'business' ? 'business.html' : 'index.html');
        return;
      }
      if (requiredRole === 'business') {
        if (profile.role === 'admin') {
          location.replace('admin.html');
          return;
        }
        if (profile.role !== 'business') {
          location.replace('index.html');
          return;
        }
        if (profile.status === 'pending') {
          renderPendingScreen(profile);
          return;
        }
        if (profile.status === 'rejected') {
          renderRejectedScreen(profile);
          return;
        }
      }
      resolve(profile);
    });
  });
}

function renderPendingScreen(profile) {
  document.body.innerHTML = `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; background:#f0f9ff;">
      <div class="modal" style="display:block; max-width:480px;">
        <div class="modal-icon" style="background:#fef3c7; color:#92400e;">⏳</div>
        <h3>관리자 승인 대기 중</h3>
        <p><strong>${profile.businessName || ''}</strong> 님,<br>가입 요청이 접수되었습니다.</p>
        <p style="font-size:13px; margin-top:12px;">관리자 승인이 완료되면 사업자 대시보드를 사용하실 수 있어요.</p>
        <div class="modal-actions" style="margin-top:24px;">
          <button class="btn btn-ghost" id="logout-btn">로그아웃</button>
          <a href="index.html" class="btn btn-primary">홈으로</a>
        </div>
      </div>
    </div>`;
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await logout();
    location.replace('login.html');
  });
}

function renderRejectedScreen() {
  document.body.innerHTML = `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; background:#f0f9ff;">
      <div class="modal" style="display:block; max-width:480px;">
        <div class="modal-icon" style="background:#fee2e2; color:#991b1b;">✕</div>
        <h3>승인이 거절된 계정입니다</h3>
        <p>자세한 사항은 관리자에게 문의해 주세요.</p>
        <div class="modal-actions" style="margin-top:24px;">
          <button class="btn btn-ghost" id="logout-btn">로그아웃</button>
        </div>
      </div>
    </div>`;
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await logout();
    location.replace('login.html');
  });
}
