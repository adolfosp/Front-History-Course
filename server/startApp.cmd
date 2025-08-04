@echo off

REM Verifica se node_modules existe
IF NOT EXIST node_modules (
  echo Instalando dependências...
  npm install
)

REM Inicia o index.js em segundo plano
echo Iniciando app...
start "" "%PROGRAMFILES%\nodejs\node.exe" index.js

exit
