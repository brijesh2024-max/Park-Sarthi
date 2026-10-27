# Push ParkSarthi to your GitHub account

The local project is already a Git repository on branch `main`. No GitHub remote is configured. The website's name is ParkSarthi; the existing folder is still named `parksaathi`.

1. Sign in to GitHub and create a repository named `parksarthi`. Choose **Private**. Leave the README, licence and .gitignore options unchecked, since the local project already has files.
2. Open PowerShell and run:

```powershell
Set-Location 'C:\Users\Brijesh Gaur\OneDrive\Desktop\car parking Project\parksaathi'
git status
git add .
git commit -m "Remove sample data and update ParkSarthi branding"
```

3. Copy the repository's HTTPS URL from GitHub. Replace the example URL below with your actual URL, then run:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/parksarthi.git
git remote -v
git push -u origin main
```

4. Complete GitHub's sign-in if prompted. Refresh the repository page and confirm that `app`, `lib`, `db`, `drizzle`, `tests`, and `package.json` are visible.

The checked-in `.gitignore` excludes local secret files, local database/photo state, build output, dependency folders and temporary reports. `.env.example` contains placeholders and is intentionally included. Do not force-add `.env`, `.dev.vars`, API keys or database files.

If Git reports **dubious ownership**, trust only this project folder, then retry the failed command:

```powershell
git config --global --add safe.directory 'C:/Users/Brijesh Gaur/OneDrive/Desktop/car parking Project/parksaathi'
```

If `origin` already exists because you repeated the steps, inspect `git remote -v` and skip `git remote add` when it already points to the intended repository. Do not force-push over an existing repository's work.

Pushing to GitHub uploads source code; it does not copy hosted database records or uploaded photos and does not deploy the website. The app still needs the documented server/database/storage/authentication migration before Render deployment. Keep customer booking disabled until real payment and host settlement setup is complete.

Official reference: [GitHub: adding locally hosted code](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).
