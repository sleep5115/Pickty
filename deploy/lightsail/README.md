# Lightsail — Spring API (Docker)

## 1. 인프라 네트워크

Postgres·Valkey 는 `~/pickty-infra` 의 Compose 로 띄운 뒤, 네트워크 이름이 **`pickty-infra_default`** 인지 확인합니다.

```bash
docker network ls | grep pickty-infra
```

다르면 `docker-compose.api.yml` 의 `networks` 이름을 맞춥니다.

## 2. 비밀 설정 (레포에 올리지 말 것)

`pickty-config` 의 `application-secrets.yaml` 을 이 폴더에 복사합니다.

```bash
cp /path/to/pickty-config/application-secrets.yaml ./application-secrets.yaml
# 컨테이너 내 비루트 사용자가 읽을 수 있어야 함(너무 좁으면 Permission denied)
chmod 644 application-secrets.yaml
```

`docker-compose.api.yml` 이 `DB_HOST` / `VALKEY_*` 를 컨테이너용으로 덮어씁니다. OAuth·JWT·R2·`FRONTEND_URL` 등은 yaml 에서 읽습니다.

## 3. 빌드 및 기동

레포 클론 디렉터리(예: `~/Pickty`)에서:

```bash
docker compose -f deploy/lightsail/docker-compose.api.yml up -d --build
```

## 4. 방화벽

Lightsail **네트워킹**에서 API 를 공인으로 열려면 **TCP 8080** 허용이 필요할 수 있습니다. Cloudflare 등 프록시 뒤에서만 접근한다면 출구/터널 정책에 맞게 조정합니다.

## 5. 확인

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/api/v1/templates
```

(200 또는 빈 목록이면 앱 기동됨. 000 이면 기동 실패 — `docker logs pickty-api`.)
