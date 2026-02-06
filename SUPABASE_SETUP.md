# Supabase Database Setup Guide

## Overview

Agent Sandbox now supports **Supabase (PostgreSQL)** for the user system, including:
- User registration and login
- Credits system
- Task history

## Setup Steps

### 1. Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click **"New Project"**
3. Fill in:
   - **Name**: `agent-sandbox` (or your preference)
   - **Database Password**: Generate a strong password
4. Click **"Create new project"**
5. Wait for the project to be ready (~1 minute)

### 2. Get Connection String

1. In your Supabase dashboard, go to **Settings** → **Database**
2. Find the **"Connection string"** section
3. Copy the **URI** (it looks like):
   ```
   postgres://postgres:password@host:5432/postgres
   ```

### 3. Configure Vercel

1. Go to https://vercel.com/bravesilvas-projects/agent-sandbox/settings
2. Click **"Environment Variables"**
3. Add:
   - **Name**: `DATABASE_URL`
   - **Value**: Your Supabase connection string (replace `postgres:` with actual password)
   - **Environment**: `Production`, `Preview`, `Development` all checked
4. Click **"Save"**

### 4. Trigger New Deployment

After adding the environment variable, Vercel will automatically redeploy.

To check the status:
```bash
vercel ls
```

## Supabase Dashboard

| Link | Description |
|------|-------------|
| https://supabase.com/dashboard/projects | Your projects |
| https://supabase.com/dashboard/project/xxx/settings/database | Connection settings |
| https://supabase.com/dashboard/project/xxx/sql-editor | SQL Editor |

## Testing Locally

Create a `.env.local` file in the project root:

```bash
DATABASE_URL="postgres://user:password@host:5432/database?sslmode=require"
```

Then run:
```bash
npm start
```

## Database Schema

The app will automatically create these tables on first run:

- `users` - User accounts and credits
- `tasks` - Task submissions
- `credit_transactions` - Credit history

## Troubleshooting

### "Connection refused"

- Check if Supabase project is active
- Verify the connection string is correct
- Ensure `sslmode=require` is included

### "Role does not exist"

- Supabase uses a specific database user
- Use the connection string from Supabase dashboard, not the "psycopg2" string

### Tables not created

- Check Vercel function logs
- Ensure `DATABASE_URL` is set in Vercel environment variables
- The first request will trigger table creation

## API Endpoints

After setup, these endpoints work:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login user |
| GET | `/api/v1/user/profile` | Get user info (requires auth) |
| POST | `/api/v1/tasks` | Submit task (requires auth) |
| GET | `/api/v1/user/tasks` | Get task history (requires auth) |

## Example Request

```bash
# Register
curl -X POST https://agent-sandbox.vercel.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"myuser","password":"mypassword"}'

# Login
curl -X POST https://agent-sandbox.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"myuser","password":"mypassword"}'
```
