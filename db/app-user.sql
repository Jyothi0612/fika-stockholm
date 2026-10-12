-- The delivery service logs in as "delivery", not as root, and may only read the stockholm database.
-- '%' means it may connect from any host; the MySQL security group decides which hosts can actually reach 3306.
CREATE USER IF NOT EXISTS 'delivery'@'%' IDENTIFIED BY 'Fika@123';
GRANT SELECT ON stockholm.* TO 'delivery'@'%';
FLUSH PRIVILEGES;
