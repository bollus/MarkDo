!macro customInit
  StrCmp $INSTDIR "$LocalAppData\Programs" 0 +2
    StrCpy $INSTDIR "$LocalAppData\Programs\MarkDo"

  StrCmp $INSTDIR "$PROGRAMFILES" 0 +2
    StrCpy $INSTDIR "$PROGRAMFILES\MarkDo"

  StrCmp $INSTDIR "$PROGRAMFILES64" 0 +2
    StrCpy $INSTDIR "$PROGRAMFILES64\MarkDo"
!macroend
