# KickCraft

Interactive 3D shoe customization and pickup-reservation system for an original shoe brand, backed by a persistent PHP REST API and MySQL database.

## Architecture

```text
Vue 3 Frontend (Vite) ──> PHP REST API (Apache / XAMPP) ──> MySQL Database (kickcraft_db)
```

- **Frontend:** Vue 3 `<script setup>`, Tailwind CSS, Google `<model-viewer>` for local 3D GLB shoe models, custom charm anchors.
- **Backend API:** Flat PHP endpoints under `api/` served via XAMPP Apache, PDO prepared statements on 100% of queries (SQL injection free), native session authentication (`PHPSESSID`), soft & hard delete flags (zero physical row deletion).
- **Database:** MySQL (`kickcraft_db`) with tables for `users`, `shoes`, and `reservations`.

---

## Local Setup with XAMPP

### 1. Start XAMPP Apache & MySQL
1. Open **XAMPP Control Panel**.
2. Start both **Apache** and **MySQL**.

### 2. Initialize the Database
Import `api/database/setup.sql` into MySQL:

**Via phpMyAdmin:**
1. Navigate to `http://localhost/phpmyadmin`.
2. Click **Import** -> Choose `api/database/setup.sql` -> Click **Import**.

**Or via command line (PowerShell):**
```powershell
& "C:\xampp\mysql\bin\mysql.exe" -u root < "api/database/setup.sql"
```

This creates `kickcraft_db` and seeds:
- **Default Owner/Admin:** `admin@kickcraft.local` / `kickcraft2026`
- **Initial Silhouettes:** KickCraft One, Nike Air Max, Nike Dunk (with full parts, palette, and stock)
- **Sample Reservations:** KC-2026-1041 through KC-2026-1044

### 3. Deploy API to XAMPP Apache
Link or copy the project folder to `C:\xampp\htdocs\kickcraft`:

```powershell
# In PowerShell (run as Administrator if creating symlink):
New-Item -ItemType SymbolicLink -Path "C:\xampp\htdocs\kickcraft" -Target (Get-Location).Path
```
*(Or copy the project folder directly into `C:\xampp\htdocs\kickcraft`)*

Verify the API is reachable at:
`http://localhost/kickcraft/api/shoes/list.php`

### 4. Run the Vue Development Server
```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite development server automatically proxies `/api/*` requests to `http://localhost/kickcraft/api/*`.

---

## Testing & Quality Assurance

```powershell
npm test        # Runs all 118 unit and integration tests
npm run build   # Verifies production client bundle compilation
```

---

## Default Credentials
- **Owner / Admin Portal:**
  - Email: `admin@kickcraft.local`
  - Password: `kickcraft2026`
- **Customer:**
  - Customers can register accounts or place reservations as guests directly through the 3D studio.
