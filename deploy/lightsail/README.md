# Lightsail — Spring API (Docker) + Nginx (HTTPS)

## 환경 분리 (요약)

| 환경 | 프로필 | DB / Valkey | 용도 |
|------|--------|-------------|------|
| 로컬 PC (Cursor) | `dev` | Lightsail `pickty_dev` + Valkey(dev) | 개발·실험 |
| Lightsail (`pickty.app`) | **`prod`** (Compose에서 고정) | `pickty_prod` + Valkey(prod) | 실서비스 |
| 로컬 Docker만 | `local` | PC Docker Postgres 등 | 오프라인 등 예외 |

**운영 배포:** `main` 브랜치에 push → GitHub Actions가 서버에서 `docker compose`로 기동하며, API는 항상 **`SPRING_PROFILES_ACTIVE=prod`** 입니다.  
`dev` 브랜치 push 는 배포되지 않습니다.

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

Cloudflare **Full (strict)** 를 쓰려면 **Origin Certificate**(또는 유효한 서버 인증서)가 필요합니다.

### 운영: GitHub Actions (권장)

워크플로 `.github/workflows/deploy-backend.yml` 가 서버에 접속할 때마다 아래 파일을 **Secrets 기준으로 다시 씁니다.**

- GitHub 저장소 **Settings → Secrets and variables → Actions** 에 다음을 등록합니다.
  - `LIGHTSAIL_HOST` — 예: `13.x.x.x` (또는 호스트명)
  - `LIGHTSAIL_USERNAME` — 예: `ubuntu`
  - `LIGHTSAIL_SSH_KEY` — Lightsail SSH private key **전체** (멀티라인 PEM)
  - `SSL_CERT` — Origin 인증서 **전체** (멀티라인 PEM, 체인 포함 권장)
  - `SSL_KEY` — 개인키 **전체** (멀티라인 PEM)

멀티라인 Secret 은 GitHub UI 에 그대로 붙여 넣으면 됩니다. 배포 후 서버 경로는 `~/Pickty/deploy/lightsail/certs/{cert.pem,key.pem}` 입니다.

> PEM 이 잘리면 Nginx 가 기동 실패할 수 있습니다. 그 경우 Secret 을 base64 로 넣고 워크플로에서 `base64 -d` 로 디코드하도록 바꾸는 방법도 있습니다.

### 수동 배포·복구 시 (scp)

```bash
mkdir -p ~/Pickty/deploy/lightsail/certs
scp cert.pem key.pem ubuntu@HOST:~/Pickty/deploy/lightsail/certs/
chmod 644 ~/Pickty/deploy/lightsail/certs/cert.pem
chmod 600 ~/Pickty/deploy/lightsail/certs/key.pem
```

**주의:** `certs/`·`*.pem` 은 **Git 에 커밋하지 마세요.**

## 4. CI/CD — GitHub Actions

- **트리거:** `main` 브랜치에 **push** 할 때만 실행됩니다.
- **동작:** SSH 로 서버에 접속 → TLS 파일 갱신 → `git pull origin main` → `docker compose ... down --remove-orphans` → `up -d --build`
- 서버의 `~/Pickty` 는 **원격 `origin` 의 `main`** 을 추적하도록 clone 되어 있어야 하며, `git pull` 이 되도록 **deploy key** 또는 자격 증명이 서버에 설정되어 있어야 합니다.

로컬에서 직접 띄울 때만:

```bash
cd ~/Pickty
docker compose -f deploy/lightsail/docker-compose.api.yml up -d --build
```

- **외부 포트:** Nginx 만 **443**.
- **API** 는 호스트 **8080 미바인딩**, Nginx → `http://pickty-api:8080` 만 사용.

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
