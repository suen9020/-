import { signupBusiness, logout } from './auth.js';
import { showToast } from './utils.js';

const form = document.getElementById('signup-form');
const submitBtn = document.getElementById('submit-btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const businessName = form.businessName.value.trim();
  const ownerName = form.ownerName.value.trim();
  const phone = form.phone.value.trim();
  const bizRegNo = form.bizRegNo.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const password2 = form.password2.value;

  if (!businessName || !ownerName || !phone || !bizRegNo || !email || !password) {
    showToast('필수 항목을 모두 입력해 주세요.', 'error');
    return;
  }
  if (!/^[0-9-+\s()]{8,20}$/.test(phone)) {
    showToast('연락처 형식을 확인해 주세요.', 'error');
    return;
  }
  const bizDigits = bizRegNo.replace(/[^0-9]/g, '');
  if (bizDigits.length !== 10 && bizDigits.length !== 13) {
    showToast('사업자등록번호(10자리) 또는 법인등록번호(13자리)를 정확히 입력해 주세요.', 'error');
    return;
  }
  if (password.length < 6) {
    showToast('비밀번호는 최소 6자 이상이어야 합니다.', 'error');
    return;
  }
  if (password !== password2) {
    showToast('비밀번호가 일치하지 않습니다.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '가입 처리 중...';
  try {
    await signupBusiness({ email, password, businessName, ownerName, phone, bizRegNo });
    await logout();
    alert('가입 신청이 접수되었습니다.\n관리자 승인 후 로그인하실 수 있어요.');
    location.replace('login.html');
  } catch (err) {
    showToast(translateAuthError(err.code), 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = '가입 신청';
  }
});

function translateAuthError(code) {
  const map = {
    'auth/email-already-in-use': '이미 가입된 이메일입니다.',
    'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
    'auth/weak-password': '비밀번호가 너무 약합니다 (6자 이상).',
    'auth/network-request-failed': '네트워크 오류입니다.',
  };
  return map[code] || '가입에 실패했습니다.';
}
