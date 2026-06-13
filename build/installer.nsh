!macro customInit
  StrCmp $INSTDIR "$LocalAppData\Programs" 0 +2
    StrCpy $INSTDIR "$LocalAppData\Programs\MarkDo"

  StrCmp $INSTDIR "$PROGRAMFILES" 0 +2
    StrCpy $INSTDIR "$PROGRAMFILES\MarkDo"

  StrCmp $INSTDIR "$PROGRAMFILES64" 0 +2
    StrCpy $INSTDIR "$PROGRAMFILES64\MarkDo"
!macroend

!macro customInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "MarkDo"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.MarkDo" "$INSTDIR\MarkDo.exe"
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "MarkDo"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.MarkDo"
!macroend
