# 📚 도서관 대출 관리 시스템

PostgreSQL + Node.js(Express) + Vanilla JS 로 구현한 데이터베이스 과제 프로젝트.
**트랜잭션 격리수준(Isolation Level) 비교**가 핵심 포인트입니다.

---

## 1. 학습 목표 매핑

| 과제 요구사항       | 구현 위치 |
|--------------------|-----------|
| 웹 ↔ DBMS 연동      | `src/server.js` ↔ `pg` Pool |
| 릴레이션(Relation) | `db/schema.sql` 4개 테이블 (users, books, loans, likes) |
| 쿼리(Query)        | SELECT/JOIN/LIKE/INSERT/UPDATE 전반 |
| 트랜잭션 + 격리수준 | 좋아요(RC) vs 대출·반납(SER) |

---

## 2. 트랜잭션 격리수준 설계 ⭐ (핵심)

### 2-1. 좋아요 → `READ COMMITTED` (격리성 **약하게**)
- 좋아요 수는 비즈니스적으로 **정확히 1차이 나도 큰 문제 없음**
- 동시 요청이 많을 가능성이 높으므로 **처리량(throughput) 우선**
- PostgreSQL 기본값이지만 명시적으로 `BEGIN ISOLATION LEVEL READ COMMITTED` 선언

```sql
BEGIN ISOLATION LEVEL READ COMMITTED;
  INSERT INTO likes (user_id, book_id) VALUES ($1, $2);
  UPDATE books SET like_count = like_count + 1 WHERE id = $1;
COMMIT;
```

### 2-2. 대출 / 반납 → `SERIALIZABLE` (격리성 **강하게**)
- 재고(`available_copies`)가 **절대 음수가 되면 안 됨** → 정합성 최우선
- 동시에 마지막 1권을 두 사용자가 대출 시도하는 **Lost Update / Phantom Read** 방지
- 충돌 시 PostgreSQL이 `40001` (serialization_failure) 발생 → 서버에서 409 응답 후 재시도 유도

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
  SELECT available_copies FROM books WHERE id = $1;
  -- 검증
  INSERT INTO loans (...) VALUES (...);
  UPDATE books SET available_copies = available_copies - 1 WHERE id = $1;
COMMIT;
```

### 2-3. 한 줄 요약
> "데이터 정합성이 중요한 곳엔 강한 격리, 동시성이 중요한 곳엔 약한 격리"

---

## 3. ER 다이어그램 (텍스트)

```
users (id PK, name, email)
  │ 1
  │
  │ N        N         1
  └── loans ─────────── books (id PK, title, author, available_copies, like_count)
  │ N         N        1
  └── likes ───────────┘
```

---

## 4. 실행 방법

### 사전 준비
- Node.js 18+
- PostgreSQL 14+ (로컬에 `library` DB 생성)

```bash
createdb library
cp .env.example .env   # 비밀번호 수정
npm install
npm run initdb         # 스키마 + 더미데이터
npm start              # http://localhost:3000
```

---

## 5. 디렉토리 구조

```
library-db/
├─ db/schema.sql
├─ src/
│  ├─ server.js   ← API + 트랜잭션
│  ├─ db.js       ← pg Pool
│  └─ initdb.js
├─ public/        ← 프론트엔드
│  ├─ index.html
│  ├─ app.js
│  └─ style.css
├─ package.json
└─ README.md
```

---

## 6. API 명세

| Method | Path                          | 설명         | 격리수준        |
|--------|-------------------------------|--------------|-----------------|
| GET    | /api/books?q=                 | 도서 검색    | (조회)          |
| GET    | /api/users                    | 사용자 목록  | (조회)          |
| GET    | /api/users/:id/loans          | 내 대출 현황 | (조회)          |
| POST   | /api/books/:id/like           | 좋아요       | READ COMMITTED  |
| POST   | /api/loans                    | 대출         | SERIALIZABLE    |
| POST   | /api/loans/:id/return         | 반납         | SERIALIZABLE    |

## 7. 프로젝트 설명은 pdf로