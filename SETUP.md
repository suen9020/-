# MAIND (마인드) 셋업 가이드

웹 코드 외에 **Firebase 콘솔에서 직접 해야 하는 작업** 정리입니다.

---

## 1. Firebase Authentication

### (1) 이메일/비밀번호 인증 활성화
1. Firebase 콘솔 → **Authentication** → 시작하기
2. "Sign-in method" 탭 → **이메일/비밀번호** 활성화

### (2) 관리자 계정 만들기 (1회만)
1. Authentication → **Users** 탭 → **사용자 추가**
2. 이메일: `admin@tone-clean.com`
3. 비밀번호: (원하는 강한 비밀번호)
4. 추가하면 **사용자 UID**가 표시됩니다 → 복사해두기

---

## 2. Firestore 보안 규칙 적용

1. Firebase 콘솔 → **Firestore Database** → **Rules** 탭
2. 이 프로젝트의 `firestore.rules` 파일 내용 전체를 복사 → 붙여넣기
3. **게시(Publish)** 클릭

---

## 3. 관리자 사용자 문서 생성 (1회만)

규칙상 관리자 문서는 **콘솔에서 수동으로** 만들어야 합니다 (코드로는 못 만듦).

1. Firestore Database → **데이터** 탭
2. **컬렉션 시작** → 컬렉션 ID: `users`
3. 문서 ID: 위 1-(2)에서 복사한 **관리자 UID**
4. 필드 추가:
   - `role` (string): `admin`
   - `status` (string): `active`
   - `email` (string): `admin@tone-clean.com`
   - `createdAt` (timestamp): 현재 시각
5. 저장

---

## 4. 동작 테스트

### 사업자 흐름
1. `signup.html` 접속 → 사업자 정보 입력 → 가입
2. 자동 로그아웃 + "관리자 승인 후 로그인 가능" 안내
3. 관리자 페이지에서 승인 → 사업자가 다시 로그인하면 대시보드 진입

### 관리자 흐름
1. `login.html` 접속 → admin@tone-clean.com 로그인
2. `admin.html` 자동 진입
3. 사업자 관리 / 전체 오더 / 사업자별 실적 / 매출 분석 4개 탭 확인

### 고객 흐름
1. `index.html` → 청소 예약 → Firestore에 저장됨
2. 예약 조회는 전화번호로 검색

---

## 5. 로컬 실행

`file://`로 직접 열면 ES module 보안 정책상 안 됩니다. 간단 서버:

```bash
# Python 3
python -m http.server 8000

# 또는 Node
npx serve .
```

브라우저에서 `http://localhost:8000/` 접속.

---

## 6. 데이터 모델 요약

```
users/{uid}
  role: 'admin' | 'business'
  status: 'pending' | 'active' | 'rejected'
  businessName, ownerName, phone, email
  createdAt

orders/{orderId}
  customerName, phone, phoneNormalized, address
  items: [{type, count}]
  preferredDate, preferredTime, notes
  estimate          // 고객 결제액
  totalUnits        // 에어컨 총 대수
  commission        // = totalUnits × 10,000원 (관리자 수수료)
  status: '대기' | '수락' | '진행중' | '완료' | '취소'
  acceptedBy: { uid, businessName } | null
  displayId         // 'AC-YYMMDD-####' (UI 표시용)
  createdAt, acceptedAt, completedAt
```

수수료는 **에어컨 1대당 10,000원**, 사업자 정산액 = `estimate - commission`.
