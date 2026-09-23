!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

# Désinstallation propre pour les tests et les futures mises à jour.
# On supprime l'installation, les raccourcis anciens/nouveaux et les données/cache
# Electron de l'application. Les exports utilisateur dans Documents\SEB EvalPro
# (notamment Bilans) ne sont volontairement jamais touchés.
!macro customUnInstall
  DetailPrint "Nettoyage des anciennes données SEB-éval-PRO..."

  # Nettoyer les raccourcis du contexte d'installation courant.
  Delete "$DESKTOP\SEB EvalPro.lnk"
  Delete "$DESKTOP\SEB-éval-PRO.lnk"
  Delete "$SMPROGRAMS\SEB EvalPro.lnk"
  Delete "$SMPROGRAMS\SEB-éval-PRO.lnk"
  RMDir "$SMPROGRAMS\SEB EvalPro"
  RMDir "$SMPROGRAMS\SEB-éval-PRO"

  # Electron conserve userData et les caches dans le profil de l'utilisateur.
  # Plusieurs noms ont été utilisés au cours des builds : on les nettoie tous.
  ${If} $installMode == "all"
    SetShellVarContext current
  ${EndIf}

  Delete "$DESKTOP\SEB EvalPro.lnk"
  Delete "$DESKTOP\SEB-éval-PRO.lnk"
  Delete "$SMPROGRAMS\SEB EvalPro.lnk"
  Delete "$SMPROGRAMS\SEB-éval-PRO.lnk"
  RMDir /r "$APPDATA\seb-evalpro"
  RMDir /r "$APPDATA\SEB EvalPro"
  RMDir /r "$APPDATA\SEB-éval-PRO"
  RMDir /r "$LOCALAPPDATA\seb-evalpro"
  RMDir /r "$LOCALAPPDATA\SEB EvalPro"
  RMDir /r "$LOCALAPPDATA\SEB-éval-PRO"

  ${If} $installMode == "all"
    SetShellVarContext all
    Delete "$DESKTOP\SEB EvalPro.lnk"
    Delete "$DESKTOP\SEB-éval-PRO.lnk"
    Delete "$SMPROGRAMS\SEB EvalPro.lnk"
    Delete "$SMPROGRAMS\SEB-éval-PRO.lnk"
    RMDir "$SMPROGRAMS\SEB EvalPro"
    RMDir "$SMPROGRAMS\SEB-éval-PRO"
  ${EndIf}
!macroend

!ifndef BUILD_UNINSTALLER
Var SebBrandingWelcomeDialog
Var SebBrandingWelcomeImage
Var SebBrandingWelcomeHandle
Var SebBrandingFinishDialog
Var SebBrandingFinishImage
Var SebBrandingFinishHandle
Var SebEdition
Var SebEditionDialog
Var SebEditionCandidateRadio
Var SebEditionAdminRadio

!macro customInstall
  # Enregistrer l'édition choisie. Les anciennes installations sans marqueur restent Admin.
  Delete "$INSTDIR\edition-admin.flag"
  Delete "$INSTDIR\edition-candidate.flag"
  FileOpen $9 "$INSTDIR\edition.json" w
  ${If} $SebEdition == "admin"
    FileWrite $9 "{$\"edition$\":$\"admin$\"}"
    FileClose $9
    FileOpen $9 "$INSTDIR\edition-admin.flag" w
    FileWrite $9 "admin"
    FileClose $9
    WriteRegStr HKCU "Software\SEB EvalPro" "Edition" "admin"
  ${Else}
    FileWrite $9 "{$\"edition$\":$\"candidate$\"}"
    FileClose $9
    FileOpen $9 "$INSTDIR\edition-candidate.flag" w
    FileWrite $9 "candidate"
    FileClose $9
    WriteRegStr HKCU "Software\SEB EvalPro" "Edition" "candidate"
    Goto seb_install_complete
  ${EndIf}

  # Version Administrateur : le Pack IA est indépendant de l'application.
  # Résoudre explicitement le dossier système ProgramData (NSIS/electron-builder
  # ne fournit pas $COMMONAPPDATA dans cette configuration).
  ReadEnvStr $8 "ProgramData"
  StrCmp $8 "" 0 +2
    StrCpy $8 "C:\ProgramData"

  # S'il est déjà présent dans ProgramData, aucune copie ni téléchargement n'est refait.
  IfFileExists "$8\SEB EvalPro\IA\Ministral-3-8B-Instruct-2512-Q4_K_M.gguf" seb_ai_pack_ready 0

  # Installation automatique du Pack IA séparé s'il est placé à côté du Setup.
  IfFileExists "$EXEDIR\SEB-EvalPro-IA-Pack-Setup.exe" 0 seb_ai_try_flat_pack
  DetailPrint "Installation du Pack IA Ministral séparé..."
  ExecWait '"$EXEDIR\SEB-EvalPro-IA-Pack-Setup.exe" /S' $7
  StrCmp $7 0 0 seb_ai_pack_missing
  IfFileExists "$8\SEB EvalPro\IA\Ministral-3-8B-Instruct-2512-Q4_K_M.gguf" seb_ai_pack_ready seb_ai_pack_missing

seb_ai_try_flat_pack:
  # Compatibilité clé USB : un dossier déjà reconstitué peut aussi être copié.
  IfFileExists "$EXEDIR\SEB-EvalPro-IA-Pack\Ministral-3-8B-Instruct-2512-Q4_K_M.gguf" 0 seb_ai_pack_missing
  CreateDirectory "$8\SEB EvalPro\IA"
  CopyFiles /SILENT "$EXEDIR\SEB-EvalPro-IA-Pack\*.*" "$8\SEB EvalPro\IA"
  IfFileExists "$8\SEB EvalPro\IA\Ministral-3-8B-Instruct-2512-Q4_K_M.gguf" seb_ai_pack_ready seb_ai_pack_missing

seb_ai_pack_missing:
  MessageBox MB_ICONEXCLAMATION|MB_OK "SEB EvalPro Administrateur sera installé, mais le Pack IA Ministral n'a pas été trouvé.$\r$\n$\r$\nVous pourrez installer le Pack IA séparément une seule fois. Les prochaines mises à jour de SEB EvalPro ne le supprimeront pas."
  Goto seb_ai_runtime

seb_ai_pack_ready:
  DetailPrint "Pack IA Ministral détecté : il est conservé indépendamment de SEB EvalPro."

seb_ai_runtime:
  # L'IA locale llama.cpp nécessite le runtime Microsoft Visual C++ x64.
  # Le Setup embarque le redistribuable officiel Microsoft et ne le lance
  # que si le runtime v14 x64 n'est pas déjà installé.
  StrCpy $0 0
  SetRegView 32
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  StrCmp $0 1 seb_vc_runtime_ready
  SetRegView 64
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  StrCmp $0 1 seb_vc_runtime_ready

  InitPluginsDir
  File /oname=$PLUGINSDIR\vc_redist.x64.exe "${BUILD_RESOURCES_DIR}\vc_redist.x64.exe"
  DetailPrint "Installation du composant Microsoft Visual C++ x64 requis par l'IA locale..."
  ClearErrors
  ExecShellWait "runas" "$PLUGINSDIR\vc_redist.x64.exe" "/install /quiet /norestart" SW_HIDE
  IfErrors seb_vc_runtime_failed

  StrCpy $0 0
  SetRegView 32
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  StrCmp $0 1 seb_vc_runtime_ready
  SetRegView 64
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  StrCmp $0 1 seb_vc_runtime_ready

seb_vc_runtime_failed:
  MessageBox MB_ICONSTOP|MB_OK "Le composant Microsoft Visual C++ x64 requis par l'IA locale n'a pas pu être installé.$\r$\n$\r$\nRelancez le Setup SEB EvalPro et acceptez la demande Windows d'administration."
  Abort

seb_vc_runtime_ready:
  SetRegView lastused

seb_install_complete:
!macroend

!macro preInit
  StrCpy $SebEdition "candidate"
  ReadRegStr $0 HKCU "Software\SEB EvalPro" "Edition"
  StrCmp $0 "admin" 0 +2
    StrCpy $SebEdition "admin"
  InitPluginsDir
  File /oname=$PLUGINSDIR\seb-eval-pro-branding.bmp "${BUILD_RESOURCES_DIR}\installerBranding.bmp"
!macroend

!macro customWelcomePage
  Page custom SebBrandingWelcomeCreate
  Page custom SebEditionCreate SebEditionLeave
!macroend

Function SebEditionCreate
  nsDialogs::Create 1018
  Pop $SebEditionDialog
  ${If} $SebEditionDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 28u "Choisissez la version de SEB EvalPro à installer :"
  Pop $0
  ${NSD_CreateRadioButton} 8u 42u 92% 18u "Version Candidat — parcours + espace Admin local, sans bilan ni IA"
  Pop $SebEditionCandidateRadio
  ${NSD_CreateRadioButton} 8u 72u 92% 18u "Version Administrateur — toutes les fonctions + Pack IA local"
  Pop $SebEditionAdminRadio
  ${NSD_CreateLabel} 8u 108u 92% 55u "Le Pack IA est indépendant de SEB EvalPro. S'il est déjà installé sur ce PC, il sera conservé et ne sera pas retéléchargé lors des mises à jour."
  Pop $0

  ${If} $SebEdition == "admin"
    ${NSD_Check} $SebEditionAdminRadio
  ${Else}
    ${NSD_Check} $SebEditionCandidateRadio
  ${EndIf}
  nsDialogs::Show
FunctionEnd

Function SebEditionLeave
  ${NSD_GetState} $SebEditionAdminRadio $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $SebEdition "admin"
  ${Else}
    StrCpy $SebEdition "candidate"
  ${EndIf}
FunctionEnd

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
