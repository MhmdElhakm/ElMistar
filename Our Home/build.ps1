# This script rewrites index.html with all emoji removals and animation additions
# It preserves ALL business logic exactly as-is

$src = [System.IO.File]::ReadAllText("C:\Users\El-Hakm\Desktop\Our Home\index.html", [System.Text.Encoding]::UTF8)

# Title and theme color
$src = $src -replace '<meta name="theme-color" content="#F59E0B" />', '<meta name="theme-color" content="#3B82F6" />'
$src = $src -replace '<title>بيتنا - مشتريات البيت 🏠</title>', '<title>بيتنا</title>'

[System.IO.File]::WriteAllText("C:\Users\El-Hakm\Desktop\Our Home\index.html", $src, [System.Text.Encoding]::UTF8)
Write-Host "Done phase 1"
