; Custom NSIS installer script for Clock Screensaver
; This file is automatically included by electron-builder
;
; Strategy: Install full Electron app to Program Files, then rename .exe to .scr
; The .scr file will load dependencies from its own directory (Program Files)

!macro customInstall
  DetailPrint "=== Configuring Clock Screensaver ==="

  ; Rename the executable to .scr in Program Files
  ; The .exe is already installed by electron-builder to $INSTDIR
  DetailPrint "Source: $INSTDIR\Clock Screensaver.exe"
  DetailPrint "Target: $INSTDIR\Clock Screensaver.scr"

  ; Delete old .scr if it exists
  IfFileExists "$INSTDIR\Clock Screensaver.scr" 0 +2
    Delete "$INSTDIR\Clock Screensaver.scr"

  ; Rename .exe to .scr (keeps all dependencies in same directory)
  Rename "$INSTDIR\Clock Screensaver.exe" "$INSTDIR\Clock Screensaver.scr"

  ; Set screensaver in registry to point to Program Files location
  DetailPrint "Setting registry keys..."
  WriteRegStr HKCU "Control Panel\Desktop" "SCRNSAVE.EXE" "$INSTDIR\Clock Screensaver.scr"
  WriteRegStr HKCU "Control Panel\Desktop" "ScreenSaveActive" "1"
  WriteRegStr HKCU "Control Panel\Desktop" "ScreenSaveTimeOut" "300"

  DetailPrint "=== Screensaver installation complete ==="
  DetailPrint "Location: $INSTDIR\Clock Screensaver.scr"
!macroend

!macro customUnInstall
  ; Clear the screensaver registry entry
  WriteRegStr HKCU "Control Panel\Desktop" "SCRNSAVE.EXE" ""
  WriteRegStr HKCU "Control Panel\Desktop" "ScreenSaveActive" "0"
!macroend
