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

  # Version Administrateur : SEB-IA est intégrée au programme. Aucun Pack externe n'est requis.

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
  ${NSD_CreateRadioButton} 8u 42u 92% 18u "Version Candidat — parcours + espace Admin local, sans bilan"
  Pop $SebEditionCandidateRadio
  ${NSD_CreateRadioButton} 8u 72u 92% 18u "Version Administrateur — toutes les fonctions + SEB-IA intégrée"
  Pop $SebEditionAdminRadio
  ${NSD_CreateLabel} 8u 108u 92% 55u "SEB-IA est intégrée directement à SEB EvalPro Administrateur. Aucun modèle, Pack IA ou composant séparé n'est nécessaire."
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
