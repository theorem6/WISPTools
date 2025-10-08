# Firebase App Hosting (Cloud Run) Resource Optimization

## ⚠️ Previous Issues with Original Configuration

### Original Settings (Too Aggressive):
```yaml
cpu: 2                 # Too much for a web app
memoryMiB: 1024        # Too low for ArcGIS + startup
minInstances: 1        # Always costs money, even when idle
maxInstances: 10       # Unnecessarily high for initial deployment
concurrency: 100       # Standard
```

### Problems:
1. **1 GB Memory Too Low**: 
   - ArcGIS is a heavy library
   - SvelteKit SSR needs memory for initialization
   - Startup failures likely due to memory constraints
   - Build needs 4GB (we set this in package.json), runtime needs at least 2GB

2. **2 CPUs Wasteful**:
   - Most web apps only need 1 CPU
   - 2 CPUs doubles the cost unnecessarily
   - SvelteKit serves pre-built static assets, not CPU-intensive

3. **minInstances: 1 Costs Money**:
   - Keeps 1 instance always running
   - You pay 24/7 even when no one is using the app
   - During development/testing, this is wasteful

4. **maxInstances: 10 Too High**:
   - For initial deployment, 5 is more than enough
   - Can always increase later if needed

## ✅ Optimized Configuration

### New Settings (Balanced & Cost-Effective):
```yaml
cpu: 1                 # Sufficient for web apps
memoryMiB: 2048        # 2 GB - handles ArcGIS comfortably
minInstances: 0        # Scale to zero when idle (save costs)
maxInstances: 5        # Sufficient for initial deployment
concurrency: 80        # Standard per-instance concurrency
```

### Benefits:
1. **2 GB Memory**:
   - ✅ Enough headroom for ArcGIS initialization
   - ✅ Prevents out-of-memory crashes during startup
   - ✅ Handles multiple concurrent requests comfortably
   - ✅ Aligns with build memory requirements

2. **1 CPU**:
   - ✅ Sufficient for serving pre-built SvelteKit pages
   - ✅ Cuts CPU costs in half
   - ✅ Standard for most web applications

3. **minInstances: 0**:
   - ✅ Scale to zero when not in use
   - ✅ Only pay when actually serving requests
   - ✅ Ideal for development/testing phase
   - ✅ First request will have cold start (~2-5 seconds)

4. **maxInstances: 5**:
   - ✅ Handles reasonable traffic
   - ✅ Prevents runaway costs if traffic spikes
   - ✅ Can increase later as needed

## 💰 Cost Comparison

### Old Configuration (per month, assuming 50% idle time):
- 2 CPUs × minInstances: 1 × 24/7 = **$48-72/month** (just idling!)
- Plus actual usage costs

### New Configuration (per month, assuming 50% idle time):
- minInstances: 0 = **$0 when idle**
- 1 CPU × actual usage = **$15-25/month** (typical light usage)
- Saves ~$30-50/month during development

## 🎯 When to Adjust Settings

### When to Increase Memory (2GB → 4GB):
- Seeing "out of memory" errors
- Response times degrading under load
- Multiple memory-intensive operations

### When to Add More CPUs (1 → 2):
- CPU-intensive operations (image processing, complex calculations)
- SSR taking too long (>500ms per request)
- CPU usage consistently >70%

### When to Set minInstances > 0:
- **Production launch** - eliminate cold starts
- Consistent traffic 24/7
- User experience requires instant response (<100ms)

### When to Increase maxInstances (5 → 10+):
- Actual traffic exceeds 5 instances
- Seeing "503 Service Unavailable" during spikes
- Monitoring shows instance saturation

## 📊 Monitoring Metrics

After deployment, monitor in Firebase Console:
1. **Instance Count**: How many instances are running
2. **Memory Usage**: Should stay below 80% of 2GB
3. **CPU Usage**: Should stay below 70% average
4. **Cold Start Duration**: With minInstances:0, expect 2-5 seconds
5. **Request Latency**: Should be <500ms for most requests

## 🚀 Recommended Progression

### Phase 1: Development (Current - OPTIMIZED)
```yaml
cpu: 1
memoryMiB: 2048
minInstances: 0
maxInstances: 5
```
**Goal**: Save costs, test functionality

### Phase 2: Beta Testing
```yaml
cpu: 1
memoryMiB: 2048
minInstances: 1        # Keep 1 warm for beta testers
maxInstances: 10       # Handle beta traffic spikes
```
**Goal**: Better UX for testers, scale for load testing

### Phase 3: Production Launch
```yaml
cpu: 1
memoryMiB: 2048
minInstances: 2        # Always have 2 instances for redundancy
maxInstances: 20       # Scale for real users
```
**Goal**: High availability, instant response

## 🔄 Easy Configuration Changes

To change settings later:
1. Edit `apphosting.yaml`
2. Commit and push to GitHub
3. Run `firebase deploy` in Firebase Web IDE
4. New configuration takes effect on next rollout

## 📝 Environment-Specific Overrides

You can create different settings for different environments:
- `apphosting.development.yaml` - Dev environment (scale to zero)
- `apphosting.staging.yaml` - Staging environment (minInstances: 1)
- `apphosting.yaml` - Production environment (minInstances: 2)

Firebase automatically uses the right config based on deployment target.

