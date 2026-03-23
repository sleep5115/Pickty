# Lightsail: 인증서 업로드 + 서버에서 git pull + Docker Compose 재기동
#
# 실행 (PowerShell, 프로젝트 루트에서):
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned   # 최초 1회만
#   .\deploy-to-lightsail.ps1
#
# 환경 변수(선택):
#   $env:LIGHTSAIL_HOST   기본 13.209.94.184
#   $env:LIGHTSAIL_USER   기본 ubuntu
#   $env:LIGHTSAIL_KEY    SSH 개인키 전체 경로
#   $env:PICKTY_CONFIG_DIR pickty-config 폴더 전체 경로

$ErrorActionPreference = 'Stop'

function Write-Banner {
    Write-Host @"

╔══════════════════════════════════════════════════════════════════╗
║  Pickty → Lightsail 배포 스크립트 (certs scp + ssh docker)        ║
╚══════════════════════════════════════════════════════════════════╝

  사전 조건
  ---------
  • pickty-config\certs\cert.pem, key.pem 존재
  • SSH 키: lightsail.pem 또는 LightsailDefaultKey-ap-northeast-2.pem (또는 LIGHTSAIL_KEY)
  • 서버에 ~/Pickty 가 git clone 되어 있고 origin 에 푸시된 최신 코드가 있음

  실행
  ----
    cd Pickty
    .\deploy-to-lightsail.ps1

"@
}

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RemoteHost = if ($env:LIGHTSAIL_HOST) { $env:LIGHTSAIL_HOST } else { '13.209.94.184' }
$RemoteUser = if ($env:LIGHTSAIL_USER) { $env:LIGHTSAIL_USER } else { 'ubuntu' }

if ($env:PICKTY_CONFIG_DIR) {
    $PicktyConfig = (Resolve-Path $env:PICKTY_CONFIG_DIR).Path
} else {
    $PicktyConfig = (Resolve-Path (Join-Path $ScriptRoot '..\pickty-config')).Path
}

if ($env:LIGHTSAIL_KEY) {
    $KeyPath = $env:LIGHTSAIL_KEY
} else {
    $tryLightsail = Join-Path $PicktyConfig 'lightsail.pem'
    $tryDefault = Join-Path $PicktyConfig 'LightsailDefaultKey-ap-northeast-2.pem'
    if (Test-Path -LiteralPath $tryLightsail) {
        $KeyPath = $tryLightsail
    } elseif (Test-Path -LiteralPath $tryDefault) {
        $KeyPath = $tryDefault
    } else {
        $KeyPath = $tryLightsail
    }
}

$CertPem = Join-Path $PicktyConfig 'certs\cert.pem'
$KeyPem = Join-Path $PicktyConfig 'certs\key.pem'

Write-Banner

if (-not (Test-Path -LiteralPath $KeyPath)) {
    Write-Host "[오류] SSH 키를 찾을 수 없습니다: $KeyPath" -ForegroundColor Red
    Write-Host "       lightsail.pem 으로 복사하거나 LIGHTSAIL_KEY 를 설정하세요."
    exit 1
}

if (-not (Test-Path -LiteralPath $CertPem) -or -not (Test-Path -LiteralPath $KeyPem)) {
    Write-Host "[오류] 인증서를 찾을 수 없습니다." -ForegroundColor Red
    Write-Host "       필요: $CertPem"
    Write-Host "             $KeyPem"
    exit 1
}

# Windows OpenSSH: 키 권한이 너무 넓으면 거부될 수 있음
try {
    icacls $KeyPath /inheritance:r | Out-Null
    icacls $KeyPath /grant:r "$env:USERNAME:(R)" | Out-Null
} catch {
    Write-Host "(참고) icacls 조정 실패 시 무시 가능: $_" -ForegroundColor DarkYellow
}

$SshOpts = @('-i', $KeyPath, '-o', 'StrictHostKeyChecking=accept-new')
$RemoteTarget = "${RemoteUser}@${RemoteHost}"

Write-Host "==> 대상: $RemoteTarget"
Write-Host "==> 원격 디렉터리 생성"
& ssh @SshOpts $RemoteTarget 'mkdir -p ~/Pickty/deploy/lightsail/certs'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> 인증서 업로드 (scp)"
& scp @SshOpts $CertPem $KeyPem "${RemoteTarget}:~/Pickty/deploy/lightsail/certs/"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> 원격: git pull + docker compose 재기동"
$RemoteScript = @'
set -euo pipefail
cd ~/Pickty
git pull
docker compose -f deploy/lightsail/docker-compose.api.yml down
docker compose -f deploy/lightsail/docker-compose.api.yml up -d --build
echo "==> 컨테이너 상태"
docker compose -f deploy/lightsail/docker-compose.api.yml ps
'@

$RemoteScript | & ssh @SshOpts $RemoteTarget bash -s
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host @"

✅ 배포 스크립트 완료.

  확인 예시:
    curl.exe -skS -o NUL -w "%{http_code}`n" https://$RemoteHost/api/v1/templates

  수동으로 꼭 할 일 (이 스크립트가 대신 못 함)
  --------------------------------------------
  • 코드 변경 후 GitHub 에 push (서버 git pull 이 받아감)
  • Lightsail 방화벽: TCP 8080 규칙 제거, TCP 443 열림 확인

"@
