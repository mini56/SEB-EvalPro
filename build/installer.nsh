!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

!ifndef BUILD_UNINSTALLER
Var SebBrandingWelcomeDialog
Var SebBrandingWelcomeImage
Var SebBrandingWelcomeHandle
Var SebBrandingFinishDialog
Var SebBrandingFinishImage
Var SebBrandingFinishHandle

!macro preInit
  InitPluginsDir
  File /oname=$PLUGINSDIR\seb-eval-pro-branding.bmp "${BUILD_RESOURCES_DIR}\installerBranding.bmp"
!macroend

!macro customWelcomePage
  Page custom SebBrandingWelcomeCreate
!macroend

Function SebBrandingWelcomeCreate
  nsDialogs::Create 1018
  Pop $SebBrandingWelcomeDialog
  ${If} $SebBrandingWelcomeDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateBitmap} 0 0 100% 100% ""
  Pop $SebBrandingWelcomeImage
  ${NSD_SetBitmap} $SebBrandingWelcomeImage "$PLUGINSDIR\seb-eval-pro-branding.bmp" $SebBrandingWelcomeHandle

  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Suivant >"
  nsDialogs::Show
  ${NSD_FreeBitmap} $SebBrandingWelcomeHandle
FunctionEnd

!macro customFinishPage
  Page custom SebBrandingFinishCreate
!macroend

Function SebBrandingFinishCreate
  nsDialogs::Create 1018
  Pop $SebBrandingFinishDialog
  ${If} $SebBrandingFinishDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateBitmap} 0 0 100% 100% ""
  Pop $SebBrandingFinishImage
  ${NSD_SetBitmap} $SebBrandingFinishImage "$PLUGINSDIR\seb-eval-pro-branding.bmp" $SebBrandingFinishHandle

  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Fermer"
  GetDlgItem $0 $HWNDPARENT 3
  ShowWindow $0 0
  GetDlgItem $0 $HWNDPARENT 2
  ShowWindow $0 0

  nsDialogs::Show
  ${NSD_FreeBitmap} $SebBrandingFinishHandle
FunctionEnd
!endif
