package com.wispfieldapp.utils;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class CameraUtils {
    public static final int REQUEST_CAMERA_PERMISSION = 100;
    public static final int REQUEST_IMAGE_CAPTURE = 101;
    public static final int REQUEST_QR_SCAN = 102;
    
    public static boolean checkCameraPermission(Activity activity) {
        return ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }
    
    public static void requestCameraPermission(Activity activity) {
        ActivityCompat.requestPermissions(activity, new String[]{Manifest.permission.CAMERA}, REQUEST_CAMERA_PERMISSION);
    }
    
    public static File createImageFile(Activity activity) throws IOException {
        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        String imageFileName = "JPEG_" + timeStamp + "_";
        File storageDir = activity.getExternalFilesDir(null);
        if (storageDir == null) {
            storageDir = activity.getFilesDir();
        }
        File image = File.createTempFile(imageFileName, ".jpg", storageDir);
        return image;
    }
    
    public static void dispatchTakePictureIntent(Activity activity, File photoFile) {
        Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (takePictureIntent.resolveActivity(activity.getPackageManager()) != null) {
            Uri photoURI = FileProvider.getUriForFile(activity,
                    "com.wispfieldapp.fileprovider",
                    photoFile);
            takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoURI);
            takePictureIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            activity.startActivityForResult(takePictureIntent, REQUEST_IMAGE_CAPTURE);
        }
    }
    
    public static void startQRScanner(Activity activity) {
        Intent intent = new Intent(activity, com.wispfieldapp.activities.QRScannerActivity.class);
        activity.startActivityForResult(intent, REQUEST_QR_SCAN);
    }
    
    public static boolean isImageCaptureResult(int requestCode, int resultCode) {
        return requestCode == REQUEST_IMAGE_CAPTURE && resultCode == Activity.RESULT_OK;
    }
    
    public static boolean isQRScanResult(int requestCode, int resultCode) {
        return requestCode == REQUEST_QR_SCAN && resultCode == Activity.RESULT_OK;
    }
    
    public static byte[] readImageFile(File file) throws IOException {
        byte[] buffer = new byte[(int) file.length()];
        FileInputStream fis = new FileInputStream(file);
        fis.read(buffer);
        fis.close();
        return buffer;
    }
}
