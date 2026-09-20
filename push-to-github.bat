@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo   Mehfil-e-Qawwali  -  Push to GitHub
echo ============================================================
echo.
echo  STEP 1: Create an EMPTY repo on GitHub (no README):
echo          https://github.com/new
echo.
set /p GHUSER="Your GitHub username : "
set /p GHREPO="Repo name             : "
if "%GHREPO%"=="" set GHREPO=mehfil-e-qawwali
echo.
echo  Pushing to https://github.com/%GHUSER%/%GHREPO%.git ...
echo  (A browser/login window may open the first time - sign in.)
echo.
git remote remove origin 2>nul
git add -A
git commit -m "Mehfil-e-Qawwali - The Sufi Listening Room" 2>nul
git branch -M main
git remote add origin https://github.com/%GHUSER%/%GHREPO%.git
git push -u origin main
echo.
if %errorlevel%==0 (
  echo  SUCCESS! Live at: https://github.com/%GHUSER%/%GHREPO%
) else (
  echo  Push failed. Check the message above - usually the repo
  echo  was not created yet, or the name is misspelled.
)
echo.
pause
