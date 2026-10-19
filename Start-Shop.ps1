Push-Location $PSScriptRoot
try {
  Write-Host 'Hoa Tuoi Ia Pa: http://localhost:4317' -ForegroundColor Magenta
  Write-Host 'Quan tri: http://localhost:4317/admin - Dung Ctrl+C de dung website.'
  npm start
} finally {
  Pop-Location
}
