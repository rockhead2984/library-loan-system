-- order_workload_serializable.sql  
BEGIN ISOLATION LEVEL SERIALIZABLE;
UPDATE books SET like_count = like_count + 1 WHERE id = (random() * 999 + 1)::int;
COMMIT;