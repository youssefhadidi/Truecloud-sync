# Backend API

The app communicates with a **Truecloud** backend (Next.js + NextAuth).

## Authentication

### 1. Get CSRF token
```
GET /api/auth/csrf
→ 200 { csrfToken: "..." }
```

### 2. Login
```
POST /api/auth/callback/credentials
Content-Type: application/x-www-form-urlencoded

csrfToken=...&email=user@example.com&password=secret

→ 302  Set-Cookie: next-auth.session-token=<jwt>
```

The session token value is stored in AsyncStorage and injected into every subsequent request as:
```
Cookie: next-auth.session-token=<jwt>
```

## File operations

### List files in sync folder
```
GET /api/files?path=sync
Authorization via Cookie

→ 200 {
  "files": [
    { "name": "photo.jpg", "path": "sync/photo.jpg", "size": 2048576, ... }
  ]
}
```

### Upload a file
```
POST /api/files/upload?path=sync
Content-Type: multipart/form-data
Cookie: next-auth.session-token=<jwt>

file=<binary>

→ 200 { "success": true, "file": { "name": "photo.jpg", ... } }
```

Field name must be `file`. The sync folder path is passed as the `path` query parameter.

### Create sync folder (if it doesn't exist)
```
POST /api/files/mkdir
Content-Type: application/json

{ "name": "sync", "path": "" }

→ 200 { "success": true }
```
