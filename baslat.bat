@echo off
title Okul Fotokopi & Baski Sistemi
cd /d "%~dp0"
echo ===================================================
echo     Okul Fotokopi ve Baski Otomasyon Sistemi
echo ===================================================
echo.

if not exist node_modules (
    echo [BILGI] Ilk calisma: Gerekli kutuphaneler otomatik kuruluyor...
    echo Lutfen internet baglantinizi kontrol edin ve bekleyin.
    echo.
    call npm install
    echo.
    echo [BASARILI] Kurulum tamamlandi!
    echo.
)

echo Sunucu baslatiliyor...
echo.
node server.js
pause
