# ============================================================================
# Build IVFFlat Index on tawos_user_stories via direct PostgreSQL connection
# ============================================================================
# Bypasses Supabase SQL Editor timeout by connecting directly to PostgreSQL
# and setting a 30-minute statement_timeout.
#
# Usage (pick one):
#
#   # Option A: Connection string
#   .\scripts\build-ivfflat-index.ps1 -ConnectionString "postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres"
#
#   # Option B: Individual parameters (easier if psql isn't in PATH)
#   .\scripts\build-ivfflat-index.ps1 -Host "db.vttwakzntflxuylenszu.supabase.co" -Password "your-db-password"
#
# Find your DB password in Supabase Dashboard: Settings > Database > Database password
# ============================================================================

param(
    [string]$ConnectionString,
    [string]$Host,
    [string]$Password,
    [string]$Port = "5432",
    [string]$User = "postgres",
    [string]$Database = "postgres"
)

# --- Find psql ---
function Find-Psql {
    # Try PATH first
    $inPath = Get-Command psql -ErrorAction SilentlyContinue
    if ($inPath) { return $inPath.Source }

    # Common Windows install locations
    $candidates = @(
        "C:\Program Files\PostgreSQL\18\bin\psql.exe",
        "C:\Program Files\PostgreSQL\17\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe",
        "C:\Program Files (x86)\PostgreSQL\18\bin\psql.exe",
        "C:\Program Files (x86)\PostgreSQL\17\bin\psql.exe"
    )

    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }

    return $null
}

# Helper to run SQL via psql
function Invoke-Psql {
    param(
        [string]$Sql,
        [string[]]$ExtraArgs = @()
    )

    if ($ConnectionString) {
        return ($Sql | & $psql $ConnectionString @ExtraArgs 2>&1)
    } else {
        $env:PGPASSWORD = $Password
        return ($Sql | & $psql -h $Host -p $Port -U $User -d $Database @ExtraArgs 2>&1)
    }
}

# ============================================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " IVFFlat Index Builder" -ForegroundColor Cyan
Write-Host " Table: tawos_user_stories" -ForegroundColor Cyan
Write-Host " Dimensions: 1536 (Voyage AI)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Validate params ---
if (-not $ConnectionString -and -not $Host) {
    Write-Host "ERROR: Provide either -ConnectionString or -Host and -Password" -ForegroundColor Red
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host '  .\scripts\build-ivfflat-index.ps1 -Host "db.vttwakzntflxuylenszu.supabase.co" -Password "YOUR_DB_PASSWORD"' -ForegroundColor Gray
    Write-Host '  .\scripts\build-ivfflat-index.ps1 -ConnectionString "postgresql://postgres:PASSWORD@db.vttwakzntflxuylenszu.supabase.co:5432/postgres"' -ForegroundColor Gray
    exit 1
}

if ($Host -and -not $Password) {
    Write-Host "ERROR: -Password is required when using -Host" -ForegroundColor Red
    exit 1
}

# --- Step 0: Find psql ---
Write-Host "[0/5] Locating psql..." -ForegroundColor Yellow

$psql = Find-Psql
if (-not $psql) {
    Write-Host "  ERROR: psql not found in PATH or standard install locations." -ForegroundColor Red
    Write-Host "  Try running with the full path:" -ForegroundColor Yellow
    Write-Host '  $env:PGPASSWORD="your-password"; & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h db.vttwakzntflxuylenszu.supabase.co -p 5432 -U postgres -d postgres' -ForegroundColor Gray
    exit 1
}

$psqlVersion = & $psql --version 2>&1
Write-Host "  Found: $psqlVersion" -ForegroundColor Green
Write-Host "  Path: $psql" -ForegroundColor Gray

# --- Step 1: Test connection + check current index state ---
Write-Host ""
Write-Host "[1/5] Connecting and checking current index state..." -ForegroundColor Yellow

$checkIndexSQL = @"
SELECT c.relname AS index_name,
       i.indisvalid AS is_valid,
       i.indisready AS is_ready,
       pg_size_pretty(pg_relation_size(c.oid)) AS size,
       am.amname AS index_type
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_am am ON am.oid = c.relam
JOIN pg_class t ON t.oid = i.indrelid
WHERE t.relname = 'tawos_user_stories'
  AND c.relname LIKE '%embedding%';
"@

$result = Invoke-Psql -Sql $checkIndexSQL -ExtraArgs @("-t", "-A")
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Could not connect to database." -ForegroundColor Red
    Write-Host "  $result" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Make sure you're using the DIRECT connection host (not the pooler)." -ForegroundColor Yellow
    Write-Host "  Supabase Dashboard: Settings > Database > Connection string > Direct" -ForegroundColor Yellow
    exit 1
}

if ($result -and "$result".Trim()) {
    Write-Host "  Current embedding indexes:" -ForegroundColor Gray
    Write-Host "  $result" -ForegroundColor Gray
} else {
    Write-Host "  No embedding indexes found (will create fresh)" -ForegroundColor Gray
}

# --- Step 2: Get row count ---
Write-Host ""
Write-Host "[2/5] Counting rows..." -ForegroundColor Yellow

$countSQL = "SELECT count(*) FROM tawos_user_stories WHERE embedding IS NOT NULL;"
$rowCount = (Invoke-Psql -Sql $countSQL -ExtraArgs @("-t", "-A")).Trim()
Write-Host "  Rows with embeddings: $rowCount" -ForegroundColor Green

# --- Step 3: Drop old indexes ---
Write-Host ""
Write-Host "[3/5] Dropping old embedding indexes..." -ForegroundColor Yellow

$dropSQL = @"
DROP INDEX IF EXISTS tawos_user_stories_embedding_hnsw_idx;
DROP INDEX IF EXISTS tawos_user_stories_embedding_idx;
DROP INDEX IF EXISTS tawos_user_stories_embedding_ivfflat_idx;
"@

$dropResult = Invoke-Psql -Sql $dropSQL
if ($LASTEXITCODE -ne 0) {
    Write-Host "  WARNING: Drop may have partially failed: $dropResult" -ForegroundColor Yellow
} else {
    Write-Host "  Done - old indexes dropped" -ForegroundColor Green
}

# --- Step 4: Build IVFFlat index ---
Write-Host ""
Write-Host "[4/5] Building IVFFlat index (this may take several minutes)..." -ForegroundColor Yellow
Write-Host "  - lists = 100 (suitable for ~200K rows)" -ForegroundColor Gray
Write-Host "  - statement_timeout = 30 minutes" -ForegroundColor Gray
Write-Host "  - maintenance_work_mem = 512MB" -ForegroundColor Gray
Write-Host "  Started at: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Gray
Write-Host ""

$buildStart = Get-Date

$buildSQL = @"
SET statement_timeout = '1800000';
SET maintenance_work_mem = '512MB';

CREATE INDEX tawos_user_stories_embedding_ivfflat_idx
ON tawos_user_stories
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
"@

$buildResult = Invoke-Psql -Sql $buildSQL
$buildEnd = Get-Date
$elapsed = ($buildEnd - $buildStart).TotalSeconds

if ($LASTEXITCODE -ne 0) {
    Write-Host "  FAILED with lists=100 after $([math]::Round($elapsed,1))s" -ForegroundColor Red
    Write-Host "  $buildResult" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Retrying with lists=50..." -ForegroundColor Yellow

    $buildStart2 = Get-Date

    $buildSQL2 = @"
SET statement_timeout = '1800000';
SET maintenance_work_mem = '512MB';

DROP INDEX IF EXISTS tawos_user_stories_embedding_ivfflat_idx;

CREATE INDEX tawos_user_stories_embedding_ivfflat_idx
ON tawos_user_stories
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 50);
"@

    $buildResult2 = Invoke-Psql -Sql $buildSQL2
    $buildEnd2 = Get-Date
    $elapsed2 = ($buildEnd2 - $buildStart2).TotalSeconds

    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAILED with lists=50 after $([math]::Round($elapsed2,1))s" -ForegroundColor Red
        Write-Host "  $buildResult2" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "  SUCCESS with lists=50 in $([math]::Round($elapsed2,1))s" -ForegroundColor Green
    }
} else {
    Write-Host "  SUCCESS in $([math]::Round($elapsed,1))s" -ForegroundColor Green
}

# --- Step 5: Verify ---
Write-Host ""
Write-Host "[5/5] Verifying index..." -ForegroundColor Yellow

$verifySQL = @"
SELECT c.relname AS index_name,
       i.indisvalid AS is_valid,
       i.indisready AS is_ready,
       pg_size_pretty(pg_relation_size(c.oid)) AS size,
       am.amname AS index_type
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_am am ON am.oid = c.relam
JOIN pg_class t ON t.oid = i.indrelid
WHERE t.relname = 'tawos_user_stories'
  AND c.relname LIKE '%embedding%';
"@

$verifyResult = Invoke-Psql -Sql $verifySQL -ExtraArgs @("-t", "-A")
Write-Host "  $verifyResult" -ForegroundColor Green

# --- Step 6: Update match_documents function ---
Write-Host ""
Write-Host "[BONUS] Updating match_documents function..." -ForegroundColor Yellow

$funcSQL = @"
DROP FUNCTION IF EXISTS match_documents(vector(1536), float, int, jsonb);

CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.65,
    match_count int DEFAULT 10,
    filter jsonb DEFAULT '{}'
)
RETURNS TABLE (
    id UUID,
    similarity float,
    metadata jsonb
)
LANGUAGE sql
STABLE
SET statement_timeout = '6s'
AS `$`$
    SELECT sub.id, sub.similarity, sub.metadata
    FROM (
        SELECT
            tawos_user_stories.id,
            1 - (tawos_user_stories.embedding <=> query_embedding) AS similarity,
            tawos_user_stories.metadata
        FROM tawos_user_stories
        WHERE tawos_user_stories.embedding IS NOT NULL
        ORDER BY tawos_user_stories.embedding <=> query_embedding
        LIMIT match_count
    ) sub
    WHERE sub.similarity > match_threshold;
`$`$;
"@

$funcResult = Invoke-Psql -Sql $funcSQL
if ($LASTEXITCODE -ne 0) {
    Write-Host "  WARNING: Function update failed: $funcResult" -ForegroundColor Yellow
} else {
    Write-Host "  match_documents updated successfully" -ForegroundColor Green
}

# --- Clean up ---
if ($Password) { $env:PGPASSWORD = "" }

# --- Done ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " ALL DONE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Test vector search in your app" -ForegroundColor White
Write-Host "  2. For better recall, set probes higher:" -ForegroundColor White
Write-Host "     SET ivfflat.probes = 10;" -ForegroundColor White
Write-Host ""
