@echo off
rem 深译 TransSeek - 网页版启动器：启动本地服务并打开浏览器
cd /d "%~dp0"
start "transseek" node bin\ds.js server --port 9177
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:9177/"
