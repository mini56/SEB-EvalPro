!include "MUI2.nsh"
!include "LogicLib.nsh"

Unicode True
Name "SEB-éval-PRO - Désinstallation complète"
!ifndef APP_VERSION
  !define APP_VERSION "0.1.0"
!endif
OutFile "dist\SEB-eval-PRO-${APP_VERSION}-Windows-Desinstallation.exe"
RequestExecutionLevel admin
ShowInstDetails show
Icon "build\app-icon.ico"

VIProductVersion "0.1.0.0"
VIAddVersionKey /LANG=1036 "ProductName" "SEB-éval-PRO - Désinstallation"
VIAddVersionKey /LANG=1036 "FileDescription" "Désinstallation complète de SEB-éval-PRO"
VIAddVersionKey /LANG=1036 "ProductVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1036 "CompanyName" "Sauvegarde 56"

!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "French"

Function .onInit
  MessageBox MB_ICONQUESTION|MB_YESNO "Cette opération va désinstaller SEB-éval-PRO, supprimer les anciens raccourcis et nettoyer les données techniques/cache de l'application.$\r$\n$\r$\nLes bilans et documents exportés dans Documents seront conservés.$\r$\n$\r$\nContinuer ?" IDYES +2
  Abort
FunctionEnd

Section "Désinstallation complète"
  SetOutPath "$PLUGINSDIR"
  File /oname=seb-eval-pro-cleanup.ps1 "scripts\uninstall-clean.ps1"

  DetailPrint "Recherche des anciennes installations SEB EvalPro / SEB-éval-PRO..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\seb-eval-pro-cleanup.ps1"'
  Pop $0

  Delete "$PLUGINSDIR\seb-eval-pro-cleanup.ps1"

  ${If} $0 != 0
    MessageBox MB_ICONEXCLAMATION|MB_OK "Le nettoyage s'est terminé avec le code $0. Vérifiez qu'aucune instance de SEB-éval-PRO n'est encore ouverte."
  ${Else}
    DetailPrint "Désinstallation complète terminée."
  ${EndIf}
SectionEnd
