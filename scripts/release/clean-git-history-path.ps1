param(
  [string]$ProjectName = "",
  [string]$CleanPath = "doc/",
  [string]$IgnorePattern = "",
  [string]$RemoteName = "origin",
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
$script:FilterRepoMode = ""

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Normalize-GitPath {
  param([string]$Path)

  $normalizedPath = $Path.Trim().Replace("\", "/")
  while ($normalizedPath.StartsWith("./")) {
    $normalizedPath = $normalizedPath.Substring(2)
  }
  while ($normalizedPath.StartsWith("/")) {
    $normalizedPath = $normalizedPath.Substring(1)
  }

  return $normalizedPath
}

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)

  & git @GitArgs
  if ($LASTEXITCODE -ne 0) {
    throw "git 命令执行失败：git $($GitArgs -join ' ')"
  }
}

function Invoke-GitCapture {
  param(
    [Parameter(Mandatory = $true)][string[]]$GitArgs,
    [switch]$AllowFailure
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  try {
    $output = & git @GitArgs 2>$null
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0 -and -not $AllowFailure) {
    throw "git 命令执行失败：git $($GitArgs -join ' ')"
  }

  return (($output | Out-String).Trim())
}

function Test-NativeCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [string[]]$Arguments = @()
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  try {
    & $Command @Arguments >$null 2>$null
    return $LASTEXITCODE -eq 0
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

function Resolve-FilterRepoCommand {
  if (Test-NativeCommand -Command "git" -Arguments @("filter-repo", "--version")) {
    $script:FilterRepoMode = "git"
    return $true
  }

  if (Test-NativeCommand -Command "git-filter-repo" -Arguments @("--version")) {
    $script:FilterRepoMode = "direct"
    return $true
  }

  return $false
}

function Invoke-FilterRepo {
  param([Parameter(Mandatory = $true)][string[]]$FilterArgs)

  if ($script:FilterRepoMode -eq "git") {
    Invoke-Git @(@("filter-repo") + $FilterArgs)
    return
  }

  & git-filter-repo @FilterArgs
  if ($LASTEXITCODE -ne 0) {
    throw "git-filter-repo 命令执行失败：git-filter-repo $($FilterArgs -join ' ')"
  }
}

Write-Host "Git 历史清理脚本" -ForegroundColor Yellow
Write-Host "这个脚本会从所有 Git 历史中移除指定路径，并可选择强制推送远程仓库。"
Write-Host "请只在准备开源、移除敏感文件或清理私有文档时使用。"

Write-Step "确认当前目录是 Git 仓库根目录"
$repoRoot = Invoke-GitCapture -GitArgs @("rev-parse", "--show-toplevel")
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
  throw "当前目录不是 Git 仓库，请在目标项目根目录运行。"
}

Set-Location $repoRoot
Write-Host "仓库根目录：$repoRoot"

if ([string]::IsNullOrWhiteSpace($ProjectName)) {
  $defaultProjectName = Split-Path -Leaf $repoRoot
  $projectInput = Read-Host "请输入要清理的项目名字（直接回车使用 $defaultProjectName）"
  if ([string]::IsNullOrWhiteSpace($projectInput)) {
    $ProjectName = $defaultProjectName
  } else {
    $ProjectName = $projectInput.Trim()
  }
}

if ([string]::IsNullOrWhiteSpace($ProjectName)) {
  throw "项目名字不能为空。"
}

$CleanPath = Normalize-GitPath -Path $CleanPath
if ([string]::IsNullOrWhiteSpace($CleanPath)) {
  throw "清理路径不能为空。"
}

if ([string]::IsNullOrWhiteSpace($IgnorePattern)) {
  $IgnorePattern = $CleanPath
}
$IgnorePattern = Normalize-GitPath -Path $IgnorePattern

Write-Host "项目名字：$ProjectName"
Write-Host "清理路径：$CleanPath"
Write-Host "忽略规则：$IgnorePattern"

$confirmProject = Read-Host "这个操作会重写历史。请再次输入项目名字确认"
if ($confirmProject -ne $ProjectName) {
  Write-Host "确认项目名不一致，已取消。"
  exit 0
}

if ([string]::IsNullOrWhiteSpace($Branch)) {
  $Branch = Invoke-GitCapture -GitArgs @("branch", "--show-current")
}
if ([string]::IsNullOrWhiteSpace($Branch)) {
  throw "无法识别当前分支，请用 -Branch main 或 -Branch master 指定。"
}
Write-Host "目标分支：$Branch"

if ([string]::IsNullOrWhiteSpace($RemoteUrl)) {
  $RemoteUrl = Invoke-GitCapture -GitArgs @("remote", "get-url", $RemoteName) -AllowFailure
}
if ([string]::IsNullOrWhiteSpace($RemoteUrl)) {
  $RemoteUrl = Read-Host "请输入清理后要绑定的 $RemoteName 远程仓库地址"
}
if ([string]::IsNullOrWhiteSpace($RemoteUrl)) {
  throw "远程仓库地址不能为空。"
}
Write-Host "远程仓库：$RemoteName -> $RemoteUrl"

Write-Step "检查工作区是否干净"
$status = Invoke-GitCapture -GitArgs @("status", "--short")
if (-not [string]::IsNullOrWhiteSpace($status)) {
  Write-Host $status
  throw "工作区存在未提交变更。请先提交或暂存，再重新运行脚本。"
}

Write-Step "检查 git-filter-repo"
if (-not (Resolve-FilterRepoCommand)) {
  if (-not $InstallTool) {
    throw "未找到 git-filter-repo。请先运行：python -m pip install git-filter-repo，或用 -InstallTool 让脚本安装。"
  }

  Write-Host "正在安装 git-filter-repo..."
  & python -m pip install git-filter-repo
  if ($LASTEXITCODE -ne 0) {
    throw "git-filter-repo 安装失败，请检查 Python/pip 环境。"
  }

  if (-not (Resolve-FilterRepoCommand)) {
    throw "git-filter-repo 已尝试安装，但当前终端仍无法找到命令。请确认 Python Scripts 目录已加入 PATH 后重新打开终端。"
  }
}
Write-Host "git-filter-repo 调用方式：$script:FilterRepoMode"

Write-Step "将清理路径写入 .gitignore 并提交"
$gitignorePath = Join-Path $repoRoot ".gitignore"
if (-not (Test-Path $gitignorePath)) {
  New-Item -Path $gitignorePath -ItemType File | Out-Null
}

$gitignoreLines = Get-Content -Path $gitignorePath -Encoding UTF8
if ($gitignoreLines -notcontains $IgnorePattern) {
  Add-Content -Path $gitignorePath -Value $IgnorePattern -Encoding UTF8
  Invoke-Git add .gitignore
  Invoke-Git commit -m "chore: 忽略本地 $CleanPath 路径"
} else {
  Write-Host ".gitignore 已包含 $IgnorePattern，跳过提交。"
}

Write-Step "从所有历史记录中移除指定路径"
$filterArgs = @("--path", $CleanPath, "--invert-paths")
if ($ForceFilterRepo) {
  $filterArgs += "--force"
}
Invoke-FilterRepo -FilterArgs $filterArgs

Write-Step "重新绑定远程仓库"
$remoteExists = -not [string]::IsNullOrWhiteSpace((Invoke-GitCapture -GitArgs @("remote", "get-url", $RemoteName) -AllowFailure))
if ($remoteExists) {
  Invoke-Git remote set-url $RemoteName $RemoteUrl
} else {
  Invoke-Git remote add $RemoteName $RemoteUrl
}

Write-Step "完成本地历史清理"
Write-Host "$CleanPath 已从本地 Git 历史中移除，$RemoteName 已绑定到：$RemoteUrl"

if ($Push) {
  Write-Step "强制推送当前分支"
  Invoke-Git push $RemoteName --force $Branch
} else {
  Write-Host "未传入 -Push，已跳过强制推送当前分支。"
  Write-Host "手动推送命令：git push $RemoteName --force $Branch"
}

if ($PushAll) {
  Write-Step "强制推送所有分支"
  Invoke-Git push $RemoteName --force --all
}

if ($PushTags) {
  Write-Step "强制推送所有标签"
  Invoke-Git push $RemoteName --force --tags
}

Write-Host ""
Write-Host "脚本执行结束。" -ForegroundColor Green
