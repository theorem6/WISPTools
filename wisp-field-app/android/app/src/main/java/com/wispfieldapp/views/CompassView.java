package com.wispfieldapp.views;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.util.AttributeSet;
import android.view.View;

public class CompassView extends View {
    private Paint backgroundPaint;
    private Paint compassPaint;
    private Paint targetPaint;
    private Paint indicatorPaint;
    private Paint textPaint;
    
    private float currentHeading = 0; // Device heading in degrees (0-360)
    private float targetAzimuth = 0; // Target azimuth in degrees (0-360)
    private boolean hasTarget = false;
    
    private static final float TOLERANCE = 5.0f; // Degrees tolerance for "aimed properly"
    
    public CompassView(Context context) {
        super(context);
        init();
    }
    
    public CompassView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }
    
    private void init() {
        backgroundPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        backgroundPaint.setColor(Color.parseColor("#1a2332"));
        backgroundPaint.setStyle(Paint.Style.FILL);
        
        compassPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        compassPaint.setColor(Color.WHITE);
        compassPaint.setStyle(Paint.Style.STROKE);
        compassPaint.setStrokeWidth(3);
        
        targetPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        targetPaint.setColor(Color.parseColor("#00d9ff")); // Brand cyan
        targetPaint.setStyle(Paint.Style.STROKE);
        targetPaint.setStrokeWidth(4);
        
        indicatorPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        indicatorPaint.setColor(Color.parseColor("#10b981")); // Green for aligned
        indicatorPaint.setStyle(Paint.Style.FILL);
        
        textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setColor(Color.WHITE);
        textPaint.setTextSize(36);
        textPaint.setTextAlign(Paint.Align.CENTER);
    }
    
    public void setCurrentHeading(float heading) {
        this.currentHeading = heading;
        invalidate();
    }
    
    public void setTargetAzimuth(float azimuth) {
        this.targetAzimuth = azimuth;
        this.hasTarget = true;
        invalidate();
    }
    
    public void clearTarget() {
        this.hasTarget = false;
        invalidate();
    }
    
    public boolean isAimedProperly() {
        if (!hasTarget) return false;
        float diff = Math.abs(currentHeading - targetAzimuth);
        if (diff > 180) diff = 360 - diff;
        return diff <= TOLERANCE;
    }
    
    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        
        int width = getWidth();
        int height = getHeight();
        int centerX = width / 2;
        int centerY = height / 2;
        int radius = Math.min(width, height) / 2 - 20;
        
        // Draw background circle
        canvas.drawCircle(centerX, centerY, radius, backgroundPaint);
        canvas.drawCircle(centerX, centerY, radius, compassPaint);
        
        // Draw compass rose (N, E, S, W markers)
        drawCompassRose(canvas, centerX, centerY, radius);
        
        // Draw target azimuth line (cyan)
        if (hasTarget) {
            float targetAngle = (float) Math.toRadians(targetAzimuth - 90); // Adjust for screen coordinates
            float endX = centerX + radius * (float) Math.cos(targetAngle);
            float endY = centerY + radius * (float) Math.sin(targetAngle);
            
            canvas.drawLine(centerX, centerY, endX, endY, targetPaint);
            
            // Draw target indicator at edge
            Path targetArrow = new Path();
            targetArrow.moveTo(endX, endY);
            float arrowSize = 20;
            targetArrow.lineTo(endX - arrowSize * (float) Math.cos(targetAngle - Math.PI / 6), 
                             endY - arrowSize * (float) Math.sin(targetAngle - Math.PI / 6));
            targetArrow.lineTo(endX - arrowSize * (float) Math.cos(targetAngle + Math.PI / 6), 
                             endY - arrowSize * (float) Math.sin(targetAngle + Math.PI / 6));
            targetArrow.close();
            canvas.drawPath(targetArrow, targetPaint);
        }
        
        // Draw current heading indicator (white arrow)
        float headingAngle = (float) Math.toRadians(currentHeading - 90);
        float arrowLength = radius - 10;
        float arrowX = centerX + arrowLength * (float) Math.cos(headingAngle);
        float arrowY = centerY + arrowLength * (float) Math.sin(headingAngle);
        
        Paint headingPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        headingPaint.setColor(Color.WHITE);
        headingPaint.setStyle(Paint.Style.FILL);
        
        Path headingArrow = new Path();
        headingArrow.moveTo(arrowX, arrowY);
        float arrowSize = 30;
        headingArrow.lineTo(arrowX - arrowSize * (float) Math.cos(headingAngle - Math.PI / 6), 
                           arrowY - arrowSize * (float) Math.sin(headingAngle - Math.PI / 6));
        headingArrow.lineTo(arrowX - arrowSize * (float) Math.cos(headingAngle + Math.PI / 6), 
                           arrowY - arrowSize * (float) Math.sin(headingAngle + Math.PI / 6));
        headingArrow.close();
        canvas.drawPath(headingArrow, headingPaint);
        
        // Draw center dot
        canvas.drawCircle(centerX, centerY, 8, headingPaint);
        
        // Draw alignment indicator (green circle when aimed properly)
        if (isAimedProperly()) {
            canvas.drawCircle(centerX, centerY, 15, indicatorPaint);
        }
        
        // Draw heading text
        String headingText = String.format("%.0f°", currentHeading);
        canvas.drawText(headingText, centerX, centerY + 60, textPaint);
        
        // Draw target azimuth text if set
        if (hasTarget) {
            Paint targetTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            targetTextPaint.setColor(Color.parseColor("#00d9ff"));
            targetTextPaint.setTextSize(28);
            targetTextPaint.setTextAlign(Paint.Align.CENTER);
            String targetText = String.format("Target: %.0f°", targetAzimuth);
            canvas.drawText(targetText, centerX, centerY - radius - 30, targetTextPaint);
            
            // Draw difference
            float diff = currentHeading - targetAzimuth;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            
            Paint diffPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            diffPaint.setColor(isAimedProperly() ? Color.parseColor("#10b981") : Color.parseColor("#f59e0b"));
            diffPaint.setTextSize(24);
            diffPaint.setTextAlign(Paint.Align.CENTER);
            String diffText = String.format("%s%.0f°", diff >= 0 ? "+" : "", diff);
            canvas.drawText(diffText, centerX, centerY + 100, diffPaint);
        }
    }
    
    private void drawCompassRose(Canvas canvas, int centerX, int centerY, int radius) {
        Paint markerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        markerPaint.setColor(Color.WHITE);
        markerPaint.setStyle(Paint.Style.STROKE);
        markerPaint.setStrokeWidth(2);
        
        Paint labelPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        labelPaint.setColor(Color.WHITE);
        labelPaint.setTextSize(32);
        labelPaint.setTextAlign(Paint.Align.CENTER);
        labelPaint.setFakeBoldText(true);
        
        // Draw cardinal directions
        String[] directions = {"N", "E", "S", "W"};
        float[] angles = {0, 90, 180, 270};
        
        for (int i = 0; i < directions.length; i++) {
            float angle = (float) Math.toRadians(angles[i] - 90);
            float x = centerX + (radius - 15) * (float) Math.cos(angle);
            float y = centerY + (radius - 15) * (float) Math.sin(angle);
            
            // Draw marker line
            float markerX = centerX + (radius - 5) * (float) Math.cos(angle);
            float markerY = centerY + (radius - 5) * (float) Math.sin(angle);
            canvas.drawLine(centerX, centerY, markerX, markerY, markerPaint);
            
            // Draw label
            canvas.drawText(directions[i], x, y + 12, labelPaint);
        }
    }
}
