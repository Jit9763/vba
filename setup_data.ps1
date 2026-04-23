$url = "https://script.google.com/macros/s/AKfycbxIHL10kFyXKC932exBV8pYczexwl7vRK4OshUN-0NR4ZcDG-tz2uAad2rd9hgF1LH7/exec"

$samples = @(
    @{ q1 = "32/B"; q10 = "Manoj Gupta"; q33 = "9876543210"; q35 = "Initial Sample Data 1" },
    @{ q1 = "33"; q10 = "Sita Devi"; q33 = "9876543211"; q35 = "Initial Sample Data 2" },
    @{ q1 = "34"; q10 = "Rajesh Kumar"; q33 = "9876543212"; q35 = "Initial Sample Data 3" },
    @{ q1 = "35"; q10 = "Sunita Devi"; q33 = "9876543213"; q35 = "Initial Sample Data 4" }
)

foreach ($data in $samples) {
    Write-Host "Uploading data for $($data.q10)..."
    Invoke-RestMethod -Uri $url -Method Post -Body $data
    Start-Sleep -Seconds 1
}

Write-Host "Successfully uploaded 4 sample records to Google Sheet."
