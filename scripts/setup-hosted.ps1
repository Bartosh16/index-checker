$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot\..
node .\scripts\setup-hosted.mjs
