import { login, onAuthChange } from './auth.js';
import { showToast } from './utils.js';

const form = document.getElementById('login-form');
const submitBtn = document.getElementById('submit-btn');

onAuthChange((profile) => {
  if (!profile) return;
  if (profile.role === 'admin') location.replace('admin.html');
  else if (profile.role === 'business') location.replace('business.html');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = form.email.value.trim();
  const password = form.password.value;
  if (!email || !password) {
    showToast('이메일과 비밀번호를 입력하세요.', 'error');
    return;
  }
  submitBtn.disabled = true;
  submitBtn.textContent = '로그인 중...';
  try {
    await login(email, password);
  } catch (err) {
    showToast(translateAuthError(err.code), 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = '로그인';
  }
});

function translateAuthError(code) {
  const map = {
    'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/user-not-found': '등록되지 않은 이메일입니다.',
    'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
    'auth/too-many-requests': '잠시 후 다시 시도해 주세요.',
    'auth/network-request-failed': '네트워크 오류입니다.',
  };
  return map[code] || '로그인에 실패했습니다.';
}
