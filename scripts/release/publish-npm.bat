@echo off
setlocal EnableExtensions

pushd "%~dp0..\.." >nul
if errorlevel 1 (
  echo [ERROR] Unable to enter the unicall project root.
  pause
  exit /b 1
)

set "WAIT_ON_EXIT=0"
set "MODE=%~1"
if "%MODE%"=="" (
  set "MODE=check"
  set "WAIT_ON_EXIT=1"
)

rem Keep npm cache inside an ignored project folder to avoid user-profile permission errors.
set "npm_config_cache=%CD%\.pnpm-store\npm-release-cache"

if /i "%MODE%"=="check" goto :run_checks
if /i "%MODE%"=="publish" goto :run_checks
if /i "%MODE%"=="publish-public" goto :run_checks

call :usage
set "EXIT_CODE=1"
goto :finish

:run_checks
echo.
echo [1/4] Running tests...
call pnpm test
if errorlevel 1 goto :failed

echo.
echo [2/4] Running type checks...
call pnpm typecheck
if errorlevel 1 goto :failed

echo.
echo [3/4] Building dist release assets...
call pnpm build
if errorlevel 1 goto :failed

echo.
echo [4/4] Previewing npm tarball contents...
call npm pack --dry-run
if errorlevel 1 goto :failed

if /i "%MODE%"=="check" (
  echo.
  echo [DONE] Checks passed. No npm publish was executed.
  echo To publish an unscoped package, run:
  echo   scripts\release\publish-npm.bat publish
  echo To publish a public scoped package, run:
  echo   scripts\release\publish-npm.bat publish-public
  set "EXIT_CODE=0"
  goto :finish
)

echo.
echo [NOTICE] Review Tarball Contents above for secrets and local config files.
echo [NOTICE] The package version cannot be published again after a successful release.
set "CONFIRM="
set /p "CONFIRM=Type PUBLISH to confirm; any other input cancels: "
if not "%CONFIRM%"=="PUBLISH" (
  echo [CANCELLED] No npm publish was executed.
  set "EXIT_CODE=0"
  goto :finish
)

echo.
if /i "%MODE%"=="publish-public" (
  echo [PUBLISH] Publishing a public scoped package...
  call npm publish --access public
) else (
  echo [PUBLISH] Publishing the npm package...
  call npm publish
)

if errorlevel 1 goto :failed

echo.
echo [DONE] npm publish completed successfully.
set "EXIT_CODE=0"
goto :finish

:failed
echo.
echo [FAILED] Release flow stopped. Fix the error above and run again.
set "EXIT_CODE=1"
goto :finish

:finish
if "%WAIT_ON_EXIT%"=="1" (
  echo.
  pause
)
popd >nul
exit /b %EXIT_CODE%

:usage
echo Usage:
echo   scripts\release\publish-npm.bat check           Check only; does not publish (default)
echo   scripts\release\publish-npm.bat publish         Publish an unscoped package
echo   scripts\release\publish-npm.bat publish-public  Publish a public scoped package
exit /b 0
