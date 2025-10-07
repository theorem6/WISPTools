#!/bin/bash
# Simple script to set MongoDB password in apphosting.yaml files

echo "🔐 MongoDB Password Setup"
echo "========================="
echo ""
echo "Your MongoDB connection string:"
echo "mongodb+srv://genieacs-user:<db_password>@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
echo ""
echo "Please enter your MongoDB Atlas password for user 'genieacs-user':"
read -s MONGODB_PASSWORD

if [ -z "$MONGODB_PASSWORD" ]; then
    echo "❌ Password cannot be empty"
    exit 1
fi

echo ""
echo "📝 Updating configuration files..."

# Update apphosting.yaml
sed -i "s/<db_password>/$MONGODB_PASSWORD/g" apphosting.yaml
echo "✅ Updated apphosting.yaml"

# Update apphosting.staging.yaml
sed -i "s/<db_password>/$MONGODB_PASSWORD/g" apphosting.staging.yaml
echo "✅ Updated apphosting.staging.yaml"

# Update apphosting.development.yaml
sed -i "s/<db_password>/$MONGODB_PASSWORD/g" apphosting.development.yaml
echo "✅ Updated apphosting.development.yaml"

echo ""
echo "✅ All configuration files updated!"
echo ""
echo "🚀 Next steps:"
echo "1. cd functions && npm install"
echo "2. cd .. && firebase deploy"
echo ""
echo "⚠️  Important: Your password is now in the config files."
echo "    Do NOT commit these files to public repositories!"
echo "    Consider using Firebase Secrets for production."
echo ""

