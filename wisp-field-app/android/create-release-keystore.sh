#!/bin/bash
# Script to create a release keystore for WISPTools.io Android app

KEYSTORE_NAME="wisptools-release.keystore"
KEY_ALIAS="wisptools-key"
KEYSTORE_PASSWORD=""
KEY_PASSWORD=""

echo "=========================================="
echo "WISPTools.io Release Keystore Generator"
echo "=========================================="
echo ""
echo "This script will create a release keystore for signing the Android APK."
echo "IMPORTANT: Keep this keystore file and passwords secure!"
echo ""

# Prompt for passwords
read -sp "Enter keystore password (min 6 characters): " KEYSTORE_PASSWORD
echo ""
read -sp "Enter key password (min 6 characters): " KEY_PASSWORD
echo ""

# Validate passwords
if [ ${#KEYSTORE_PASSWORD} -lt 6 ]; then
    echo "Error: Keystore password must be at least 6 characters"
    exit 1
fi

if [ ${#KEY_PASSWORD} -lt 6 ]; then
    echo "Error: Key password must be at least 6 characters"
    exit 1
fi

# Create keystore
keytool -genkeypair -v -storetype PKCS12 -keystore "$KEYSTORE_NAME" \
    -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KEYSTORE_PASSWORD" -keypass "$KEY_PASSWORD" \
    -dname "CN=WISPTools.io, OU=Development, O=WISPTools, L=Unknown, S=Unknown, C=US"

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ Keystore created successfully!"
    echo "=========================================="
    echo ""
    echo "Keystore file: $KEYSTORE_NAME"
    echo "Key alias: $KEY_ALIAS"
    echo ""
    echo "Next steps:"
    echo "1. Move $KEYSTORE_NAME to android/app/"
    echo "2. Update android/gradle.properties with:"
    echo "   MYAPP_RELEASE_STORE_FILE=$KEYSTORE_NAME"
    echo "   MYAPP_RELEASE_KEY_ALIAS=$KEY_ALIAS"
    echo "   MYAPP_RELEASE_STORE_PASSWORD=$KEYSTORE_PASSWORD"
    echo "   MYAPP_RELEASE_KEY_PASSWORD=$KEY_PASSWORD"
    echo ""
    echo "⚠️  SECURITY: Keep this keystore and passwords secure!"
    echo "   Without this keystore, you cannot update the app on Google Play."
else
    echo "Error: Failed to create keystore"
    exit 1
fi

#!/bin/bash
# Script to create a release keystore for WISPTools.io Android app

KEYSTORE_NAME="wisptools-release.keystore"
KEY_ALIAS="wisptools-key"
KEYSTORE_PASSWORD=""
KEY_PASSWORD=""

echo "=========================================="
echo "WISPTools.io Release Keystore Generator"
echo "=========================================="
echo ""
echo "This script will create a release keystore for signing the Android APK."
echo "IMPORTANT: Keep this keystore file and passwords secure!"
echo ""

# Prompt for passwords
read -sp "Enter keystore password (min 6 characters): " KEYSTORE_PASSWORD
echo ""
read -sp "Enter key password (min 6 characters): " KEY_PASSWORD
echo ""

# Validate passwords
if [ ${#KEYSTORE_PASSWORD} -lt 6 ]; then
    echo "Error: Keystore password must be at least 6 characters"
    exit 1
fi

if [ ${#KEY_PASSWORD} -lt 6 ]; then
    echo "Error: Key password must be at least 6 characters"
    exit 1
fi

# Create keystore
keytool -genkeypair -v -storetype PKCS12 -keystore "$KEYSTORE_NAME" \
    -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KEYSTORE_PASSWORD" -keypass "$KEY_PASSWORD" \
    -dname "CN=WISPTools.io, OU=Development, O=WISPTools, L=Unknown, S=Unknown, C=US"

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ Keystore created successfully!"
    echo "=========================================="
    echo ""
    echo "Keystore file: $KEYSTORE_NAME"
    echo "Key alias: $KEY_ALIAS"
    echo ""
    echo "Next steps:"
    echo "1. Move $KEYSTORE_NAME to android/app/"
    echo "2. Update android/gradle.properties with:"
    echo "   MYAPP_RELEASE_STORE_FILE=$KEYSTORE_NAME"
    echo "   MYAPP_RELEASE_KEY_ALIAS=$KEY_ALIAS"
    echo "   MYAPP_RELEASE_STORE_PASSWORD=$KEYSTORE_PASSWORD"
    echo "   MYAPP_RELEASE_KEY_PASSWORD=$KEY_PASSWORD"
    echo ""
    echo "⚠️  SECURITY: Keep this keystore and passwords secure!"
    echo "   Without this keystore, you cannot update the app on Google Play."
else
    echo "Error: Failed to create keystore"
    exit 1
fi

#!/bin/bash
# Script to create a release keystore for WISPTools.io Android app

KEYSTORE_NAME="wisptools-release.keystore"
KEY_ALIAS="wisptools-key"
KEYSTORE_PASSWORD=""
KEY_PASSWORD=""

echo "=========================================="
echo "WISPTools.io Release Keystore Generator"
echo "=========================================="
echo ""
echo "This script will create a release keystore for signing the Android APK."
echo "IMPORTANT: Keep this keystore file and passwords secure!"
echo ""

# Prompt for passwords
read -sp "Enter keystore password (min 6 characters): " KEYSTORE_PASSWORD
echo ""
read -sp "Enter key password (min 6 characters): " KEY_PASSWORD
echo ""

# Validate passwords
if [ ${#KEYSTORE_PASSWORD} -lt 6 ]; then
    echo "Error: Keystore password must be at least 6 characters"
    exit 1
fi

if [ ${#KEY_PASSWORD} -lt 6 ]; then
    echo "Error: Key password must be at least 6 characters"
    exit 1
fi

# Create keystore
keytool -genkeypair -v -storetype PKCS12 -keystore "$KEYSTORE_NAME" \
    -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KEYSTORE_PASSWORD" -keypass "$KEY_PASSWORD" \
    -dname "CN=WISPTools.io, OU=Development, O=WISPTools, L=Unknown, S=Unknown, C=US"

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ Keystore created successfully!"
    echo "=========================================="
    echo ""
    echo "Keystore file: $KEYSTORE_NAME"
    echo "Key alias: $KEY_ALIAS"
    echo ""
    echo "Next steps:"
    echo "1. Move $KEYSTORE_NAME to android/app/"
    echo "2. Update android/gradle.properties with:"
    echo "   MYAPP_RELEASE_STORE_FILE=$KEYSTORE_NAME"
    echo "   MYAPP_RELEASE_KEY_ALIAS=$KEY_ALIAS"
    echo "   MYAPP_RELEASE_STORE_PASSWORD=$KEYSTORE_PASSWORD"
    echo "   MYAPP_RELEASE_KEY_PASSWORD=$KEY_PASSWORD"
    echo ""
    echo "⚠️  SECURITY: Keep this keystore and passwords secure!"
    echo "   Without this keystore, you cannot update the app on Google Play."
else
    echo "Error: Failed to create keystore"
    exit 1
fi







