# fix_chinese.ps1 - Replace Chinese string
$ErrorActionPreference = "Stop"

$f1 = "d:\workP\BlexAgents\CLAUDE.md"
$f2 = "d:\workP\BlexAgents\CHANGELOG.md"

$c1 = [System.IO.File]::ReadAllText($f1, [System.Text.Encoding]::UTF8)
$c2 = [System.IO.File]::ReadAllText($f2, [System.Text.Encoding]::UTF8)

$c1 = $c1.Replace([char]0x004D + [char]0x0041 + " " + [char]0x5C0F + [char]0x52A9 + [char]0x7406, [char]0x0042 + [char]0x006C + [char]0x0065 + [char]0x0078 + " " + [char]0x5C0F + [char]0x52A9 + [char]0x7406)
$c2 = $c2.Replace([char]0x004D + [char]0x0041 + " " + [char]0x5C0F + [char]0x52A9 + [char]0x7406, [char]0x0042 + [char]0x006C + [char]0x0065 + [char]0x0078 + " " + [char]0x5C0F + [char]0x52A9 + [char]0x7406)

[System.IO.File]::WriteAllText($f1, $c1, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f2, $c2, [System.Text.Encoding]::UTF8)

Write-Host "Done"
