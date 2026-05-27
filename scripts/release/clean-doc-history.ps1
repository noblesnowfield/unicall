param(
  [string]$RemoteUrl = "",
  [string]$Branch = "",
  [switch]$InstallTool,
  [switch]$Push,
  [switch]$PushAll,
  [switch]$PushTags,
  [switch]$ForceFilterRepo
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
  & git @GitArgs
  if ($LASTEXITCODE -ne 0) {
    throw "git 命令执行失败：git $($GitArgs -join ' ')"
  }
}

Write-Host "unicall doc/ 历史清理脚本" -ForegroundColor Yellow
Write-Host "这个脚本会重写 Git 历史，并可选择强制推送远程仓库。请确认其他协作者已知晓。"
Write-Host "建议先在本地备份当前仓库，或确认远程仓库可以被覆盖。"

$confirm = Read-Host "确认继续请输入 CLEAN_DOC_HISTORY"
if ($confirm -ne "CLEAN_DOC_HISTORY") {
  Write-Host "已取消。"
  exit 0
}

Write-Step "确认当前目录是 Git 仓库根目录"
$repoRoot = (& git rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "当前目录不是 Git 仓库，请在 unicall 项目根目录运行。"
}

Set-Location $repoRoot
Write-Host "仓库根目录：$repoRoot"

if ([string]::IsNullOrWhiteSpace($Branch)) {
  $Branch = (& git branch --show-current).Trim()
}
if ([string]::IsNullOrWhiteSpace($Branch)) {
  throw "无法识别当前分支，请用 -Branch main 或 -Branch master 指定。"
}
Write-Host "目标分支：$Branch"

if ([string]::IsNullOrWhiteSpace($RemoteUrl)) {
  $RemoteUrl = (& git remote get-url origin 2>$null).Trim()
}
if ([string]::IsNullOrWhiteSpace($RemoteUrl)) {
  $RemoteUrl = Read-Host "请输入清理后要重新绑定的 origin 远程仓库地址"
}
if ([string]::IsNullOrWhiteSpace($RemoteUrl)) {
  throw "远程仓库地址不能为空。"
}
Write-Host "远程仓库：$RemoteUrl"

Write-Step "检查工作区是否干净"
$status = (& git status --short) -join "`n"
if (-not [string]::IsNullOrWhiteSpace($status)) {
  Write-Host $status
  throw "工作区存在未提交变更。请先提交或暂存，再重新运行脚本。"
}

Write-Step "检查 git-filter-repo"
$hasFilterRepo = $true
& git filter-repo --version *> $null
if ($LASTEXITCODE -ne 0) {
  $hasFilterRepo = $false
}

if (-not $hasFilterRepo) {
  if (-not $InstallTool) {
    throw "未找到 git-filter-repo。请先运行：python -m pip install git-filter-repo，或用 -InstallTool 让脚本安装。"
  }

  Write-Host "正在安装 git-filter-repo..."
  & python -m pip install git-filter-repo
  if ($LASTEXITCODE -ne 0) {
    throw "git-filter-repo 安装失败，请检查 Python/pip 环境。"
  }
}

Write-Step "将 doc/ 写入 .gitignore 并提交"
$gitignorePath = Join-Path $repoRoot ".gitignore"
if (-not (Test-Path $gitignorePath)) {
  New-Item -Path $gitignorePath -ItemType File | Out-Null
}

$gitignoreLines = Get-Content -Path $gitignorePath -Encoding UTF8
if ($gitignoreLines -notcontains "doc/") {
  Add-Content -Path $gitignorePath -Value "doc/" -Encoding UTF8
  Invoke-Git add .gitignore
  Invoke-Git commit -m "chore: 忽略本地 doc 文档目录"
} else {
  Write-Host ".gitignore 已包含 doc/，跳过提交。"
}

Write-Step "从所有历史记录中移除 doc/ 目录"
$filterArgs = @("filter-repo", "--path", "doc/", "--invert-paths")
if ($ForceFilterRepo) {
  $filterArgs += "--force"
}
Invoke-Git @filterArgs

Write-Step "重新绑定 origin 远程仓库"
$originExists = $true
& git remote get-url origin *> $null
if ($LASTEXITCODE -ne 0) {
  $originExists = $false
}

if ($originExists) {
  Invoke-Git remote set-url origin $RemoteUrl
} else {
  Invoke-Git remote add origin $RemoteUrl
}

Write-Step "完成本地历史清理"
Write-Host "doc/ 已从本地 Git 历史中移除，origin 已绑定到：$RemoteUrl"

if ($Push) {
  Write-Step "强制推送当前分支"
  Invoke-Git push origin --force $Branch
} else {
  Write-Host "未传入 -Push，已跳过强制推送当前分支。"
  Write-Host "手动推送命令：git push origin --force $Branch"
}

if ($PushAll) {
  Write-Step "强制推送所有分支"
  Invoke-Git push origin --force --all
}

if ($PushTags) {
  Write-Step "强制推送所有标签"
  Invoke-Git push origin --force --tags
}

Write-Host ""
Write-Host "脚本执行结束。" -ForegroundColor Green
