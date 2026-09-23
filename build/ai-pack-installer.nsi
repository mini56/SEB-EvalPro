Unicode true
RequestExecutionLevel admin
SilentInstall normal
SetCompressor /SOLID lzma

!include "LogicLib.nsh"

!ifndef AI_RUNTIME_DIR
  !error "AI_RUNTIME_DIR manquant"
!endif
!ifndef VERIFY_SCRIPT
  !error "VERIFY_SCRIPT manquant"
!endif

!define MODEL_NAME "Ministral-3-8B-Instruct-2512-Q4_K_M.gguf"
!define PART1 "${MODEL_NAME}.part01"
!define PART2 "${MODEL_NAME}.part02"
!define PART3 "${MODEL_NAME}.part03"

Name "SEB EvalPro - Pack IA Ministral 8B"
OutFile "dist\SEB-EvalPro-IA-Pack-Setup.exe"
BrandingText "SEB EvalPro - Sauvegarde 56"
ShowInstDetails show
ShowUninstDetails show

Var ProgramDataRoot

Function .onInit
  ReadEnvStr $ProgramDataRoot "ProgramData"
  StrCmp $ProgramDataRoot "" 0 +2
    StrCpy $ProgramDataRoot "C:\ProgramData"
  StrCpy $INSTDIR "$ProgramDataRoot\SEB EvalPro\IA"
FunctionEnd

Page instfiles

Section "Pack IA Ministral 8B"
  SetShellVarContext all

  IfFileExists "$EXEDIR\${PART1}" 0 parts_missing
  IfFileExists "$EXEDIR\${PART2}" 0 parts_missing
  IfFileExists "$EXEDIR\${PART3}" 0 parts_missing

  CreateDirectory "$INSTDIR"
  SetOutPath "$INSTDIR"

  # Runtime llama.cpp embarqué dans ce petit installateur ; le modèle reste externe.
  File /r "${AI_RUNTIME_DIR}\*.*"
  InitPluginsDir
  File /oname=$PLUGINSDIR\verify-ai-pack.ps1 "${VERIFY_SCRIPT}"

  Delete "$INSTDIR\${MODEL_NAME}.tmp"
  Delete "$INSTDIR\${MODEL_NAME}"

  DetailPrint "Reconstitution du modèle Ministral 8B..."
  nsExec::ExecToLog '"$SYSDIR\cmd.exe" /d /c copy /b "$EXEDIR\${PART1}"+"$EXEDIR\${PART2}"+"$EXEDIR\${PART3}" "$INSTDIR\${MODEL_NAME}.tmp"'
  Pop $0
  StrCmp $0 "0" hash_check assemble_failed

hash_check:
  DetailPrint "Vérification SHA256 du modèle..."
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\verify-ai-pack.ps1" -FilePath "$INSTDIR\${MODEL_NAME}.tmp"' $0
  StrCmp $0 "0" hash_ok hash_failed

hash_ok:
  Rename "$INSTDIR\${MODEL_NAME}.tmp" "$INSTDIR\${MODEL_NAME}"
  FileOpen $1 "$INSTDIR\pack.json" w
  FileWrite $1 "{$\"pack$\":$\"ministral3-8b-2512-q4km-v1$\",$\"model$\":$\"${MODEL_NAME}$\",$\"sha256$\":$\"33e7a72cf5e6e2cfc2f2847075acc013d68bba023e35310cef86b5cf8fdca761$\"}"
  FileClose $1
  WriteUninstaller "$INSTDIR\Desinstaller-Pack-IA.exe"

  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SEBEvalProAIPack" "DisplayName" "SEB EvalPro - Pack IA Ministral 8B"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SEBEvalProAIPack" "DisplayVersion" "1.0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SEBEvalProAIPack" "Publisher" "Sauvegarde 56"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SEBEvalProAIPack" "UninstallString" "$\"$INSTDIR\Desinstaller-Pack-IA.exe$\""
  DetailPrint "Pack IA Ministral installé et vérifié."
  Goto pack_done

parts_missing:
  MessageBox MB_ICONSTOP|MB_OK "Les 3 fichiers du modèle Ministral doivent être placés dans le même dossier que SEB-EvalPro-IA-Pack-Setup.exe."
  SetErrorLevel 2
  Abort

assemble_failed:
  Delete "$INSTDIR\${MODEL_NAME}.tmp"
  MessageBox MB_ICONSTOP|MB_OK "Impossible de reconstituer le modèle Ministral."
  SetErrorLevel 3
  Abort

hash_failed:
  Delete "$INSTDIR\${MODEL_NAME}.tmp"
  MessageBox MB_ICONSTOP|MB_OK "Le contrôle SHA256 du modèle Ministral a échoué. Le Pack IA n'a pas été installé."
  SetErrorLevel 4
  Abort

pack_done:
SectionEnd

Section "Uninstall"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SEBEvalProAIPack"
  RMDir /r "$INSTDIR"
SectionEnd
