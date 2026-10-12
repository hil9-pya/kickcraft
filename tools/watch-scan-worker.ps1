param(
 [Parameter(Mandatory=$true)][int]$WorkerPid,
 [Parameter(Mandatory=$true)][long]$WorkerStarted,
 [Parameter(Mandatory=$true)][int]$RunnerPid,
 [Parameter(Mandatory=$true)][long]$RunnerStarted
)
function Test-SameProcess([int]$ProcessId,[long]$Started) {
 $candidate = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
 return $candidate -and $candidate.StartTime.ToUniversalTime().Ticks -eq $Started
}
# PHP finally cannot run after a forced stop; retire the entire runner tree then.
while (Test-SameProcess $RunnerPid $RunnerStarted) {
 if (-not (Test-SameProcess $WorkerPid $WorkerStarted)) {
  & "$env:SystemRoot/System32/taskkill.exe" /PID $RunnerPid /T /F | Out-Null
  exit
 }
 Start-Sleep -Milliseconds 250
}
