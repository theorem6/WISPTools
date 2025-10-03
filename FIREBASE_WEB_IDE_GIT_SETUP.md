# 🔧 Fix Git Authentication in Firebase Web IDE (Permanent Solution)

## 🚨 Problem

Firebase Web IDE shows this error when trying to push:
```bash
fatal: cannot exec '/nix/store/5i3x58p9483gb87yg7jirj30y8lyaykr-code-oss/extensions/git/dist/askpass.sh': No such file or directory
Username for 'https://github.com': 
```

**Cause**: The Git credential helper is trying to use a VSCode extension script that doesn't exist in the containerized environment.

## ✅ Permanent Solution (Personal Access Token Method)

### Step 1: Disable the Problematic Credential Helper

Run these commands in your Firebase Web IDE terminal:

```bash
# Unset the problematic GIT_ASKPASS
unset GIT_ASKPASS

# Disable VSCode's credential helper globally
git config --global --unset credential.helper

# Set a simple credential helper (store or cache)
git config --global credential.helper store
```

### Step 2: Create GitHub Personal Access Token

1. **Go to GitHub**: https://github.com/settings/tokens
2. **Click**: "Generate new token" → "Generate new token (classic)"
3. **Note**: `Firebase Web IDE - PCI Mapper`
4. **Expiration**: Choose your preference (90 days, 1 year, or no expiration)
5. **Select scopes**: 
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
6. **Click**: "Generate token"
7. **COPY THE TOKEN** - You won't see it again!

Example token format: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Step 3: Push Using Personal Access Token

```bash
# When prompted for username, use your GitHub username
# When prompted for password, paste the Personal Access Token

git push origin main
```

**Username**: `your-github-username`  
**Password**: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (paste your token)

The credential will be stored and you won't need to enter it again!

### Step 4: Persist Settings Across Sessions

Add these to your shell profile to make it permanent:

```bash
# Add to ~/.bashrc or ~/.bash_profile
echo 'unset GIT_ASKPASS' >> ~/.bashrc
echo 'export GIT_TERMINAL_PROMPT=1' >> ~/.bashrc

# Reload the profile
source ~/.bashrc
```

## 🔐 Alternative: SSH Key Method (More Secure)

### Step 1: Generate SSH Key in Firebase Web IDE

```bash
# Generate SSH key (press Enter for all prompts)
ssh-keygen -t ed25519 -C "your-email@example.com"

# Start SSH agent
eval "$(ssh-agent -s)"

# Add SSH key to agent
ssh-add ~/.ssh/id_ed25519

# Display public key (copy this)
cat ~/.ssh/id_ed25519.pub
```

### Step 2: Add SSH Key to GitHub

1. **Copy the public key** from the output above
2. **Go to GitHub**: https://github.com/settings/keys
3. **Click**: "New SSH key"
4. **Title**: `Firebase Web IDE`
5. **Key**: Paste the public key
6. **Click**: "Add SSH key"

### Step 3: Change Remote URL to SSH

```bash
# View current remote
git remote -v

# Change to SSH URL (replace theorem6 with your username)
git remote set-url origin git@github.com:theorem6/lte-pci-mapper.git

# Test connection
ssh -T git@github.com

# Push
git push origin main
```

## 🚀 Quick Fix Commands (Copy & Paste)

### For Existing Repository (HTTPS + Token):

```bash
# Fix credential helper
unset GIT_ASKPASS
git config --global --unset credential.helper
git config --global credential.helper store
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"

# Push (will prompt for credentials once)
git push origin main
```

### Verify Your Setup:

```bash
# Check Git config
git config --list | grep credential

# Should show:
# credential.helper=store

# Check remote URL
git remote -v

# For HTTPS should show:
# origin  https://github.com/USERNAME/REPO.git

# For SSH should show:
# origin  git@github.com:USERNAME/REPO.git
```

## 🔍 Troubleshooting

### Issue: Still Getting askpass Error

```bash
# Force disable all credential helpers
git config --global --unset-all credential.helper
git config --system --unset-all credential.helper
unset GIT_ASKPASS
unset SSH_ASKPASS

# Use inline credentials (temporary)
git push https://USERNAME:TOKEN@github.com/USERNAME/REPO.git main
```

### Issue: Permission Denied

```bash
# Check your token has correct permissions
# Token must have 'repo' scope enabled

# Or check SSH key is added
ssh -T git@github.com
# Should say: "Hi USERNAME! You've successfully authenticated"
```

### Issue: Token Not Saving

```bash
# Use cache helper instead (expires after 1 hour by default)
git config --global credential.helper 'cache --timeout=3600'

# Or manually store credentials
echo "https://USERNAME:TOKEN@github.com" >> ~/.git-credentials
git config --global credential.helper store
```

## 📋 Environment Variables (Persistent Setup)

Add these to `~/.bashrc` for permanent configuration:

```bash
# Add these lines to ~/.bashrc
cat >> ~/.bashrc << 'EOF'

# Git configuration for Firebase Web IDE
unset GIT_ASKPASS
export GIT_TERMINAL_PROMPT=1
export GIT_EDITOR=nano

# Git credential helper
git config --global credential.helper store

# Git user info (replace with your details)
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"

EOF

# Reload
source ~/.bashrc
```

## ✅ Verification Checklist

Run these commands to verify everything works:

```bash
# 1. Check credential helper
git config --get credential.helper
# Should output: store

# 2. Check no askpass is set
env | grep -i askpass
# Should be empty

# 3. Test Git operation
git status

# 4. Test remote connection
git fetch origin

# 5. Test push
git push origin main
```

## 🎯 Recommended Setup (Best Practices)

For Firebase Web IDE, we recommend:

1. **Use Personal Access Token** (easier to manage)
2. **Set expiration to 90 days** (good security balance)
3. **Use `credential.helper store`** (simple and persistent)
4. **Add settings to ~/.bashrc** (survives container restarts)

### Complete Setup Script:

```bash
#!/bin/bash
# Run this once to set up Git permanently

# Disable askpass
unset GIT_ASKPASS
echo 'unset GIT_ASKPASS' >> ~/.bashrc

# Configure credential helper
git config --global credential.helper store
git config --global user.name "Your Name"  # CHANGE THIS
git config --global user.email "your-email@example.com"  # CHANGE THIS

# Set sensible defaults
git config --global push.default current
git config --global pull.rebase false
git config --global init.defaultBranch main

# Reload bash config
source ~/.bashrc

echo "✅ Git configured! Now run: git push origin main"
echo "You'll be prompted once for username and token."
```

## 📖 Related Documentation

- [CREATE_GITHUB_REPO.md](CREATE_GITHUB_REPO.md) - Creating your GitHub repository
- [PUSH_TO_GITHUB.md](PUSH_TO_GITHUB.md) - Pushing code to GitHub
- [GITHUB_SETUP.md](GITHUB_SETUP.md) - General GitHub setup guide

## 🆘 Still Having Issues?

If problems persist:

1. **Clear all Git credentials**:
   ```bash
   rm -f ~/.git-credentials
   git config --global --unset credential.helper
   ```

2. **Use inline credentials** (one-time):
   ```bash
   git push https://USERNAME:TOKEN@github.com/theorem6/lte-pci-mapper.git main
   ```

3. **Check Firebase Web IDE logs** for persistent issues

4. **Use GitHub CLI** as alternative:
   ```bash
   # Install GitHub CLI
   curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
   
   # Authenticate
   gh auth login
   
   # Push
   gh repo sync
   ```

---

**🎉 After following this guide, your Git connection should work permanently in Firebase Web IDE!**

