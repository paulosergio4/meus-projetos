@echo off
chcp 65001 >nul
title Cortes Studio - Instalação
cd /d "%~dp0"
echo.
echo   ==========================================
echo      Cortes Studio - instalação
echo   ==========================================
echo.

python --version >nul 2>nul
if errorlevel 1 (
  echo [1/4] Instalando o Python...
  winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
  echo.
  echo   Python instalado. FECHE esta janela e abra o INSTALAR.bat de novo.
  echo.
  pause
  exit /b
)
echo [1/4] Python encontrado.

where ffmpeg >nul 2>nul
if errorlevel 1 (
  if not exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\ffmpeg.exe" (
    echo [2/4] Instalando o ffmpeg...
    winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements
  )
) else (
  echo [2/4] ffmpeg encontrado.
)

where deno >nul 2>nul
if errorlevel 1 (
  if not exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\deno.exe" (
    echo [2/4] Instalando o Deno - exigido pelo YouTube...
    winget install -e --id DenoLand.Deno --accept-source-agreements --accept-package-agreements
  )
)

echo [3/4] Instalando as bibliotecas (alguns minutos)...
python -m pip install --upgrade pip >nul
python -m pip install -U -r requirements.txt pyinstaller
if errorlevel 1 goto erro

echo [4/4] Criando o aplicativo...
python -m PyInstaller --noconfirm --windowed --name "Cortes Studio" --icon icone.ico ^
  --add-data "icone.ico;." ^
  --collect-all customtkinter --collect-all faster_whisper --collect-all ctranslate2 ^
  --collect-all onnxruntime --collect-all yt_dlp --collect-all yt_dlp_ejs ^
  --collect-data googleapiclient ^
  --hidden-import gerar_cortes --hidden-import postar --hidden-import windnd ^
  app.py
if errorlevel 1 goto erro

powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Cortes Studio.lnk');$s.TargetPath='%~dp0dist\Cortes Studio\Cortes Studio.exe';$s.WorkingDirectory='%~dp0dist\Cortes Studio';$s.IconLocation='%~dp0dist\Cortes Studio\Cortes Studio.exe,0';$s.Save()"

echo.
echo   Pronto! O atalho "Cortes Studio" está na sua Área de Trabalho.
echo.
start "" "dist\Cortes Studio\Cortes Studio.exe"
pause
exit /b

:erro
echo.
echo   Algo deu errado. Copie as mensagens acima e me envie.
pause
