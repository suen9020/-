import { subscribeCompletedReviews } from './data.js';

const grid = document.getElementById('counter-grid');
const els = {
  done: grid.querySelector('[data-counter="done"]'),
  reviews: grid.querySelector('[data-counter="reviews"]'),
  rating: grid.querySelector('[data-counter="rating"]'),
  units: grid.querySelector('[data-counter="units"]'),
};

let targets = { done: 0, reviews: 0, rating: 0, units: 0 };
let hasAnimated = false;
let dataLoaded = false;

subscribeCompletedReviews((list) => {
  const reviewed = list.filter((o) => o.review);
  const ratings = reviewed.map((o) => Number(o.review.rating) || 0);
  const avgRating = ratings.length ? ratings.reduce((s, n) => s + n, 0) / ratings.length : 0;
  const totalUnits = list.reduce((s, o) => s + (o.totalUnits || 0), 0);

  targets = {
    done: list.length,
    reviews: reviewed.length,
    rating: avgRating,
    units: totalUnits,
  };
  dataLoaded = true;
  // 이미 애니메이션 끝난 상태에서 데이터 갱신 시 즉시 반영
  if (hasAnimated) applyTargetsImmediately();
  else if (sectionVisible) startAnimation();
});

let sectionVisible = false;
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        sectionVisible = true;
        if (dataLoaded && !hasAnimated) startAnimation();
        observer.disconnect();
      }
    });
  },
  { threshold: 0.3 }
);
observer.observe(document.getElementById('stats-hero'));

function startAnimation() {
  hasAnimated = true;
  animate(els.done, 0, targets.done, 1500, 0);
  animate(els.reviews, 0, targets.reviews, 1500, 0);
  animate(els.rating, 0, targets.rating, 1700, 1);
  animate(els.units, 0, targets.units, 1500, 0, '대');
}

function applyTargetsImmediately() {
  els.done.textContent = format(targets.done, 0);
  els.reviews.textContent = format(targets.reviews, 0);
  els.rating.textContent = targets.reviews > 0 ? format(targets.rating, 1) : '-';
  els.units.textContent = format(targets.units, 0) + '대';
}

function animate(el, from, to, duration, decimals, suffix = '') {
  if (el === els.rating && targets.reviews === 0) {
    el.textContent = '-';
    return;
  }
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const v = from + (to - from) * eased;
    el.textContent = format(v, decimals) + suffix;
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = format(to, decimals) + suffix;
  }
  requestAnimationFrame(tick);
}

function format(v, decimals) {
  if (decimals > 0) return Number(v).toFixed(decimals);
  return Math.floor(v).toLocaleString('ko-KR');
}
