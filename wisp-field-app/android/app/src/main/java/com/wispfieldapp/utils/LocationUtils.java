package com.wispfieldapp.utils;

public class LocationUtils {
    /**
     * Calculate azimuth (bearing) from point A to point B
     * @param lat1 Latitude of point A
     * @param lon1 Longitude of point A
     * @param lat2 Latitude of point B
     * @param lon2 Longitude of point B
     * @return Azimuth in degrees (0-360)
     */
    public static double calculateAzimuth(double lat1, double lon1, double lat2, double lon2) {
        double lat1Rad = Math.toRadians(lat1);
        double lat2Rad = Math.toRadians(lat2);
        double deltaLon = Math.toRadians(lon2 - lon1);

        double y = Math.sin(deltaLon) * Math.cos(lat2Rad);
        double x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
                   Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLon);

        double azimuth = Math.toDegrees(Math.atan2(y, x));
        
        // Normalize to 0-360
        return (azimuth + 360) % 360;
    }

    /**
     * Calculate distance between two points in meters
     * @param lat1 Latitude of point A
     * @param lon1 Longitude of point A
     * @param lat2 Latitude of point B
     * @param lon2 Longitude of point B
     * @return Distance in meters
     */
    public static double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371000; // Earth radius in meters

        double lat1Rad = Math.toRadians(lat1);
        double lat2Rad = Math.toRadians(lat2);
        double deltaLat = Math.toRadians(lat2 - lat1);
        double deltaLon = Math.toRadians(lon2 - lon1);

        double a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                   Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                   Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Find the sector that best matches an azimuth
     * @param sectors List of sectors with azimuth information
     * @param targetAzimuth The azimuth to match
     * @return The best matching sector, or null if none found
     */
    public static java.util.Map<String, Object> findBestMatchingSector(
            java.util.List<java.util.Map<String, Object>> sectors, 
            double targetAzimuth) {
        if (sectors == null || sectors.isEmpty()) {
            return null;
        }

        double bestMatch = Double.MAX_VALUE;
        java.util.Map<String, Object> bestSector = null;

        for (java.util.Map<String, Object> sector : sectors) {
            Object azimuthObj = sector.get("azimuth");
            if (azimuthObj == null) continue;

            double sectorAzimuth;
            if (azimuthObj instanceof Number) {
                sectorAzimuth = ((Number) azimuthObj).doubleValue();
            } else {
                try {
                    sectorAzimuth = Double.parseDouble(azimuthObj.toString());
                } catch (NumberFormatException e) {
                    continue;
                }
            }

            // Calculate angular difference (handling 360/0 wrap-around)
            double diff = Math.abs(targetAzimuth - sectorAzimuth);
            if (diff > 180) {
                diff = 360 - diff;
            }

            if (diff < bestMatch) {
                bestMatch = diff;
                bestSector = sector;
            }
        }

        return bestSector;
    }
}
