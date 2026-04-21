-- pickty 는 compose 의 POSTGRES_DB 로 이미 생성됨
-- 단일 인스턴스·다중 DB 운용용 (로컬 compose / Lightsail 수동 생성 동일 개념)
DO
$do$
BEGIN
	IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'pickty_dev') THEN
		CREATE DATABASE pickty_dev;
	END IF;
	IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'pickty_prod') THEN
		CREATE DATABASE pickty_prod;
	END IF;
END
$do$;
