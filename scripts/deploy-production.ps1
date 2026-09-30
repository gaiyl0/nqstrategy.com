[CmdletBinding()]
param(
  [string]$Server = "136.85.76.222",
  [string]$SshUser = "g0231627",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\nexus_quant_gcp_ed25519",
  [string]$Domain = "https://nqstrategy.com",
  [string]$RemoteBranch = "main",
  [switch]$SkipTests,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

function Invoke-Checked([string]$Label, [scriptblock]$Command) {
  Write-Host "`n==> $Label" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE" }
}

foreach ($tool in @("git", "ssh", "scp")) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Required command is unavailable: $tool" }
}
if (-not (Test-Path -LiteralPath $KeyPath -PathType Leaf)) { throw "SSH private key not found: $KeyPath" }
if ($Server -notmatch '^[A-Za-z0-9.-]+$') { throw "Invalid server name" }
if ($SshUser -notmatch '^[A-Za-z_][A-Za-z0-9_-]*$') { throw "Invalid SSH user" }
if ($RemoteBranch -notmatch '^[A-Za-z0-9._/-]+$') { throw "Invalid remote branch" }
if ($Domain -notmatch '^https://[A-Za-z0-9.-]+(?::[0-9]+)?$') { throw "Domain must be an HTTPS origin without a path" }

$dirty = git status --porcelain
if ($LASTEXITCODE -ne 0) { throw "Unable to inspect Git status" }
if ($dirty) { throw "Git worktree is not clean. Commit or discard changes before production deployment." }

Invoke-Checked "Fetch origin/$RemoteBranch" { git fetch origin $RemoteBranch }
$localCommit = (git rev-parse HEAD).Trim()
$remoteCommit = (git rev-parse "origin/$RemoteBranch").Trim()
if ($localCommit -ne $remoteCommit) {
  throw "Local HEAD ($localCommit) does not match origin/$RemoteBranch ($remoteCommit). Push or update the branch first."
}

if (-not $SkipTests) {
  Invoke-Checked "ESLint" { npm run lint }
  Invoke-Checked "Complete test suite" { npm run test:all }
}

$releaseId = $localCommit.Substring(0, 12)
$tempRoot = [System.IO.Path]::GetTempPath()
$archive = Join-Path $tempRoot "nexus-quant-$releaseId.tar.gz"
$remoteArchive = "/tmp/nexus-quant-$releaseId.tar.gz"
$remoteScript = "/tmp/nexus-deploy-$releaseId.sh"
$destination = "$SshUser@$Server"

if ($DryRun) {
  Write-Host "`nDry run passed." -ForegroundColor Green
  Write-Host "Commit: $localCommit"
  Write-Host "Target: $destination"
  Write-Host "Release: /opt/nexus-quant/releases/$releaseId"
  exit 0
}

try {
  Invoke-Checked "Create release archive" { git archive --format=tar.gz -o $archive $localCommit }
  Invoke-Checked "Upload release archive" { scp -i $KeyPath -o StrictHostKeyChecking=accept-new $archive "${destination}:$remoteArchive" }
  Invoke-Checked "Upload server deployment runner" { scp -i $KeyPath -o StrictHostKeyChecking=accept-new "$PSScriptRoot/deploy-release.sh" "${destination}:$remoteScript" }
  Invoke-Checked "Deploy and verify production" {
    ssh -i $KeyPath -o StrictHostKeyChecking=accept-new $destination "sudo bash $remoteScript $releaseId $remoteArchive $Domain"
  }
} finally {
  if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
}

Write-Host "`nProduction deployment completed." -ForegroundColor Green
Write-Host "Commit: $localCommit"
Write-Host "URL: $Domain"

