@echo off
REM Database Initialization Script for Charm MCP Backend (Windows)
REM This script sets up a fresh Prisma database for the Graph Mode feature

echo.
echo ======================================
echo   Charm MCP Database Initialization
echo ======================================
echo.

cd ..

echo Project directory: %CD%
echo.

REM Step 1: Check if .env file exists
if not exist ".env" (
    echo [WARNING] .env file not found. Creating from example...
    if exist ".env.example" (
        copy .env.example .env
        echo [SUCCESS] Created .env file from .env.example
    ) else (
        echo DATABASE_URL="file:./prisma/dev.db" > .env
        echo [SUCCESS] Created minimal .env file
    )
    echo.
) else (
    echo [SUCCESS] .env file exists
    echo.
)

REM Step 2: Check if DATABASE_URL is set
findstr /C:"DATABASE_URL" .env >nul
if errorlevel 1 (
    echo [WARNING] DATABASE_URL not found in .env. Adding default...
    echo DATABASE_URL="file:./prisma/dev.db" >> .env
    echo [SUCCESS] Added DATABASE_URL to .env
    echo.
) else (
    echo [SUCCESS] DATABASE_URL is configured
    echo.
)

REM Step 3: Check for existing database
if exist "prisma\dev.db" (
    echo [WARNING] Existing database found
    set /P "CONFIRM=Do you want to remove the existing database? (y/N): "
    if /I "%CONFIRM%"=="y" (
        del /F /Q prisma\dev.db
        del /F /Q prisma\dev.db-journal 2>nul
        echo [SUCCESS] Removed existing database
    ) else (
        echo [WARNING] Keeping existing database
    )
    echo.
)

REM Step 4: Check if node_modules exists
if not exist "node_modules" (
    echo [WARNING] node_modules not found. Installing dependencies...
    call npm install
    echo [SUCCESS] Dependencies installed
    echo.
) else (
    echo [SUCCESS] Dependencies are installed
    echo.
)

REM Step 5: Generate Prisma Client
echo Generating Prisma Client...
call npm run db:generate
if errorlevel 1 (
    echo [ERROR] Failed to generate Prisma Client
    pause
    exit /b 1
)
echo [SUCCESS] Prisma Client generated
echo.

REM Step 6: Push database schema
echo Pushing database schema...
call npm run db:push
if errorlevel 1 (
    echo [ERROR] Failed to push database schema
    pause
    exit /b 1
)
echo [SUCCESS] Database schema created
echo.

REM Step 7: Verify database was created
if exist "prisma\dev.db" (
    echo [SUCCESS] Database file created successfully
    echo.
    
    REM Get file size
    for %%A in (prisma\dev.db) do echo Database size: %%~zA bytes
) else (
    echo [ERROR] Database file was not created
    pause
    exit /b 1
)

echo.
echo ======================================
echo   Database initialization complete!
echo ======================================
echo.
echo Next steps:
echo    1. Start the backend server: npm run server:dev
echo    2. (Optional) View database: npm run db:studio
echo    3. The database will be automatically populated when you use Graph Mode
echo.
echo Database schema includes:
echo    * GraphProject - Main graph containers
echo    * GraphNode - Individual nodes with positions
echo    * GraphEdge - Connections between nodes
echo    * GraphState - Snapshots for undo/redo
echo.

pause

