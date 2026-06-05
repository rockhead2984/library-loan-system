-- 도서관 대출 관리 시스템 스키마
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS likes CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL,
    email       VARCHAR(100) UNIQUE NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE books (
    id               SERIAL PRIMARY KEY,
    title            VARCHAR(200) NOT NULL,
    author           VARCHAR(100) NOT NULL,
    isbn             VARCHAR(20) UNIQUE,
    total_copies     INT NOT NULL CHECK (total_copies >= 0),
    available_copies INT NOT NULL CHECK (available_copies >= 0),
    like_count       INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE loans (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id),
    book_id     INT NOT NULL REFERENCES books(id),
    loaned_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    due_date    TIMESTAMP NOT NULL,
    returned_at TIMESTAMP
);

CREATE TABLE likes (
    id        SERIAL PRIMARY KEY,
    user_id   INT NOT NULL REFERENCES users(id),
    book_id   INT NOT NULL REFERENCES books(id),
    liked_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, book_id)
);

CREATE INDEX idx_loans_user  ON loans(user_id);
CREATE INDEX idx_loans_book  ON loans(book_id);
CREATE INDEX idx_likes_book  ON likes(book_id);

-- 더미 데이터
INSERT INTO users (name, email) VALUES
 ('홍길동', 'hong@test.com'),
 ('김영희', 'kim@test.com'),
 ('이철수', 'lee@test.com');

INSERT INTO books (title, author, isbn, total_copies, available_copies) VALUES
 ('데이터베이스 시스템',         'Silberschatz', '978-0001', 3, 3),
 ('운영체제',                   'Tanenbaum',    '978-0002', 2, 2),
 ('머신러닝 입문',              'Bishop',       '978-0003', 4, 4),
 ('신호 및 시스템',             'Oppenheim',    '978-0004', 2, 2),
 ('클린 코드',                  'Robert Martin','978-0005', 5, 5);
