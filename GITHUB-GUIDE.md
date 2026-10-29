# Push ParkSarthi updates to GitHub

Your repository is [brijesh2024-max/Park-Sarthi](https://github.com/brijesh2024-max/Park-Sarthi), and the local `main` branch already has an `origin` remote. The website is named ParkSarthi; the local folder is still `parksaathi`.

Open PowerShell and run these commands after reviewing the changes:

```powershell
Set-Location 'C:\Users\Brijesh Gaur\OneDrive\Desktop\car parking Project\parksaathi'
git status
git diff --stat
git add .
git commit -m "Prepare ParkSarthi for Render and Supabase"
git push origin main
```

Complete GitHub sign-in if prompted. Refresh the repository and verify that your new commit and the `postgres/`, `render.yaml`, updated `package.json` and authentication files are present. You do not need to create another repository or add `origin` again.

The checked-in `.gitignore` excludes secret env files, local database/photo state, dependency folders, build output and temporary reports. `.env.example` contains safe placeholders and is intentionally included. Do not force-add `.env`, `.env.local`, `.dev.vars`, service keys or database files.

If Git reports **dubious ownership**, trust only this project folder and retry:

```powershell
git config --global --add safe.directory 'C:/Users/Brijesh Gaur/OneDrive/Desktop/car parking Project/parksaathi'
```

If Git rejects the push because the remote contains newer commits, stop and inspect the difference before integrating them. Do not force-push over another person's work.

Pushing source does not copy hosted records or uploaded photos. When Render is connected with automatic deploys enabled, a push to its linked branch can start a deployment. Configure Supabase and Render using [RENDER-SETUP.md](./RENDER-SETUP.md) before relying on that deployment.

Official reference: [GitHub: adding locally hosted code](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).
