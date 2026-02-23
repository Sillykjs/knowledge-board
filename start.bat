@echo off
chcp 65001 >nul
echo =====================================
echo 知识白板 - 一键启动脚本
echo =====================================
echo.
echo 正在启动后端服务...
start "知识白板-后端" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 2 >nul

echo 正在启动前端服务...
start "知识白板-前端" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo =====================================
echo 启动完成！
echo 后端地址: http://localhost:3001
echo 前端地址: http://localhost:5173
echo =====================================
echo.
echo 正在打开浏览器...
start "" http://localhost:5173

echo.
echo 按任意键关闭此窗口（服务将继续运行）...
pause >nul
