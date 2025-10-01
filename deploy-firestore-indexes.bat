@echo off
echo ========================================
echo   Deploying Firestore Indexes
echo ========================================
echo.
echo This will deploy the required Firestore indexes to Firebase.
echo.
pause

firebase deploy --only firestore:indexes

echo.
echo ========================================
echo   Deployment Complete!
echo ========================================
echo.
echo The index may take 2-5 minutes to build.
echo You can check the status in Firebase Console.
echo.
pause

