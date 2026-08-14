[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$ExePath,
  [int]$DurationMinutes=60,
  [int]$SampleSeconds=60,
  [int]$ExerciseEveryMinutes=5,
  [string]$OutputDir=(Join-Path $PSScriptRoot 'v9-soak-results'),
  [switch]$NoF2,[switch]$NoDisplayChange,[switch]$NoMove,[switch]$LeaveRunning
)
Set-StrictMode -Version Latest; $ErrorActionPreference='Stop'
if(!(Test-Path -LiteralPath $ExePath -PathType Leaf)){throw "Executable not found: $ExePath"}
$ExePath=(Resolve-Path -LiteralPath $ExePath).Path; New-Item -ItemType Directory -Force $OutputDir|Out-Null
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'; $csv=Join-Path $OutputDir "v9-soak-$stamp.csv"; $json=Join-Path $OutputDir "v9-soak-$stamp-summary.json"
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class V9SoakNative {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr z,int x,int y,int cx,int cy,uint f);
 [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i);
}
"@
$WM_CLOSE=0x10;$WM_DISPLAYCHANGE=0x7E;$WM_KEYDOWN=0x100;$WM_KEYUP=0x101;$VK_F2=0x71
function Wait-Hwnd($p){$d=(Get-Date).AddSeconds(12);while((Get-Date) -lt $d){$p.Refresh();if($p.HasExited){return [IntPtr]::Zero};if($p.MainWindowHandle -ne [IntPtr]::Zero){return $p.MainWindowHandle};Start-Sleep -Milliseconds 100};[IntPtr]::Zero}
function Key-F2($h){[void][V9SoakNative]::PostMessage($h,$WM_KEYDOWN,[IntPtr]$VK_F2,[IntPtr]::Zero);Start-Sleep -Milliseconds 60;[void][V9SoakNative]::PostMessage($h,$WM_KEYUP,[IntPtr]$VK_F2,[IntPtr](1 -shl 31))}
function Display-Change($h){$w=[V9SoakNative]::GetSystemMetrics(0);$hh=[V9SoakNative]::GetSystemMetrics(1);$lp=(($hh -band 0xffff) -shl 16) -bor ($w -band 0xffff);[void][V9SoakNative]::PostMessage($h,$WM_DISPLAYCHANGE,[IntPtr]32,[IntPtr]$lp)}
function Nudge($h){$r=New-Object 'V9SoakNative+RECT';if([V9SoakNative]::GetWindowRect($h,[ref]$r)){$f=0x1 -bor 0x4 -bor 0x10;[void][V9SoakNative]::SetWindowPos($h,[IntPtr]::Zero,$r.L+24,$r.T+16,0,0,$f);Start-Sleep -Milliseconds 180;[void][V9SoakNative]::SetWindowPos($h,[IntPtr]::Zero,$r.L,$r.T,0,0,$f)}}
function M($t,$p){$m=[regex]::Match($t,$p,'IgnoreCase');if($m.Success){$m.Groups[1].Value}else{$null}}
function Stats($t){$r=[regex]::Match($t,'\brec\s*[=: ]\s*(\d+)\s*/\s*(\d+)','IgnoreCase');[pscustomobject]@{
 age=M $t '\bage\s*[=: ]\s*(\d+(?:\.\d+)?)\s*ms';drop=M $t '\bdrop\s*[=: ]\s*(\d+)';rebind=M $t '\brebinds?\s*[=: ]\s*(\d+)';closed=M $t '\bclosed\s*[=: ]\s*(\d+)';
 recA=if($r.Success){$r.Groups[1].Value}else{$null};recF=if($r.Success){$r.Groups[2].Value}else{$null};afail=M $t '\bafail\s*[=: ]\s*(\d+)';bt=M $t '\bbtimeout\s*[=: ]\s*(\d+)';dev=M $t '\bdevrem\s*[=: ]\s*(\d+)';thread=M $t '\bthread\s*[=: ]\s*(OK|ALIVE|DEAD)';excl=M $t '\bexcl\s*[=: ]\s*(YES|NO)';shot=M $t '\bshot\s*[=: ]\s*(ON|OFF)'}}
$p=Start-Process -FilePath $ExePath -PassThru;$h=Wait-Hwnd $p;if($h -eq [IntPtr]::Zero){if(!$p.HasExited){Stop-Process $p.Id -Force};throw 'main window not ready'}
$start=Get-Date;$end=$start.AddMinutes($DurationMinutes);$next=$start.AddMinutes($ExerciseEveryMinutes);$rows=@();$ex=0;$fatal=$null
while((Get-Date) -lt $end){$p.Refresh();if($p.HasExited){$fatal="process exited: $($p.ExitCode)";break};$now=Get-Date;if($now -ge $next){$ex++;if(!$NoF2){Key-F2 $h;Start-Sleep -Milliseconds 700;Key-F2 $h;Start-Sleep -Milliseconds 700};if(!$NoDisplayChange){Display-Change $h;Start-Sleep -Milliseconds 1000};if(!$NoMove){Nudge $h;Start-Sleep -Milliseconds 400};$next=$next.AddMinutes($ExerciseEveryMinutes)};$p.Refresh();$t=$p.MainWindowTitle;$s=Stats $t;$rows+= [pscustomobject]@{time=(Get-Date).ToString('o');min=[math]::Round(((Get-Date)-$start).TotalMinutes,2);privateMB=[math]::Round($p.PrivateMemorySize64/1MB,2);workingMB=[math]::Round($p.WorkingSet64/1MB,2);handles=$p.HandleCount;age=$s.age;drop=$s.drop;rebind=$s.rebind;closed=$s.closed;recA=$s.recA;recF=$s.recF;afail=$s.afail;btimeout=$s.bt;devrem=$s.dev;thread=$s.thread;excl=$s.excl;shot=$s.shot;title=$t};$rows|Export-Csv $csv -NoTypeInformation -Encoding UTF8;$remain=($end - (Get-Date)).TotalSeconds;if($remain -gt 0){Start-Sleep -Seconds ([math]::Min($SampleSeconds,[math]::Ceiling($remain)))}}
$p.Refresh();if(!$p.HasExited){$t=$p.MainWindowTitle;$s=Stats $t;if($s.shot -eq 'ON'){Key-F2 $h;Start-Sleep -Milliseconds 1000;$p.Refresh();$t=$p.MainWindowTitle;$s=Stats $t};$rows+= [pscustomobject]@{time=(Get-Date).ToString('o');min=[math]::Round(((Get-Date)-$start).TotalMinutes,2);privateMB=[math]::Round($p.PrivateMemorySize64/1MB,2);workingMB=[math]::Round($p.WorkingSet64/1MB,2);handles=$p.HandleCount;age=$s.age;drop=$s.drop;rebind=$s.rebind;closed=$s.closed;recA=$s.recA;recF=$s.recF;afail=$s.afail;btimeout=$s.bt;devrem=$s.dev;thread=$s.thread;excl=$s.excl;shot=$s.shot;title=$t};$rows|Export-Csv $csv -NoTypeInformation -Encoding UTF8}
$fail=@();if($fatal){$fail+=$fatal};if($rows|?{$_.thread -eq 'DEAD'}){$fail+='thread=DEAD'};foreach($x in @('afail','btimeout','devrem','recF')){if($rows|?{$_.$x -ne $null -and [long]$_.$x -gt 0}){$fail+="$x > 0"}};$old=0;foreach($r in $rows){if($r.age -ne $null -and [double]$r.age -gt 100){$old++}else{$old=0};if($old -ge 3){$fail+='age >100ms for 3 consecutive samples';break}};$first=$rows|Select-Object -First 1;$last=$rows|Select-Object -Last 1;if($last.excl -and $last.excl -ne 'YES'){$fail+="final excl=$($last.excl)"};if($last.shot -and $last.shot -ne 'OFF'){$fail+="final shot=$($last.shot)"};if(!$NoDisplayChange -and $ex -gt 0 -and $first.recA -ne $null -and $last.recA -ne $null -and ([long]$last.recA - [long]$first.recA) -lt $ex){$fail+='recovery count did not follow injected DISPLAYCHANGE'}
$mem=[math]::Round([double]$last.privateMB - [double]$first.privateMB,2);$hd=[int]$last.handles - [int]$first.handles;$warn=@();if($mem -gt 64){$warn+="private memory +${mem}MB"};if($hd -gt 64){$warn+="handles +$hd"};$status=if($fail.Count){'FAIL'}elseif($warn.Count){'PASS_WITH_WARNING'}else{'PASS'}
if(!$LeaveRunning -and !$p.HasExited){[void][V9SoakNative]::PostMessage($h,$WM_CLOSE,[IntPtr]::Zero,[IntPtr]::Zero);if(!$p.WaitForExit(5000)){Stop-Process $p.Id -Force;$warn+='forced cleanup after soak'}}
[ordered]@{status=$status;exe=$ExePath;durationMinutes=$DurationMinutes;samples=$rows.Count;exercises=$ex;failures=$fail;warnings=$warn;memoryDeltaMB=$mem;handleDelta=$hd;csv=$csv}|ConvertTo-Json -Depth 4|Set-Content $json -Encoding UTF8
Write-Host "V9 soak: $status";Write-Host "CSV: $csv";Write-Host "Summary: $json";$fail|%{Write-Host "FAIL: $_"};$warn|%{Write-Host "WARN: $_"};if($status -eq 'FAIL'){exit 2}
