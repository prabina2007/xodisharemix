# xodisharemix.com

Modern full-stack music remix platform with upload, stream, download, OTP auth, JWT auth, and admin management.

## Run

1. Copy `.env.example` to `.env` and set values.
2. Install dependencies:
   - `npm install`
3. Start development server:
   - `npm run dev`
4. Open:
   - `http://localhost:5000`

## Main APIs

- `POST /api/auth/signup/send-otp`
- `POST /api/auth/signup/verify-otp`
- `POST /api/auth/login`
- `POST /api/admin/login`
- `GET /api/songs`
- `GET /api/songs/recent`
- `GET /api/songs/:id`
- `GET /api/songs/:id/download`
- `POST /api/songs/upload` (JWT required)
- `GET /api/admin/users` (Admin JWT)
- `DELETE /api/admin/users/:id` (Admin JWT)
- `GET /api/admin/songs` (Admin JWT)
- `DELETE /api/admin/songs/:id` (Admin JWT)

## Notes

- If SMTP vars are missing, OTP is printed in backend console as dev fallback.
- Uploaded files are stored in category-based folders under `uploads/`.
- Frontend is served statically by Express from `frontend/`.