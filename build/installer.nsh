!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

# Désinstallation/mise à jour sûre.
# Les dossiers candidats et les données techniques nécessaires à leur déchiffrement
# et à la reprise d'un parcours ne sont jamais supprimés automatiquement.
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
  # Avant toute mise à jour, sauver les fichiers durables de l'ancienne version
  # dans Documents. Ceci protège notamment la transition depuis 0.3.5, dont
  # l'ancien désinstalleur nettoyait encore AppData.
  SetShellVarContext current
  CreateDirectory "$DOCUMENTS\SEB EvalPro"
  CreateDirectory "$DOCUMENTS\SEB EvalPro\System"

  IfFileExists "$DOCUMENTS\SEB EvalPro\System\candidate-local-key.sebkey" seb_key_backup_done 0
  IfFileExists "$APPDATA\SEB-éval-PRO\candidate-local-key.sebkey" 0 +3
    CopyFiles /SILENT "$APPDATA\SEB-éval-PRO\candidate-local-key.sebkey" "$DOCUMENTS\SEB EvalPro\System\candidate-local-key.sebkey"
    Goto seb_key_backup_done
  IfFileExists "$APPDATA\SEB EvalPro\candidate-local-key.sebkey" 0 +3
    CopyFiles /SILENT "$APPDATA\SEB EvalPro\candidate-local-key.sebkey" "$DOCUMENTS\SEB EvalPro\System\candidate-local-key.sebkey"
    Goto seb_key_backup_done
  IfFileExists "$APPDATA\seb-evalpro\candidate-local-key.sebkey" 0 +3
    CopyFiles /SILENT "$APPDATA\seb-evalpro\candidate-local-key.sebkey" "$DOCUMENTS\SEB EvalPro\System\candidate-local-key.sebkey"
    Goto seb_key_backup_done
  IfFileExists "$APPDATA\SEB-eval-PRO\candidate-local-key.sebkey" 0 seb_key_backup_done
    CopyFiles /SILENT "$APPDATA\SEB-eval-PRO\candidate-local-key.sebkey" "$DOCUMENTS\SEB EvalPro\System\candidate-local-key.sebkey"
seb_key_backup_done:

  IfFileExists "$DOCUMENTS\SEB EvalPro\System\evaluation-state.json" seb_state_backup_done 0
  IfFileExists "$APPDATA\SEB-éval-PRO\evaluation-state.json" 0 +3
    CopyFiles /SILENT "$APPDATA\SEB-éval-PRO\evaluation-state.json" "$DOCUMENTS\SEB EvalPro\System\evaluation-state.json"
    Goto seb_state_backup_done
  IfFileExists "$APPDATA\SEB EvalPro\evaluation-state.json" 0 +3
    CopyFiles /SILENT "$APPDATA\SEB EvalPro\evaluation-state.json" "$DOCUMENTS\SEB EvalPro\System\evaluation-state.json"
    Goto seb_state_backup_done
  IfFileExists "$APPDATA\seb-evalpro\evaluation-state.json" 0 +3
    CopyFiles /SILENT "$APPDATA\seb-evalpro\evaluation-state.json" "$DOCUMENTS\SEB EvalPro\System\evaluation-state.json"
    Goto seb_state_backup_done
  IfFileExists "$APPDATA\SEB-eval-PRO\evaluation-state.json" 0 seb_state_backup_done
    CopyFiles /SILENT "$APPDATA\SEB-eval-PRO\evaluation-state.json" "$DOCUMENTS\SEB EvalPro\System\evaluation-state.json"
seb_state_backup_done:

  IfFileExists "$DOCUMENTS\SEB EvalPro\System\active-candidate.json" seb_pointer_backup_done 0
  IfFileExists "$APPDATA\SEB-éval-PRO\active-candidate.json" 0 +3
    CopyFiles /SILENT "$APPDATA\SEB-éval-PRO\active-candidate.json" "$DOCUMENTS\SEB EvalPro\System\active-candidate.json"
    Goto seb_pointer_backup_done
  IfFileExists "$APPDATA\SEB EvalPro\active-candidate.json" 0 +3
    CopyFiles /SILENT "$APPDATA\SEB EvalPro\active-candidate.json" "$DOCUMENTS\SEB EvalPro\System\active-candidate.json"
    Goto seb_pointer_backup_done
  IfFileExists "$APPDATA\seb-evalpro\active-candidate.json" 0 +3
    CopyFiles /SILENT "$APPDATA\seb-evalpro\active-candidate.json" "$DOCUMENTS\SEB EvalPro\System\active-candidate.json"
    Goto seb_pointer_backup_done
  IfFileExists "$APPDATA\SEB-eval-PRO\active-candidate.json" 0 seb_pointer_backup_done
    CopyFiles /SILENT "$APPDATA\SEB-eval-PRO\active-candidate.json" "$DOCUMENTS\SEB EvalPro\System\active-candidate.json"
seb_pointer_backup_done:

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
