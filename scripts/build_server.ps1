# Scripts/build_server.ps1

$ErrorActionPreference = "Stop"

$ProjectDir = "$PSScriptRoot\..\..\SAE_STUDIO\src\SAE.STUDIO.Api"
$OutputDir = "$PSScriptRoot\..\src-tauri\bin"

Write-Host "Creating output directory: $OutputDir"
if (-Not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
}

Write-Host "Publishing SAE.STUDIO.Api to $OutputDir\server-x86_64-pc-windows-msvc.exe"
# Publish as self-contained single file for Windows x64
dotnet publish "$ProjectDir\SAE.STUDIO.Api.csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o "$OutputDir"

Write-Host "Renaming the executable to match Tauri sidecar requirements..."
if (Test-Path "$OutputDir\SAE.STUDIO.Api.exe") {
    Rename-Item -Path "$OutputDir\SAE.STUDIO.Api.exe" -NewName "server-x86_64-pc-windows-msvc.exe" -Force
}

Write-Host "Server compiled and copied successfully."
