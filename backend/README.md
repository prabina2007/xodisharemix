# xodisharemix.com

Modern full-stack music remix platform with upload, stream, download, OTP auth, JWT auth, and admin management.

## Project Structure

- `frontend/` : static website files, styles, scripts, and assets
- `backend/` : Express server, API routes, models, uploads, config, and environment file

## Run Locally

1. Open terminal in `C:\projects\xodisharemix\backend`
2. Install dependencies:
   - `npm install`
3. Make sure `backend/.env` has your MongoDB, JWT, and SMTP values
4. Start development server:
   - `npm run dev`
5. Open:
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

- Frontend is served statically by Express from the top-level `frontend/` folder.
- Uploaded files are stored inside `backend/uploads/` and exposed at `/uploads/...`.
- Branding assets like `profile.jpg` and `profile.mp4` are inside `frontend/assets/`.
- If SMTP is unavailable in development, OTP can still fall back to backend console logging depending on env settings.