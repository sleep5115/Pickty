# Pickty -> Lightsail: upload TLS certs, git pull, docker compose rebuild
# Run from Pickty repo root:  .\deploy-to-lightsail.ps1
# Optional env: LIGHTSAIL_HOST, LIGHTSAIL_USER, LIGHTSAIL_KEY, PICKTY_CONFIG_DIR

$ErrorActionPreference = 'Stop'

function Write-Banner {
    Write-Host ''
    Write-Host 'Pickty -> Lightsail deploy (scp certs + ssh docker)'
    Write-Host 'Requires: ../pickty-config/certs/cert.pem, key.pem'
    Write-Host 'SSH key: lightsail.pem or LightsailDefaultKey-ap-northeast-2.pem (or LIGHTSAIL_KEY)'
    Write-Host ''
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
    Write-Host "[ERROR] SSH key not found: $KeyPath" -ForegroundColor Red
    Write-Host 'Set LIGHTSAIL_KEY or add lightsail.pem under pickty-config.'
    exit 1
}

if (-not (Test-Path -LiteralPath $CertPem) -or -not (Test-Path -LiteralPath $KeyPem)) {
    Write-Host '[ERROR] cert.pem or key.pem missing under pickty-config\certs\' -ForegroundColor Red
    exit 1
}

try {
    # OpenSSH on Windows: key must not be overly world-readable
    icacls $KeyPath /inheritance:r | Out-Null
    icacls $KeyPath /grant:r "$($env:USERNAME):(R)" | Out-Null
} catch {
    Write-Host "(note) icacls: $_" -ForegroundColor DarkYellow
}

$SshOpts = @('-i', $KeyPath, '-o', 'StrictHostKeyChecking=accept-new')
$RemoteTarget = "${RemoteUser}@${RemoteHost}"

Write-Host "==> Target: $RemoteTarget"
Write-Host '==> mkdir remote certs dir'
& ssh @SshOpts $RemoteTarget 'mkdir -p ~/Pickty/deploy/lightsail/certs'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '==> scp cert.pem key.pem'
& scp @SshOpts $CertPem $KeyPem "${RemoteTarget}:~/Pickty/deploy/lightsail/certs/"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '==> remote: git pull + docker compose'
# Avoid piping multiline script from Windows PowerShell (CRLF breaks remote bash)
$RemoteCmd = 'cd ~/Pickty && git pull && docker compose -f deploy/lightsail/docker-compose.api.yml down --remove-orphans && docker compose -f deploy/lightsail/docker-compose.api.yml up -d --build && docker compose -f deploy/lightsail/docker-compose.api.yml ps'
& ssh @SshOpts $RemoteTarget $RemoteCmd
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'Done. Quick check (from this PC):'
Write-Host ('  curl.exe -skS -o NUL -w {0} https://{1}/api/v1/templates' -f '%{http_code}\n', $RemoteHost)
Write-Host 'Firewall: TCP 443 open, TCP 8080 closed.'
Write-Host ''
