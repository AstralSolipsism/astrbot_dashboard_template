param(
  [string]$OutputDir = "market-artifacts",
  [string]$ArtifactName = "astrbot-dashboard-template-dist.zip"
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptRoot
$distRoot = Join-Path $projectRoot "dist"
$artifactRoot = Join-Path $projectRoot $OutputDir
$artifactPath = Join-Path $artifactRoot $ArtifactName
$reportPath = Join-Path $artifactRoot "artifact-report.json"

Set-Location $projectRoot

& pnpm build
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

if (-not (Test-Path (Join-Path $distRoot "index.html"))) {
  throw "Build did not produce dist/index.html."
}

New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null

if (Test-Path $artifactPath) {
  Remove-Item -LiteralPath $artifactPath -Force
}

Compress-Archive -Path (Join-Path $distRoot "*") -DestinationPath $artifactPath -Force

$hash = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
$size = (Get-Item -LiteralPath $artifactPath).Length

$report = [ordered]@{
  artifact = [ordered]@{
    path = $artifactPath
    sha256 = $hash
    size = $size
  }
  registryHints = [ordered]@{
    artifactUrl = "UPLOAD_THIS_ZIP_TO_AN_IMMUTABLE_RELEASE_URL"
    sha256 = $hash
    size = $size
    sourceDirectory = "."
    packageManager = "pnpm"
    build = "pnpm build"
    dist = "dist"
  }
}

$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reportPath -Encoding UTF8

Write-Host "Artifact: $artifactPath"
Write-Host "SHA256:   $hash"
Write-Host "Size:     $size"
Write-Host "Report:   $reportPath"
