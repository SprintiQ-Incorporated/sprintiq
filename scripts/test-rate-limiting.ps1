# Rate Limiting Load Test Script
# Tests all 6 AI endpoints for rate limiting behavior
#
# Usage: .\scripts\test-rate-limiting.ps1
# Optional: .\scripts\test-rate-limiting.ps1 -BaseUrl "https://staging.sprintiq.ai"

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$WorkspaceId = "test-workspace-123",
    [string]$AuthToken = ""  # Optional: Add real auth token for authenticated tests
)

$ErrorActionPreference = "Continue"

# Colors for output
function Write-Success { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Error { param($msg) Write-Host "❌ $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "ℹ️  $msg" -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host "⚠️  $msg" -ForegroundColor Yellow }

# Test results
$script:totalTests = 0
$script:passedTests = 0
$script:failedTests = 0

function Test-RateLimit {
    param(
        [string]$EndpointName,
        [string]$Url,
        [hashtable]$Body,
        [int]$ExpectedLimit,
        [string]$LimitType  # 'ai_expensive' or 'ai_standard'
    )
    
    Write-Info "Testing: $EndpointName"
    Write-Info "Expected limit: $ExpectedLimit requests"
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    if ($AuthToken) {
        $headers["Authorization"] = "Bearer $AuthToken"
    }
    
    $successCount = 0
    $rateLimitedCount = 0
    $errorCount = 0
    
    # Test up to limit + 5 requests
    $testCount = $ExpectedLimit + 5
    
    Write-Info "Sending $testCount requests..."
    
    for ($i = 1; $i -le $testCount; $i++) {
        try {
            $jsonBody = $Body | ConvertTo-Json -Depth 10
            $response = Invoke-WebRequest -Uri $Url -Method POST -Headers $headers -Body $jsonBody -UseBasicParsing -ErrorAction SilentlyContinue
            
            if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 201) {
                $successCount++
                Write-Host "  [$i/$testCount] ✓ Success (Status: $($response.StatusCode))" -ForegroundColor Green
                
                # Check for rate limit headers
                $limit = $response.Headers["X-RateLimit-Limit"]
                $remaining = $response.Headers["X-RateLimit-Remaining"]
                if ($limit) {
                    Write-Host "    Rate Limit: $remaining/$limit remaining" -ForegroundColor Gray
                }
            }
            elseif ($response.StatusCode -eq 429) {
                $rateLimitedCount++
                $retryAfter = $response.Headers["Retry-After"]
                Write-Host "  [$i/$testCount] ⏸️  Rate Limited (Retry after: $retryAfter seconds)" -ForegroundColor Yellow
            }
            else {
                $errorCount++
                Write-Host "  [$i/$testCount] ❌ Unexpected status: $($response.StatusCode)" -ForegroundColor Red
            }
        }
        catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            
            if ($statusCode -eq 429) {
                $rateLimitedCount++
                Write-Host "  [$i/$testCount] ⏸️  Rate Limited (429 Too Many Requests)" -ForegroundColor Yellow
            }
            elseif ($statusCode -eq 401) {
                Write-Warning "  Authentication required for this endpoint - skipping"
                return $null  # Skip this test
            }
            else {
                $errorCount++
                Write-Host "  [$i/$testCount] ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
        
        # Small delay between requests (50ms)
        Start-Sleep -Milliseconds 50
    }
    
    Write-Host ""
    Write-Info "Results for $EndpointName:"
    Write-Host "  Successful: $successCount" -ForegroundColor Green
    Write-Host "  Rate Limited: $rateLimitedCount" -ForegroundColor Yellow
    Write-Host "  Errors: $errorCount" -ForegroundColor Red
    
    # Validation
    $script:totalTests++
    
    if ($successCount -le $ExpectedLimit -and $rateLimitedCount -gt 0) {
        Write-Success "PASS: Rate limiting working correctly"
        $script:passedTests++
        return $true
    }
    elseif ($successCount -gt $ExpectedLimit) {
        Write-Error "FAIL: More requests succeeded than expected limit ($successCount > $ExpectedLimit)"
        $script:failedTests++
        return $false
    }
    else {
        Write-Warning "INCONCLUSIVE: Needs manual review"
        $script:failedTests++
        return $false
    }
}

# =============================================================================
# MAIN TEST SUITE
# =============================================================================

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   RATE LIMITING LOAD TEST SUITE" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Info "Base URL: $BaseUrl"
Write-Info "Workspace ID: $WorkspaceId"
Write-Host ""

# Test 1: Generate Stories (ai_expensive - 10 req/hr)
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
Test-RateLimit `
    -EndpointName "Generate Stories" `
    -Url "$BaseUrl/api/workspace/$WorkspaceId/generate-stories" `
    -Body @{
        initiativeDescription = "Test initiative for load testing"
        count = 5
        tone = "technical"
    } `
    -ExpectedLimit 10 `
    -LimitType "ai_expensive"
Write-Host ""

# Test 2: Train TAWOS (ai_expensive - 10 req/hr)
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
Test-RateLimit `
    -EndpointName "Train TAWOS" `
    -Url "$BaseUrl/api/workspace/$WorkspaceId/train-tawos" `
    -Body @{
        issues = @(
            @{
                Issue_Key = "TEST-1"
                Title = "Test Issue"
                Description = "Test description"
                Type = "Story"
            }
        )
    } `
    -ExpectedLimit 10 `
    -LimitType "ai_expensive"
Write-Host ""

# Test 3: Team Optimization (ai_standard - 20 req/hr)
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
Test-RateLimit `
    -EndpointName "Team Optimization" `
    -Url "$BaseUrl/api/workspace/$WorkspaceId/ai/team-optimization" `
    -Body @{
        stories = @(
            @{
                id = "story-1"
                title = "Test story"
                story_points = 5
            }
        )
        teamMembers = @(
            @{
                id = "user-1"
                name = "Test User"
                role = "Developer"
                level = "Senior"
                skills = @("JavaScript", "React")
                availability = 1.0
            }
        )
    } `
    -ExpectedLimit 20 `
    -LimitType "ai_standard"
Write-Host ""

# Test 4: Priority Recommendations (ai_standard - 20 req/hr)
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
Test-RateLimit `
    -EndpointName "Priority Recommendations" `
    -Url "$BaseUrl/api/workspace/$WorkspaceId/ai/priority-recommendations" `
    -Body @{
        recommendations = @(
            @{
                id = "rec-1"
                task_id = "task-1"
                title = "Test task"
                recommended_priority = "high"
                confidence = 0.9
            }
        )
    } `
    -ExpectedLimit 20 `
    -LimitType "ai_standard"
Write-Host ""

# Test 5: Epic Breakdown (ai_expensive - 10 req/hr)
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
Test-RateLimit `
    -EndpointName "Epic Breakdown" `
    -Url "$BaseUrl/api/workspace/$WorkspaceId/epics/breakdown" `
    -Body @{
        projectId = "project-1"
        initiativeDescription = "Test epic for breakdown"
        complexity = "medium"
        timeline = "2 weeks"
        epicColor = "#4CAF50"
    } `
    -ExpectedLimit 10 `
    -LimitType "ai_expensive"
Write-Host ""

# Test 6: Epic Recommend (ai_expensive - 10 req/hr)
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
Test-RateLimit `
    -EndpointName "Epic Recommend" `
    -Url "$BaseUrl/api/workspace/$WorkspaceId/epics/recommend" `
    -Body @{
        stories = @(
            @{
                id = "story-1"
                title = "Test story for epic recommendation"
            }
        )
        projectId = "project-1"
        includeNewEpicSuggestion = $true
    } `
    -ExpectedLimit 10 `
    -LimitType "ai_expensive"
Write-Host ""

# =============================================================================
# ADDITIONAL TESTS: Non-AI Endpoints
# =============================================================================

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   TESTING NON-AI ENDPOINTS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Test 7: Contact Form (api - 60 req/min)
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
Test-RateLimit `
    -EndpointName "Contact Form" `
    -Url "$BaseUrl/api/contact" `
    -Body @{
        firstName = "Test"
        lastName = "User"
        email = "test@example.com"
        subject = "Load Test"
        message = "This is a load test message for rate limiting"
    } `
    -ExpectedLimit 60 `
    -LimitType "api"
Write-Host ""

# Test 8: Waitlist (api - 60 req/min)
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
Test-RateLimit `
    -EndpointName "Waitlist" `
    -Url "$BaseUrl/api/waitlist" `
    -Body @{
        email = "test-loadtest@example.com"
        tier = "velocity"
    } `
    -ExpectedLimit 60 `
    -LimitType "api"
Write-Host ""

# =============================================================================
# FINAL SUMMARY
# =============================================================================

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   FINAL RESULTS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total Tests: $script:totalTests" -ForegroundColor White
Write-Host "Passed: $script:passedTests" -ForegroundColor Green
Write-Host "Failed: $script:failedTests" -ForegroundColor Red
Write-Host ""

if ($script:failedTests -eq 0) {
    Write-Success "ALL TESTS PASSED! Rate limiting is working correctly. ✅"
    exit 0
}
else {
    Write-Error "SOME TESTS FAILED. Please review the output above. ❌"
    exit 1
}
