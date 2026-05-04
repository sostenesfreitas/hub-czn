; Kill running Hub CZN processes before extracting files so the installer
; does not fail with "Error opening file for writing" on hub-czn-api.exe.
!macro NSIS_HOOK_PREINSTALL
  nsExec::ExecToLog '"taskkill" /F /IM "hub-czn.exe" /T'
  nsExec::ExecToLog '"taskkill" /F /IM "hub-czn-api.exe" /T'
  Sleep 1000
!macroend
