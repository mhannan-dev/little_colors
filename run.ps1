<#
.SYNOPSIS
  Little Colors - one launcher for everyday tasks.

.EXAMPLE
  .\run.ps1            # show the menu
  .\run.ps1 dev        # desktop app (Tauri window, hot reload)
  .\run.ps1 record     # voice recording studio in the browser
  .\run.ps1 test       # unit tests + typecheck

  If scripts are blocked:  powershell -ExecutionPolicy Bypass -File .\run.ps1 dev
#>
param(
	[Parameter(Position = 0)]
	[ValidateSet('menu', 'dev', 'web', 'record', 'test', 'e2e', 'build', 'tts', 'tts-dry', 'assets', 'install', 'help')]
	[string]$Command = 'menu',

	# Extra arguments passed through (e.g. .\run.ps1 tts --only=mix.)
	[Parameter(ValueFromRemainingArguments = $true)]
	[string[]]$Rest = @()
)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Desktop = Join-Path $Root 'apps\desktop'
$DevPort = 5173

function Write-Step([string]$Text) { Write-Host "`n> $Text" -ForegroundColor Cyan }
function Write-Warn([string]$Text) { Write-Host "  ! $Text" -ForegroundColor Yellow }
function Write-Fail([string]$Text) { Write-Host "  x $Text" -ForegroundColor Red }

function Test-Tool([string]$Name, [string]$Hint) {
	if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
		Write-Fail "$Name was not found. $Hint"
		exit 1
	}
}

function Assert-Prerequisites([switch]$NeedRust) {
	Test-Tool 'node' 'Install Node.js 22+ from https://nodejs.org'
	Test-Tool 'pnpm' 'Install with: npm install -g pnpm'
	if ($NeedRust) { Test-Tool 'cargo' 'Install Rust from https://rustup.rs (needed for the desktop window)' }
	if (-not (Test-Path (Join-Path $Root 'node_modules'))) {
		Write-Step 'Installing dependencies (first run)'
		Invoke-Pnpm @('install')
	}
}

function Invoke-Pnpm([string[]]$PnpmArgs) {
	Push-Location $Root
	try {
		& pnpm @PnpmArgs
		if ($LASTEXITCODE -ne 0) { throw "pnpm $($PnpmArgs -join ' ') failed (exit $LASTEXITCODE)" }
	} finally {
		Pop-Location
	}
}

# Port 5173 is fixed (Tauri expects it). If something already listens there, say what it is.
function Get-PortOwner([int]$Port) {
	$conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
	if (-not $conn) { return $null }
	return Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
}

function Confirm-PortFree([int]$Port) {
	$owner = Get-PortOwner $Port
	if (-not $owner) { return $true }
	Write-Warn "Port $Port is already in use by '$($owner.ProcessName)' (PID $($owner.Id), started $($owner.StartTime))."
	Write-Warn 'This is usually an old dev server. It may belong to another tool or agent.'
	$answer = Read-Host "  Stop PID $($owner.Id) and continue? [y/N]"
	if ($answer -match '^(y|yes)$') {
		Stop-Process -Id $owner.Id -Force
		Start-Sleep -Milliseconds 800
		return $true
	}
	return $false
}

function Start-Dev {
	Assert-Prerequisites -NeedRust
	if (-not (Confirm-PortFree $DevPort)) {
		Write-Warn "Not starting. Close the other server or run '.\run.ps1 web' to reuse it in a browser."
		exit 1
	}
	Write-Step 'Starting the desktop app (first build of the Rust shell can take a few minutes)'
	Write-Host '  F11 = fullscreen - Ctrl+C here = stop'
	Invoke-Pnpm @('dev')
}

function Start-Web([string]$Path = '/') {
	Assert-Prerequisites
	$url = "http://localhost:$DevPort$Path"
	$owner = Get-PortOwner $DevPort
	if ($owner) {
		Write-Warn "A dev server is already running on port $DevPort (PID $($owner.Id)); opening it."
		if ($Path -eq '/record') {
			Write-Warn 'If saving recordings fails, that server is older than the recorder: stop it and run this again.'
		}
		Start-Process $url
		return
	}
	Write-Step "Starting the UI dev server -> $url"
	Write-Host '  Ctrl+C here = stop'
	# Open the browser once the server answers.
	$job = Start-Job -ScriptBlock {
		param($u)
		for ($i = 0; $i -lt 120; $i++) {
			try { Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process $u; return } catch { Start-Sleep -Milliseconds 500 }
		}
	} -ArgumentList $url
	try {
		Invoke-Pnpm @('--filter', 'desktop', 'dev')
	} finally {
		Remove-Job $job -Force -ErrorAction SilentlyContinue
	}
}

function Show-Help {
	Write-Host @'

Little Colors - .\run.ps1 <command>

  dev       Desktop app in a Tauri window (hot reload)
  web       UI only, in your browser (no Rust needed)
  record    Voice recording studio (browser, /record) - see docs\recording-guide.md
  test      Unit tests + typecheck (all packages)
  e2e       Playwright end-to-end tests (Edge)
  build     Windows installer (.exe) -> apps\desktop\src-tauri\target\release\bundle\nsis\
  tts       Generate Bengali/English placeholder voice with Azure (needs .env)
  tts-dry   Count TTS characters, no key needed
  assets    List placeholder assets still to replace
  install   pnpm install
  help      This list

'@
}

function Show-Menu {
	Show-Help
	$choice = Read-Host 'Type a command (Enter = dev)'
	if ([string]::IsNullOrWhiteSpace($choice)) { $choice = 'dev' }
	& $PSCommandPath $choice.Trim()
}

switch ($Command) {
	'menu' { Show-Menu }
	'help' { Show-Help }
	'install' { Invoke-Pnpm @('install') }
	'dev' { Start-Dev }
	'web' { Start-Web '/' }
	'record' { Start-Web '/record' }
	'test' {
		Assert-Prerequisites
		Write-Step 'Unit tests'
		Invoke-Pnpm @('test')
		Write-Step 'Typecheck'
		Invoke-Pnpm @('typecheck')
		Write-Host "`nOK All unit tests and typecheck passed" -ForegroundColor Green
	}
	'e2e' {
		Assert-Prerequisites
		Write-Step 'Playwright end-to-end tests (Edge)'
		Invoke-Pnpm (@('--filter', 'desktop', 'test:e2e') + $Rest)
	}
	'build' {
		Assert-Prerequisites -NeedRust
		Write-Step 'Building the Windows installer (release build, several minutes)'
		Invoke-Pnpm @('build:desktop')
		$bundle = Join-Path $Desktop 'src-tauri\target\release\bundle\nsis'
		if (Test-Path $bundle) {
			Write-Host "`nOK Installer:" -ForegroundColor Green
			Get-ChildItem $bundle -Filter *.exe | ForEach-Object { Write-Host "  $($_.FullName)  ($([math]::Round($_.Length / 1MB, 2)) MB)" }
		}
	}
	'tts' {
		Assert-Prerequisites
		if (-not (Test-Path (Join-Path $Root '.env'))) {
			Write-Fail 'No .env file. Copy .env.example to .env and add AZURE_SPEECH_KEY / AZURE_SPEECH_REGION.'
			exit 1
		}
		Invoke-Pnpm (@('tts:generate') + $Rest)
	}
	'tts-dry' { Assert-Prerequisites; Invoke-Pnpm @('tts:generate', '--dry-run') }
	'assets' { Assert-Prerequisites; Invoke-Pnpm @('assets:report') }
}
