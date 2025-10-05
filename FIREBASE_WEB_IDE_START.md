# 🔥 Firebase Web IDE - Quick Start

## Starting the Development Server in Firebase Web IDE

### Option 1: Using the Bash Script (Easiest)

In the Firebase Web IDE terminal, run:

```bash
chmod +x start-dev.sh
./start-dev.sh
```

### Option 2: Manual Commands

In the Firebase Web IDE terminal, run these commands:

```bash
# Navigate to Module_Manager
cd Module_Manager

# Install dependencies (first time only)
npm install

# Start the dev server
npm run dev -- --host
```

---

## Important: Firebase Web IDE Preview

After the server starts, you'll see output like:

```
VITE v5.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: http://172.x.x.x:5173/
```

**In Firebase Web IDE**, you need to use the **Preview** feature:

1. Look for the **"Preview"** button in the Firebase Web IDE toolbar
2. Click it to open the preview pane
3. Or use the preview URL Firebase provides

---

## Troubleshooting in Firebase Web IDE

### Server starts but preview is blank
- Make sure you're using `npm run dev -- --host`
- The `--host` flag is important for Firebase's preview system

### Port already in use
- Stop any running servers first
- Or change the port in `Module_Manager/vite.config.ts`

### npm command not found
- Firebase Web IDE should have npm pre-installed
- Try: `which npm` to verify
- If missing, contact Firebase support

---

## File Editing in Firebase Web IDE

- Edit files directly in the Firebase editor
- Changes will auto-reload in the preview
- No need to restart the server for most changes

---

## Terminal Tips for Firebase Web IDE

### Multiple Terminals
- You can open multiple terminal tabs in Firebase Web IDE
- Keep one running the dev server
- Use another for git commands

### Stopping the Server
- Press `Ctrl + C` in the terminal
- Or close the terminal tab

### Checking Status
```bash
# Check if server is running
ps aux | grep vite

# Check Node/npm versions
node --version
npm --version
```

---

## Development Workflow

1. **Start server** (once):
   ```bash
   cd Module_Manager
   npm install  # First time only
   npm run dev -- --host
   ```

2. **Open preview** in Firebase Web IDE

3. **Edit files** - changes reload automatically

4. **Test** your changes in the preview

5. **Commit** when ready:
   ```bash
   git add .
   git commit -m "Your message"
   git push origin main
   ```

---

## Next Steps

1. ✅ Run `./start-dev.sh` or the manual commands above
2. ✅ Open the Firebase preview
3. ✅ Login to the dashboard (any email/password works)
4. ✅ Click "PCI Resolution" to see your working module!

---

**Firebase Web IDE is ready! 🔥**

