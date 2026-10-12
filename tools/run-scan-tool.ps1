param(
 [Parameter(Mandatory=$true)][string]$Executable,
 [Parameter(Mandatory=$true)][string]$ArgumentsFile,
 [Parameter(Mandatory=$true)][string]$LogPrefix,
 [int]$WorkerPid = 0
)
$ErrorActionPreference = 'Stop'
# taskkill cannot follow a descendant whose launcher already exited. A Windows job retains it.
Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class ScanProcessJob {
 [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
  public long ProcessTime, JobTime;
  public uint Flags;
  public UIntPtr MinWorkingSet, MaxWorkingSet;
  public uint ActiveProcesses;
  public UIntPtr Affinity;
  public uint Priority, Scheduling;
 }
 [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes; }
 [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits {
  public BasicLimits Basic;
  public IoCounters Io;
  public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
 }
 [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int kind, ref ExtendedLimits limits, uint length);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
 static IntPtr handle;
 public static void Attach() {
  handle=CreateJobObject(IntPtr.Zero,null);
  var limits=new ExtendedLimits(); limits.Basic.Flags=0x2000;
  if(handle==IntPtr.Zero || !SetInformationJobObject(handle,9,ref limits,(uint)Marshal.SizeOf(limits)) || !AssignProcessToJobObject(handle,new IntPtr(-1))) throw new Win32Exception(Marshal.GetLastWin32Error());
 }
}
"@
[ScanProcessJob]::Attach()
$toolArguments = Get-Content -LiteralPath $ArgumentsFile -Raw | ConvertFrom-Json
# Start-Process -Wait tracks descendants; Meshroom 2025 relaunches itself on Windows.
$quotedArguments = ($toolArguments | ForEach-Object { if ([string]$_ -match '\s|"') { '"' + ([string]$_).Replace('"','\"') + '"' } else { [string]$_ } }) -join ' '
if (-not $WorkerPid) { $WorkerPid = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId }
$worker = Get-Process -Id $WorkerPid -ErrorAction Stop
$runner = Get-Process -Id $PID -ErrorAction Stop
$watchArguments = '-NoProfile -NonInteractive -File "' + "$PSScriptRoot/watch-scan-worker.ps1" + '" -WorkerPid ' + $WorkerPid + ' -WorkerStarted ' + $worker.StartTime.ToUniversalTime().Ticks + ' -RunnerPid ' + $PID + ' -RunnerStarted ' + $runner.StartTime.ToUniversalTime().Ticks
$watcher = Start-Process -FilePath "$env:SystemRoot/System32/WindowsPowerShell/v1.0/powershell.exe" -ArgumentList $watchArguments -WindowStyle Hidden -PassThru
try {
 $toolProcess = Start-Process -FilePath $Executable -ArgumentList $quotedArguments -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput "$LogPrefix-stdout.log" -RedirectStandardError "$LogPrefix-stderr.log"
 exit $toolProcess.ExitCode
} finally { Stop-Process -Id $watcher.Id -Force -ErrorAction SilentlyContinue }
