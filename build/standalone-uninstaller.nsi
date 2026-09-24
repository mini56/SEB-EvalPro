!include "MUI2.nsh"
!include "LogicLib.nsh"

Unicode True
Name "SEB-éval-PRO - Désinstallation complète"
!ifndef APP_VERSION
  !define APP_VERSION "0.1.0"
!endif
OutFile "..\dist\SEB-eval-PRO-${APP_VERSION}-Windows-Desinstallation.exe"
RequestExecutionLevel admin
ShowInstDetails show
Icon "app-icon.ico"

VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey /LANG=1036 "ProductName" "SEB-éval-PRO - Désinstallation"
VIAddVersionKey /LANG=1036 "FileDescription" "Désinstallation complète de SEB-éval-PRO"
VIAddVersionKey /LANG=1036 "ProductVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1036 "FileVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1036 "CompanyName" "Sauvegarde 56"
VIAddVersionKey /LANG=1036 "LegalCopyright" "Sauvegarde 56"

!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "French"

Function .onInit
  IfSilent silent_mode
  MessageBox MB_ICONQUESTION|MB_YESNO "Cette opération va désinstaller SEB-éval-PRO, supprimer les anciens raccourcis et nettoyer les données techniques/cache de l'application.$\r$\n$\r$\nLes bilans et documents exportés dans Documents seront conservés.$\r$\n$\r$\nContinuer ?" IDYES confirmed
  Abort
confirmed:
  Return
silent_mode:
FunctionEnd

Function StopSebProcesses
  nsExec::ExecToLog 'taskkill.exe /F /IM "SEB-éval-PRO.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill.exe /F /IM "SEB-eval-PRO.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill.exe /F /IM "SEB EvalPro.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill.exe /F /IM "seb-evalpro.exe"'
  Pop $0
  Sleep 500
FunctionEnd

Function CleanupHKCU
  StrCpy $0 0
loop_hkcu:
  EnumRegKey $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall" $0
  StrCmp $1 "" done_hkcu
  ReadRegStr $2 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "DisplayName"
  StrCpy $3 $2 12
  StrCmp $3 "SEB-éval-PRO" match_hkcu
  StrCmp $3 "SEB-eval-PRO" match_hkcu
  StrCpy $3 $2 11
  StrCmp $3 "SEB EvalPro" match_hkcu
  StrCmp $3 "seb-evalpro" match_hkcu
  IntOp $0 $0 + 1
  Goto loop_hkcu

match_hkcu:
  ReadRegStr $4 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "InstallLocation"
  ReadRegStr $5 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "QuietUninstallString"
  StrCmp $5 "" no_quiet_hkcu
  DetailPrint "Désinstallation enregistrée : $2"
  ExecWait '$5' $6
  Goto remove_hkcu

no_quiet_hkcu:
  ReadRegStr $5 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "UninstallString"
  StrCmp $5 "" remove_hkcu
  DetailPrint "Désinstallation enregistrée : $2"
  ExecWait '$5 /S' $6

remove_hkcu:
  Sleep 800
  StrCmp $4 "" +2
  RMDir /r "$4"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1"
  Goto loop_hkcu

done_hkcu:
FunctionEnd

Function CleanupHKLM64
  SetRegView 64
  StrCpy $0 0
loop_hklm64:
  EnumRegKey $1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall" $0
  StrCmp $1 "" done_hklm64
  ReadRegStr $2 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "DisplayName"
  StrCpy $3 $2 12
  StrCmp $3 "SEB-éval-PRO" match_hklm64
  StrCmp $3 "SEB-eval-PRO" match_hklm64
  StrCpy $3 $2 11
  StrCmp $3 "SEB EvalPro" match_hklm64
  StrCmp $3 "seb-evalpro" match_hklm64
  IntOp $0 $0 + 1
  Goto loop_hklm64

match_hklm64:
  ReadRegStr $4 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "InstallLocation"
  ReadRegStr $5 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "QuietUninstallString"
  StrCmp $5 "" no_quiet_hklm64
  DetailPrint "Désinstallation enregistrée : $2"
  ExecWait '$5' $6
  Goto remove_hklm64

no_quiet_hklm64:
  ReadRegStr $5 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "UninstallString"
  StrCmp $5 "" remove_hklm64
  DetailPrint "Désinstallation enregistrée : $2"
  ExecWait '$5 /S' $6

remove_hklm64:
  Sleep 800
  StrCmp $4 "" +2
  RMDir /r "$4"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1"
  Goto loop_hklm64

done_hklm64:
FunctionEnd

Function CleanupHKLM32
  SetRegView 32
  StrCpy $0 0
loop_hklm32:
  EnumRegKey $1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall" $0
  StrCmp $1 "" done_hklm32
  ReadRegStr $2 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "DisplayName"
  StrCpy $3 $2 12
  StrCmp $3 "SEB-éval-PRO" match_hklm32
  StrCmp $3 "SEB-eval-PRO" match_hklm32
  StrCpy $3 $2 11
  StrCmp $3 "SEB EvalPro" match_hklm32
  StrCmp $3 "seb-evalpro" match_hklm32
  IntOp $0 $0 + 1
  Goto loop_hklm32

match_hklm32:
  ReadRegStr $4 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "InstallLocation"
  ReadRegStr $5 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "QuietUninstallString"
  StrCmp $5 "" no_quiet_hklm32
  DetailPrint "Désinstallation enregistrée : $2"
  ExecWait '$5' $6
  Goto remove_hklm32

no_quiet_hklm32:
  ReadRegStr $5 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "UninstallString"
  StrCmp $5 "" remove_hklm32
  DetailPrint "Désinstallation enregistrée : $2"
  ExecWait '$5 /S' $6

remove_hklm32:
  Sleep 800
  StrCmp $4 "" +2
  RMDir /r "$4"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1"
  Goto loop_hklm32

done_hklm32:
  SetRegView 64
FunctionEnd

Function CleanupKnownFolders
  SetShellVarContext current

  RMDir /r "$LOCALAPPDATA\Programs\SEB-éval-PRO"
  RMDir /r "$LOCALAPPDATA\Programs\SEB-eval-PRO"
  RMDir /r "$LOCALAPPDATA\Programs\SEB EvalPro"
  RMDir /r "$LOCALAPPDATA\Programs\seb-evalpro"

  RMDir /r "$APPDATA\SEB-éval-PRO"
  RMDir /r "$APPDATA\SEB-eval-PRO"
  RMDir /r "$APPDATA\SEB EvalPro"
  RMDir /r "$APPDATA\seb-evalpro"
  RMDir /r "$LOCALAPPDATA\SEB-éval-PRO"
  RMDir /r "$LOCALAPPDATA\SEB-eval-PRO"
  RMDir /r "$LOCALAPPDATA\SEB EvalPro"
  RMDir /r "$LOCALAPPDATA\seb-evalpro"

  Delete "$DESKTOP\SEB-éval-PRO.lnk"
  Delete "$DESKTOP\SEB-eval-PRO.lnk"
  Delete "$DESKTOP\SEB EvalPro.lnk"
  Delete "$DESKTOP\seb-evalpro.lnk"
  Delete "$SMPROGRAMS\SEB-éval-PRO.lnk"
  Delete "$SMPROGRAMS\SEB-eval-PRO.lnk"
  Delete "$SMPROGRAMS\SEB EvalPro.lnk"
  Delete "$SMPROGRAMS\seb-evalpro.lnk"
  RMDir /r "$SMPROGRAMS\SEB-éval-PRO"
  RMDir /r "$SMPROGRAMS\SEB-eval-PRO"
  RMDir /r "$SMPROGRAMS\SEB EvalPro"
  RMDir /r "$SMPROGRAMS\seb-evalpro"

  RMDir /r "$PROGRAMFILES64\SEB-éval-PRO"
  RMDir /r "$PROGRAMFILES64\SEB-eval-PRO"
  RMDir /r "$PROGRAMFILES64\SEB EvalPro"
  RMDir /r "$PROGRAMFILES64\seb-evalpro"
  RMDir /r "$PROGRAMFILES32\SEB-éval-PRO"
  RMDir /r "$PROGRAMFILES32\SEB-eval-PRO"
  RMDir /r "$PROGRAMFILES32\SEB EvalPro"
  RMDir /r "$PROGRAMFILES32\seb-evalpro"

  SetShellVarContext all
  Delete "$DESKTOP\SEB-éval-PRO.lnk"
  Delete "$DESKTOP\SEB-eval-PRO.lnk"
  Delete "$DESKTOP\SEB EvalPro.lnk"
  Delete "$DESKTOP\seb-evalpro.lnk"
  Delete "$SMPROGRAMS\SEB-éval-PRO.lnk"
  Delete "$SMPROGRAMS\SEB-eval-PRO.lnk"
  Delete "$SMPROGRAMS\SEB EvalPro.lnk"
  Delete "$SMPROGRAMS\seb-evalpro.lnk"
  RMDir /r "$SMPROGRAMS\SEB-éval-PRO"
  RMDir /r "$SMPROGRAMS\SEB-eval-PRO"
  RMDir /r "$SMPROGRAMS\SEB EvalPro"
  RMDir /r "$SMPROGRAMS\seb-evalpro"

  SetShellVarContext current
FunctionEnd

Function VerifyCleanup
  StrCpy $7 0
  IfFileExists "$LOCALAPPDATA\Programs\SEB-éval-PRO" remain_install_accent
  IfFileExists "$LOCALAPPDATA\Programs\SEB-eval-PRO" remain_install_ascii
  IfFileExists "$LOCALAPPDATA\Programs\SEB EvalPro" remain_install_space
  IfFileExists "$LOCALAPPDATA\Programs\seb-evalpro" remain_install_lower
  IfFileExists "$APPDATA\SEB-éval-PRO" remain_appdata_accent
  IfFileExists "$APPDATA\SEB-eval-PRO" remain_appdata_ascii
  IfFileExists "$APPDATA\SEB EvalPro" remain_appdata_space
  IfFileExists "$APPDATA\seb-evalpro" remain_appdata_lower
  IfFileExists "$LOCALAPPDATA\SEB-éval-PRO" remain_local_accent
  IfFileExists "$LOCALAPPDATA\SEB-eval-PRO" remain_local_ascii
  IfFileExists "$LOCALAPPDATA\SEB EvalPro" remain_local_space
  IfFileExists "$LOCALAPPDATA\seb-evalpro" remain_local_lower
  Return
remain_install_accent:
  DetailPrint "Encore présent : $LOCALAPPDATA\Programs\SEB-éval-PRO"
  Goto fail_cleanup
remain_install_ascii:
  DetailPrint "Encore présent : $LOCALAPPDATA\Programs\SEB-eval-PRO"
  Goto fail_cleanup
remain_install_space:
  DetailPrint "Encore présent : $LOCALAPPDATA\Programs\SEB EvalPro"
  Goto fail_cleanup
remain_install_lower:
  DetailPrint "Encore présent : $LOCALAPPDATA\Programs\seb-evalpro"
  Goto fail_cleanup
remain_appdata_accent:
  DetailPrint "Encore présent : $APPDATA\SEB-éval-PRO"
  Goto fail_cleanup
remain_appdata_ascii:
  DetailPrint "Encore présent : $APPDATA\SEB-eval-PRO"
  Goto fail_cleanup
remain_appdata_space:
  DetailPrint "Encore présent : $APPDATA\SEB EvalPro"
  Goto fail_cleanup
remain_appdata_lower:
  DetailPrint "Encore présent : $APPDATA\seb-evalpro"
  Goto fail_cleanup
remain_local_accent:
  DetailPrint "Encore présent : $LOCALAPPDATA\SEB-éval-PRO"
  Goto fail_cleanup
remain_local_ascii:
  DetailPrint "Encore présent : $LOCALAPPDATA\SEB-eval-PRO"
  Goto fail_cleanup
remain_local_space:
  DetailPrint "Encore présent : $LOCALAPPDATA\SEB EvalPro"
  Goto fail_cleanup
remain_local_lower:
  DetailPrint "Encore présent : $LOCALAPPDATA\seb-evalpro"
  Goto fail_cleanup
fail_cleanup:
  StrCpy $7 1
FunctionEnd

Section "Désinstallation complète"
  DetailPrint "Arrêt de SEB-éval-PRO..."
  Call StopSebProcesses

  DetailPrint "Suppression des installations enregistrées..."
  Call CleanupHKCU
  Call CleanupHKLM64
  Call CleanupHKLM32

  DetailPrint "Suppression des dossiers techniques, caches et raccourcis..."
  StrCpy $8 0
cleanup_retry:
  Call CleanupKnownFolders
  Call VerifyCleanup
  StrCmp $7 0 cleanup_ok
  IntOp $8 $8 + 1
  IntCmp $8 12 cleanup_failed cleanup_wait cleanup_failed
cleanup_wait:
  DetailPrint "Nettoyage encore en cours, nouvelle tentative ($8/12)..."
  Call StopSebProcesses
  Sleep 1000
  Goto cleanup_retry

cleanup_failed:
  SetErrorLevel 2
  IfSilent cleanup_done
  MessageBox MB_ICONEXCLAMATION|MB_OK "La désinstallation n'a pas pu supprimer toutes les données techniques. Fermez SEB-éval-PRO puis relancez le désinstalleur."
  Goto cleanup_done

cleanup_ok:
  SetErrorLevel 0
  DetailPrint "SEB-éval-PRO a été désinstallé. Les bilans et documents exportés ont été conservés."
cleanup_done:
SectionEnd
