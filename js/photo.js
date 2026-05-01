/**
 * 브라우저에서 이미지 파일을 캔버스로 리사이즈/압축하여
 * data:image/jpeg;base64 문자열로 변환합니다. (Firestore 저장용)
 */
export const MAX_PHOTOS_PER_SIDE = 4;

export function compressImage(file, { maxWidth = 700, maxHeight = 700, quality = 0.7 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('이미지 파일만 업로드할 수 있습니다.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('파일 읽기에 실패했습니다.'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('이미지 디코딩에 실패했습니다.'));
      img.onload = () => {
        const ratio = Math.min(1, maxWidth / img.width, maxHeight / img.height);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function approxBase64Bytes(dataUrl) {
  if (!dataUrl) return 0;
  const i = dataUrl.indexOf(',');
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

export function openLightbox(src) {
  let bg = document.querySelector('.photo-lightbox');
  if (!bg) {
    bg = document.createElement('div');
    bg.className = 'photo-lightbox';
    bg.innerHTML = `<img alt="확대 이미지"><button class="lb-close" aria-label="닫기">×</button>`;
    document.body.appendChild(bg);
    bg.addEventListener('click', (e) => {
      if (e.target === bg || e.target.classList.contains('lb-close')) {
        bg.classList.remove('show');
      }
    });
  }
  bg.querySelector('img').src = src;
  bg.classList.add('show');
}
