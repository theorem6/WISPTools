# 🔐 Authentication Flow - LTE WISP Management Platform

## User Journey

```
┌─────────────────────────────────────────────────────────────┐
│                  Application Entry Point                    │
│                    / (root page)                            │
│                                                             │
│  Checks: localStorage.getItem('isAuthenticated')           │
└─────────────┬───────────────────────────────────────────────┘
              │
              ├─────────────────┬──────────────────────┐
              │                 │                      │
         Not Logged In     Logged In              Loading
              │                 │                      │
              ▼                 ▼                      ▼
    ┌──────────────────┐ ┌──────────────────┐  ┌──────────┐
    │   /login page    │ │  /dashboard      │  │ Spinner  │
    │                  │ │                  │  └──────────┘
    │ • Email/Password │ │ • Welcome message│
    │ • Sign In/Up     │ │ • Module cards   │
    │ • Demo mode      │ │ • User info      │
    └────────┬─────────┘ │ • Logout button  │
             │           └────────┬─────────┘
             │                    │
      [User submits form]    [User clicks module]
             │                    │
             ▼                    ▼
    ┌──────────────────┐ ┌──────────────────┐
    │ Set localStorage │ │   /modules/      │
    │ • isAuthenticated│ │   pci-resolution │
    │ • userEmail      │ │                  │
    └────────┬─────────┘ │ • Module content │
             │           │ • Back to dash   │
             │           │ • Logout button  │
             └───────────►                  │
                         └──────────────────┘
```

## Page Flow

### 1. Root Page (/)
**Purpose**: Entry point and router
**Logic**:
```typescript
if (isAuthenticated) {
  goto('/dashboard');
} else {
  goto('/login');
}
```

### 2. Login Page (/login)
**Purpose**: User authentication
**Features**:
- Email/password form
- Sign in / Sign up toggle
- Demo mode (any credentials work)
- Redirects to /dashboard on success

**Actions**:
```typescript
function handleSubmit() {
  localStorage.setItem('isAuthenticated', 'true');
  localStorage.setItem('userEmail', email);
  goto('/dashboard');
}
```

### 3. Dashboard (/dashboard)
**Purpose**: Post-login landing page
**Features**:
- Welcome message
- Module grid (4 modules)
- User email display
- Theme toggle
- Logout button

**Protection**:
```typescript
onMount(() => {
  if (!isAuthenticated) {
    goto('/login');
  }
});
```

**Modules**:
- 📊 PCI Resolution (Active)
- 📡 Coverage Planning (Coming Soon)
- 🌐 Spectrum Management (Coming Soon)
- ⚡ Network Optimization (Coming Soon)

### 4. Module Pages (/modules/*)
**Purpose**: Module-specific functionality
**Features**:
- Module content
- Back to dashboard button
- Logout button (optional)

**Example**: `/modules/pci-resolution`

## Authentication State

### LocalStorage Keys

| Key | Value | Purpose |
|-----|-------|---------|
| `isAuthenticated` | `'true'` / `'false'` | Authentication status |
| `userEmail` | Email string | User identification |
| `theme` | `'light'` / `'dark'` | Theme preference |

### Checking Authentication

```typescript
const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
```

### Logging Out

```typescript
function handleLogout() {
  localStorage.removeItem('isAuthenticated');
  localStorage.removeItem('userEmail');
  goto('/login');
}
```

## Demo Mode

Currently using localStorage for demo purposes.

**Accepts**: Any email/password combination

**Future**: Will be replaced with Firebase Authentication from Login_Logic fork

```typescript
// Current (Demo)
localStorage.setItem('isAuthenticated', 'true');

// Future (Firebase)
import { signInWithEmailAndPassword } from 'firebase/auth';
const userCredential = await signInWithEmailAndPassword(auth, email, password);
```

## Route Protection

All pages except `/login` should check authentication:

```typescript
onMount(() => {
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  if (isAuthenticated !== 'true') {
    goto('/login');
    return;
  }
  // ... rest of component logic
});
```

## Integration with Login_Logic Fork

### Current Implementation (Demo)
- Uses localStorage
- No actual authentication
- Any credentials work

### Future Implementation (Production)

Will integrate Firebase Auth from `Login_Logic/` fork:

1. **Firebase Configuration**
```typescript
// From Login_Logic fork
import { auth, db } from '$lib/firebase';
import { authService } from '$lib/services/authService';
import { authStore } from '$lib/stores/authStore';
```

2. **Sign In**
```typescript
const result = await authService.signIn(email, password);
if (result.success) {
  goto('/dashboard');
}
```

3. **Sign Up**
```typescript
const result = await authService.signUp(email, password);
if (result.success) {
  goto('/dashboard');
}
```

4. **Auth State**
```typescript
import { isAuthenticated, currentUser } from '$lib/stores/authStore';

$: if (!$isAuthenticated) {
  goto('/login');
}
```

5. **Logout**
```typescript
await authService.signOut();
goto('/login');
```

## Security Notes

### Current (Demo Mode)
⚠️ **Not Secure** - Uses only localStorage
- No actual authentication
- No token verification
- Client-side only

### Future (Firebase Auth)
✅ **Secure** - Firebase handles:
- Secure token management
- Server-side verification
- Encrypted storage
- Session management
- User isolation

## User Experience

### First Visit
```
1. User visits site → Redirects to /login
2. User enters credentials → Submits form
3. System authenticates → Sets localStorage
4. Redirects to /dashboard → Shows modules
```

### Returning Visit (Logged In)
```
1. User visits site → Checks localStorage
2. Found 'isAuthenticated=true' → Redirects to /dashboard
3. User continues working
```

### Logout
```
1. User clicks Logout → Clears localStorage
2. Redirects to /login → Shows login form
```

## Testing the Flow

### Test Login
1. Visit `http://localhost:5173/`
2. Should redirect to `/login`
3. Enter any email/password
4. Click "Sign In"
5. Should redirect to `/dashboard`

### Test Dashboard
1. Should see welcome message
2. Should see 4 module cards
3. Should see user email in header
4. Can toggle dark/light mode

### Test Module Access
1. Click "PCI Resolution" card
2. Should navigate to `/modules/pci-resolution`
3. Click "Back to Dashboard"
4. Should return to `/dashboard`

### Test Logout
1. Click "Logout" button
2. Should clear authentication
3. Should redirect to `/login`
4. Try accessing `/dashboard` directly
5. Should redirect back to `/login`

## Files Modified

1. **src/routes/+page.svelte** - Root redirect logic
2. **src/routes/login/+page.svelte** - New login page
3. **src/routes/dashboard/+page.svelte** - New post-login dashboard
4. **src/routes/modules/pci-resolution/+page.svelte** - Updated back button

## Summary

**Current Flow**:
```
/ → Check auth → /login OR /dashboard
                      ↓
                [Login form]
                      ↓
                [Submit] → /dashboard
                              ↓
                      [Module cards]
                              ↓
                      [Click module]
                              ↓
                    /modules/pci-resolution
```

**Authentication**: Demo mode (localStorage)
**Future**: Firebase Authentication integration
**User Flow**: Login → Dashboard → Modules
**Protection**: All pages check isAuthenticated

---

**Next Steps**:
1. ✅ Login page created
2. ✅ Dashboard page created
3. ✅ Route protection added
4. 🔄 Future: Integrate Firebase Auth from Login_Logic fork

