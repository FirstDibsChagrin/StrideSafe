# StrideSafe

High school cross-country injury prediction platform.

## Stack

- **Frontend**: Next.js 14 (App Router) — deployed on Vercel
- **Backend**: Python FastAPI
- **Database & Auth**: Supabase

## Project Structure

```
stridesafe/
  frontend/   Next.js app
  backend/    FastAPI app
```

## Getting Started

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload  # http://localhost:8000
```

## Environment Variables

Copy the placeholder files and fill in your values:

- `frontend/.env.local`
- `backend/.env`
