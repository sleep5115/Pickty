#!/usr/bin/env bash
# Lightsail: 인증서 업로드 + 서버에서 git pull + Docker Compose 재기동
#
# 실행: Git Bash / WSL / macOS/Linux
#   cd /path/to/Pickty && chmod +x deploy-to-lightsail.sh && ./deploy-to-lightsail.sh
#
# 환경 변수(선택):
#   LIGHTSAIL_HOST   기본 13.209.94.184
#   LIGHTSAIL_USER   기본 ubuntu
#   LIGHTSAIL_KEY    SSH 개인키 경로 (미설정 시 lightsail.pem → LightsailDefaultKey-ap-northeast-2.pem 순으로 탐색)
#   PICKTY_CONFIG_DIR pickty-config 루트 (기본: 이 스크립트 기준 ../pickty-config)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_HOST="${LIGHTSAIL_HOST:-13.209.94.184}"
REMOTE_USER="${LIGHTSAIL_USER:-ubuntu}"
PICKTY_CONFIG="${PICKTY_CONFIG_DIR:-$SCRIPT_DIR/../pickty-config}"
PICKTY_CONFIG="$(cd "$PICKTY_CONFIG" && pwd)"

if [[ -n "${LIGHTSAIL_KEY:-}" ]]; then
  KEY_PATH="$LIGHTSAIL_KEY"
elif [[ -f "$PICKTY_CONFIG/lightsail.pem" ]]; then
  KEY_PATH="$PICKTY_CONFIG/lightsail.pem"
elif [[ -f "$PICKTY_CONFIG/LightsailDefaultKey-ap-northeast-2.pem" ]]; then
  KEY_PATH="$PICKTY_CONFIG/LightsailDefaultKey-ap-northeast-2.pem"
else
  KEY_PATH="$PICKTY_CONFIG/lightsail.pem"
fi

CERT_SRC="$PICKTY_CONFIG/certs/cert.pem"
KEY_SRC="$PICKTY_CONFIG/certs/key.pem"

usage_banner() {
  cat <<'EOF'

╔══════════════════════════════════════════════════════════════════╗
║  Pickty → Lightsail 배포 스크립트 (certs scp + ssh docker)        ║
╚══════════════════════════════════════════════════════════════════╝

  사전 조건
  ─────────
  • pickty-config/certs/cert.pem, key.pem 존재
  • SSH 키: lightsail.pem 또는 LightsailDefaultKey-ap-northeast-2.pem (또는 LIGHTSAIL_KEY)
  • 서버에 ~/Pickty 가 git clone 되어 있고 origin 에 푸시된 최신 코드가 있음

  실행
  ────
    cd Pickty
    chmod +x deploy-to-lightsail.sh
    ./deploy-to-lightsail.sh

  (PowerShell 사용자는 deploy-to-lightsail.ps1 사용)

EOF
}

if [[ ! -f "$KEY_PATH" ]]; then
  usage_banner
  echo "[오류] SSH 키를 찾을 수 없습니다: $KEY_PATH"
  echo "       lightsail.pem 으로 복사하거나 LIGHTSAIL_KEY 를 설정하세요."
  exit 1
fi

if [[ ! -f "$CERT_SRC" || ! -f "$KEY_SRC" ]]; then
  usage_banner
  echo "[오류] 인증서를 찾을 수 없습니다."
  echo "       필요: $CERT_SRC"
  echo "             $KEY_SRC"
  exit 1
fi

chmod 600 "$KEY_PATH" 2>/dev/null || true

SSH_BASE=(ssh -i "$KEY_PATH" -o StrictHostKeyChecking=accept-new)
SCP_BASE=(scp -i "$KEY_PATH" -o StrictHostKeyChecking=accept-new)

usage_banner

echo "==> 대상: ${REMOTE_USER}@${REMOTE_HOST}"
echo "==> 원격 디렉터리 생성: ~/Pickty/deploy/lightsail/certs"
"${SSH_BASE[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p ~/Pickty/deploy/lightsail/certs"

echo "==> 인증서 업로드 (scp)"
"${SCP_BASE[@]}" "$CERT_SRC" "$KEY_SRC" "${REMOTE_USER}@${REMOTE_HOST}:~/Pickty/deploy/lightsail/certs/"

echo "==> 원격: git pull + docker compose 재기동"
"${SSH_BASE[@]}" "${REMOTE_USER}@${REMOTE_HOST}" 'bash -s' <<'REMOTE'
set -euo pipefail
cd ~/Pickty
git pull
docker compose -f deploy/lightsail/docker-compose.api.yml down --remove-orphans
docker compose -f deploy/lightsail/docker-compose.api.yml up -d --build
echo "==> 컨테이너 상태"
docker compose -f deploy/lightsail/docker-compose.api.yml ps
REMOTE

cat <<EOF

✅ 배포 스크립트 완료.

  확인 예시 (서버 또는 로컬에서):
    curl -skS -o /dev/null -w '%{http_code}\\n' https://${REMOTE_HOST}/api/v1/templates

  수동으로 꼭 할 일 (이 스크립트가 대신 못 함)
  ─────────────────────────────────────────
  • 코드 변경 후 GitHub 에 push (서버 git pull 이 받아감)
  • Lightsail 방화벽: TCP 8080 규칙 제거, TCP 443 열림 확인

EOF
