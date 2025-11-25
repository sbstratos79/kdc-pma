param(
    # Paths – change these if yours differ
    [string]$PythonPath      = "C:\Users\Administrator\Documents\Code\openai-edge-tts\venv\Scripts\python.exe",
    [string]$PythonWorkDir   = "C:\Users\Administrator\Documents\Code\openai-edge-tts",
    [string]$BunPath         = "bun",  # or full path to bun.exe if needed
    [string]$BunWorkDir      = "C:\Users\Administrator\Documents\Code\kdc-pma",

    # Logging
    [string]$LogRoot         = "C:\Logs\dev-services",
    [int]$LogRetentionDays   = 7       # delete logs older than this many days
)

function Initialize-LogDirectory {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -Path $Path -ItemType Directory -Force | Out-Null
    }
}

function Rotate-Logs {
    param(
        [string]$Directory,
        [int]$RetentionDays
    )

    if (-not (Test-Path -LiteralPath $Directory)) { return }

    $cutoff = (Get-Date).AddDays(-$RetentionDays)

    Get-ChildItem -Path $Directory -Filter '*.log' -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $cutoff } |
        Remove-Item -Force -ErrorAction SilentlyContinue
}

# Directories for each app's logs
$pythonLogDir = Join-Path $LogRoot "openai-edge-tts"
$bunLogDir    = Join-Path $LogRoot "kdc-pma"

# Make sure they exist and rotate old logs
$dirs = @($pythonLogDir, $bunLogDir)
foreach ($d in $dirs) {
    Initialize-LogDirectory -Path $d
    Rotate-Logs -Directory $d -RetentionDays $LogRetentionDays
}

# Timestamped log files for this run
$timestamp  = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$pythonLog  = Join-Path $pythonLogDir "server_$timestamp.log"
$bunLog     = Join-Path $bunLogDir    "bun-dev_$timestamp.log"

# --- Start Python server (hidden) ---
Start-Process -FilePath $PythonPath `
    -ArgumentList 'server.py' `
    -WorkingDirectory $PythonWorkDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $pythonLog `
    -RedirectStandardError  $pythonLog

# --- Start bun dev (hidden) ---
Start-Process -FilePath $BunPath `
    -ArgumentList 'run dev --host' `
    -WorkingDirectory $BunWorkDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $bunLog `
    -RedirectStandardError  $bunLog
