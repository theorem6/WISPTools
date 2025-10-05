#!/bin/bash
# Complete GitHub Setup for Module_Manager
# For use in Firebase Web IDE (Linux environment)

echo ""
echo "🚀 LTE WISP Management Platform - GitHub Setup"
echo "================================================"
echo ""

# Check if we're in Module_Manager
if [[ ! "$PWD" == *"Module_Manager"* ]]; then
    echo "❌ Error: Not in Module_Manager directory"
    echo "   Please run: cd Module_Manager"
    echo ""
    exit 1
fi

echo "✅ In Module_Manager directory"
echo ""

# Step 1: Initialize git
if [ ! -d .git ]; then
    echo "📦 Step 1: Initializing git..."
    git init
    git branch -M main
    echo "   ✅ Git initialized with 'main' branch"
else
    echo "✅ Step 1: Git already initialized"
fi
echo ""

# Step 2: Show files to be added
echo "📋 Step 2: Files to commit:"
git status --short | head -20
FILE_COUNT=$(git status --short | wc -l)
echo "   Total: $FILE_COUNT files"
echo ""

# Step 3: Commit
read -p "Continue with commit? (y/n): " CONTINUE
if [[ "$CONTINUE" != "y" && "$CONTINUE" != "Y" ]]; then
    echo "❌ Setup cancelled"
    exit 0
fi

echo ""
echo "💾 Step 3: Committing files..."
git add .
git commit -m "Initial commit: LTE WISP Management Platform - Module Manager"

if [ $? -eq 0 ]; then
    echo "   ✅ Files committed successfully"
else
    echo "   ❌ Commit failed"
    exit 1
fi
echo ""

# Step 4: Add remote
echo "🔗 Step 4: Connect to GitHub"
echo ""

if git remote | grep -q "origin"; then
    EXISTING_REMOTE=$(git remote get-url origin)
    echo "   ℹ️  Remote already configured: $EXISTING_REMOTE"
    read -p "   Change remote? (y/n): " CHANGE
    
    if [[ "$CHANGE" == "y" || "$CHANGE" == "Y" ]]; then
        git remote remove origin
    else
        echo "   Keeping existing remote"
        SKIP_REMOTE=true
    fi
fi

if [[ "$SKIP_REMOTE" != true ]]; then
    echo ""
    echo "   🌐 Create GitHub repository first:"
    echo "   1. Go to: https://github.com/new"
    echo "   2. Name: lte-wisp-platform"
    echo "   3. DO NOT initialize with README"
    echo "   4. Click 'Create repository'"
    echo "   5. Copy the repository URL"
    echo ""
    
    read -p "   Enter GitHub repository URL: " REPO_URL
    
    if [ -z "$REPO_URL" ]; then
        echo "   ❌ No URL provided. Cannot continue."
        echo ""
        echo "   💡 You can add it later with:"
        echo "      git remote add origin YOUR_REPO_URL"
        echo "      git push -u origin main"
        exit 1
    fi
    
    # Clean up URL
    REPO_URL=$(echo "$REPO_URL" | xargs)
    
    git remote add origin "$REPO_URL"
    echo "   ✅ Remote added: $REPO_URL"
fi
echo ""

# Step 5: Push to GitHub
echo "⬆️  Step 5: Push to GitHub"
echo ""

read -p "Ready to push to GitHub? (y/n): " PUSH
if [[ "$PUSH" != "y" && "$PUSH" != "Y" ]]; then
    echo ""
    echo "   ℹ️  Setup complete but not pushed yet"
    echo "   💡 Run this when ready to push:"
    echo "      git push -u origin main"
    exit 0
fi

echo ""
echo "   Pushing to GitHub..."

if git push -u origin main; then
    echo ""
    echo "   ✅ Successfully pushed to GitHub!"
    echo ""
    echo "🎉 GitHub setup complete!"
    echo ""
    echo "📋 Next Steps:"
    echo "   1. Verify on GitHub: Check your repository online"
    echo "   2. Firebase Web IDE will auto-sync!"
    echo "   3. Or manually: Git → Pull from origin"
    echo "   4. Build: npm run build"
    echo "   5. Deploy: firebase deploy --only hosting"
    echo ""
else
    echo ""
    echo "   ❌ Push failed"
    echo ""
    echo "   Common issues:"
    echo "   1. Authentication required"
    echo "      - Run: gh auth login"
    echo "      - Or configure SSH keys"
    echo ""
    echo "   2. Permission denied"
    echo "      - Check repository access"
    echo "      - Verify repository URL"
    echo ""
    echo "   3. Repository doesn't exist"
    echo "      - Create it first at: https://github.com/new"
    echo ""
    echo "   💡 Try again with:"
    echo "      git push -u origin main"
    echo ""
fi

