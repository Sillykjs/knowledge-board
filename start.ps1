# 知识白板 - 一键启动脚本 (PowerShell版本)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " 知识白板 - 一键启动脚本" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否以管理员权限运行（可选）
# $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
# if (!$currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
#     Write-Host "提示: 建议以管理员权限运行" -ForegroundColor Yellow
# }

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $scriptPath "backend"
$frontendPath = Join-Path $scriptPath "frontend"

# 启动后端
Write-Host "正在启动后端服务..." -ForegroundColor Green
$backendProcess = Start-Process -FilePath "cmd" -ArgumentList "/k", "cd /d `"$backendPath`" && npm run dev" -PassThru -WindowStyle Normal
$backendProcess.Title = "知识白板-后端"

# 等待2秒
Start-Sleep -Seconds 2

# 启动前端
Write-Host "正在启动前端服务..." -ForegroundColor Green
$frontendProcess = Start-Process -FilePath "cmd" -ArgumentList "/k", "cd /d `"$frontendPath`" && npm run dev" -PassThru -WindowStyle Normal
$frontendProcess.Title = "知识白板-前端"

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " 启动完成！" -ForegroundColor Green
Write-Host " 后端地址: http://localhost:3001" -ForegroundColor White
Write-Host " 前端地址: http://localhost:5173" -ForegroundColor White
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "提示: 关闭此窗口不会停止服务，如需停止请关闭各个服务窗口" -ForegroundColor Yellow
Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
