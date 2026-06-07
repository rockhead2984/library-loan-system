-- order_workload.sql
BEGIN;
UPDATE books SET like_count = like_count + 1 WHERE id = (random() * 999 + 1)::int;
COMMIT;