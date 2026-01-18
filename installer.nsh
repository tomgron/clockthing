; Custom NSIS installer script for Clock Screensaver
; This script copies the screensaver to the Windows screensaver directory

!macro customInstall
  ; Debug: Show where we're installing from
  DetailPrint "Installing screensaver from: $INSTDIR"
  DetailPrint "Target: $WINDIR\System32\Clock Screensaver.scr"
  
  ; Use File command to extract directly, or use nsExec to copy
  ; First, try using CopyFiles with full paths
  StrCpy $0 "$INSTDIR\Clock Screensaver.exe"
  StrCpy $1 "$WINDIR\System32\Clock Screensaver.scr"
  
  ; Check if source exists
  IfFileExists $0 0 source_not_found
    DetailPrint "Source file found: $0"
    
    ; Delete existing .scr if present
    Delete "$1"
    
    ; Copy the file
    CopyFiles /SILENT "$0" "$1"
    
    ; Verify copy succeeded
    IfFileExists $1 copy_success copy_failed
    
  copy_success:
    DetailPrint "Screensaver installed successfully to: $1"
    
    ; Set the screensaver as active
    WriteRegStr HKCU "Control Panel\Desktop" "SCRNSAVE.EXE" "$1"
    WriteRegStr HKCU "Control Panel\Desktop" "ScreenSaveActive" "1"
    WriteRegStr HKCU "Control Panel\Desktop" "ScreenSaveTimeOut" "300"
    
    DetailPrint "Screensaver registry settings updated"
    Goto done
    
  source_not_found:
    DetailPrint "ERROR: Source file not found: $0"
    MessageBox MB_OK|MB_ICONEXCLAMATION "Could not find the screensaver executable at:$\n$0$\n$\nPlease copy Clock Screensaver.exe to C:\Windows\System32 and rename it to Clock Screensaver.scr manually."
    Goto done
    
  copy_failed:
    DetailPrint "ERROR: Failed to copy screensaver to System32"
    MessageBox MB_OK|MB_ICONEXCLAMATION "Could not copy screensaver to System32.$\n$\nPlease run the installer as Administrator, or copy manually."
    Goto done
    
  done:
!macroend

!macro customUnInstall
  ; Remove the screensaver from System32
  Delete "$WINDIR\System32\Clock Screensaver.scr"
  
  ; Clear the screensaver registry setting
  WriteRegStr HKCU "Control Panel\Desktop" "SCRNSAVE.EXE" ""
  WriteRegStr HKCU "Control Panel\Desktop" "ScreenSaveActive" "0"
  
  DetailPrint "Screensaver uninstalled"
!macroend
