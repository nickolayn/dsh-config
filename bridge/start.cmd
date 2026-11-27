@echo off
rem Starts the local bridge for DSH plugins (hotel CRM + TeamJet).
rem Listens on 127.0.0.1:8878. Settings live in bridge.config.json next to this file.
cd /d "%~dp0"
where node >nul 2>nul || (echo node.exe not found - install Node.js 20+ & exit /b 1)
echo Bridge: http://127.0.0.1:8878
node bridge.mjs %*
