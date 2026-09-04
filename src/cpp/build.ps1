# PowerShell C++ Build Script for Traffic Routing Engine

$RootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$IncludeDir = Join-Path $PSScriptRoot "include"
$SrcDir = Join-Path $PSScriptRoot "src"
$OutDir = Join-Path $RootDir "src\traffic_routing\solvers"

Write-Host "Building C++ Solvers..." -ForegroundColor Cyan

# 1. Compile Standalone CLI Executable
$ExeTarget = Join-Path $RootDir "traffic_solver.exe"
Write-Host "Compiling $ExeTarget..."
g++ -O3 -std=c++20 -fopenmp -I $IncludeDir (Join-Path $SrcDir "main.cpp") -o $ExeTarget
if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully compiled traffic_solver.exe" -ForegroundColor Green
} else {
    Write-Host "Failed to compile traffic_solver.exe" -ForegroundColor Red
}

# 2. Invoke Python Build Script for Pybind11 extension
python (Join-Path $RootDir "scripts\build_cpp.py")
