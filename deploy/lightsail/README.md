# Lightsail — Spring API (Docker) + Nginx (HTTPS)

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

## 3. TLS 인증서 (Cloudflare Full Strict)

Cloudflare **Full (strict)** 를 쓰려면 **Origin Certificate**(또는 Lightsail 에 올린 유효한 서버 인증서)가 필요합니다.

1. 이 디렉터리 아래에 **`certs/`** 폴더를 만듭니다.
2. 그 안에 다음 두 파일을 둡니다 (이름·경로는 Nginx 설정과 동일해야 함).
   - `cert.pem` — 인증서(체인 포함 권장)
   - `key.pem` — 개인키

로컬에서 `pickty-config` 에 이미 두었다면, 서버 배포 시 예시는 다음과 같습니다.

```bash
# 서버의 deploy/lightsail 에서
mkdir -p certs
scp user@local:~/CursorProjects/pickty-config/certs/cert.pem ./certs/
scp user@local:~/CursorProjects/pickty-config/certs/key.pem ./certs/
chmod 644 certs/cert.pem
chmod 600 certs/key.pem
```

**주의:** `certs/`·`key.pem` 은 **Git 에 커밋하지 마세요.** (`.gitignore` 에 포함하는 것을 권장합니다.)

## 4. 빌드 및 기동

레포 클론 디렉터리(예: `~/Pickty`)에서:

```bash
docker compose -f deploy/lightsail/docker-compose.api.yml up -d --build
```

- **외부로 열리는 포트:** Nginx 만 **443** (호스트 `443:443`).
- **API 컨테이너(`pickty-api`)** 는 **8080 을 호스트에 바인딩하지 않습니다.** 접근은 Docker 네트워크 안에서 Nginx → `http://pickty-api:8080` 으로만 됩니다.

## 5. 방화벽

Lightsail **네트워킹**에서 공인으로 API 를 받으려면 **TCP 443** 을 허용합니다. **8080 은 외부에 열 필요 없습니다** (직접 노출 차단).

Cloudflare 프록시(오렌지 구름) 뒤라면, Origin 은 443 만 받고 방화벽은 필요에 따라 Cloudflare IP 대역만 허용하도록 조정할 수 있습니다.

## 6. 확인

서버에서 (인증서가 자체 서명/Origin 이면 `-k`):

```bash
curl -skS -o /dev/null -w '%{http_code}\n' https://127.0.0.1/api/v1/templates
```

또는 도메인으로:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://api.example.com/api/v1/templates
```

(200 또는 빈 목록이면 앱 기동됨. 000 이면 기동 실패 — `docker logs pickty-api`, `docker logs pickty-nginx`.)

### Nginx → Spring: 프록시 헤더

`deploy/lightsail/nginx.conf` 에서 다음을 설정합니다.

- `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`, `X-Forwarded-Port`, `X-Real-IP`

Spring Boot 에서 실제 스킴·클라이언트 IP 를 쓰려면 `application-prod` 등에 `server.forward-headers-strategy: framework` (또는 `native`) 설정이 필요할 수 있습니다.
