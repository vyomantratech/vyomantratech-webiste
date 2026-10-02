# 🚀 Hostinger Database & Production Deployment Guide
**VYOMANTRA TECHNOLOGIES**

This guide provides the exact, step-by-step instructions to connect your Hostinger MySQL database, import the clean production schema, configure your website, and verify production readiness.

---

## 📋 Overview of What is Prepared
Your codebase is now completely cleaned and production-ready:
1. **Demo Data Cleaned**:
   - Demo job postings removed (`data/jobs.json` reset to `[]`).
   - Demo courses removed (`data/courses.json` initialized to `[]`).
   - `careers.html` and `courses.html` are dynamic with clean "No Active Openings / Upcoming Cohorts Launching Soon" empty states.
   - Client reviews and authentic certificate records are preserved intact.
2. **New Course Creation CMS Added**:
   - Added full **Course Creation CMS** inside the Admin Panel (create, edit, delete, publish technical courses, pricing, duration, and syllabi).
   - Connected `courses.html` to `api/get-courses.php` to dynamically display published courses.
3. **Clean Production Schema**:
   - [`schema.sql`](file:///d:/VYOMANTRA%20TECHNOLOGIES/schema.sql) contains all 9 tables with primary keys, indexes, and zero dummy lead data.
   - Includes default Super Admin user credentials.

---

## 🛠️ Step 1: Create Your MySQL Database in Hostinger hPanel

1. Log in to your **[Hostinger hPanel](https://hpanel.hostinger.com/)**.
2. Click **Websites**, find your domain, and click **Manage**.
3. In the left sidebar, navigate to **Databases** ➔ **MySQL Databases**.
4. Under **Create a New MySQL Database and Database User**:
   - **MySQL Database Name**: e.g. `vyomantra`
     *(Hostinger will automatically prepend your hosting ID, resulting in something like `u123456789_vyomantra`)*.
   - **MySQL Username**: e.g. `admin`
     *(Resulting in something like `u123456789_admin`)*.
   - **Password**: Enter a strong password (or click the generator icon).
5. **Important**: Copy down and save your:
   - Full Database Name (e.g. `u123456789_vyomantra`)
   - Full Username (e.g. `u123456789_admin`)
   - Password (e.g. `Your_Generated_Password`)
6. Click **Create**.

---

## 📥 Step 2: Import `schema.sql` via phpMyAdmin

1. On the same **MySQL Databases** page, scroll down to **List of Current MySQL Databases And Users**.
2. Locate your newly created database and click the **Enter phpMyAdmin** button beside it.
3. Once phpMyAdmin opens in a new tab:
   - Look at the top navigation bar and click the **Import** tab.
   - Under **File to import**, click **Choose File** (or Browse).
   - Select the [`schema.sql`](file:///d:/VYOMANTRA%20TECHNOLOGIES/schema.sql) file located in your project root directory.
   - Leave character set as `utf-8` and format as `SQL`.
   - Scroll down to the bottom and click the **Go** button.
4. You will see a success message:
   `Import has been successfully finished, queries executed.`
   You will see 9 clean tables:
   - `admin_users`
   - `certificates`
   - `certificate_logs`
   - `contact_messages`
   - `courses`
   - `course_registrations`
   - `job_applications`
   - `job_postings`
   - `quote_requests`

---

## ⚙️ Step 3: Configure `api/config.php`

1. Open [`api/config.php`](file:///d:/VYOMANTRA%20TECHNOLOGIES/api/config.php) on your local machine (or in Hostinger File Manager).
2. Locate lines 22–26:

```php
// -------------------------------------------------------------
// Hostinger Database Credentials
// -------------------------------------------------------------
define('DB_HOST', 'localhost');                  // Always 'localhost' on Hostinger
define('DB_NAME', 'u123456789_vyomantra');      // Your full Hostinger Database Name
define('DB_USER', 'u123456789_admin');          // Your full Hostinger Username
define('DB_PASS', 'Your_Hostinger_DB_Password'); // Your database password
define('DB_CHARSET', 'utf8mb4');
```

3. Replace the placeholder values with your real Hostinger database credentials.
4. Save the file.

---

## 🚀 Step 4: Upload Your Website Files to Hostinger

### Method A: Hostinger File Manager (Quickest for ZIP)
1. In Hostinger hPanel, go to **Files** ➔ **File Manager** ➔ **Access files of [your domain]**.
2. Open the **`public_html`** folder.
3. Zip your project files (excluding `.git` folder) and click **Upload** ➔ Select the ZIP file.
4. Right-click the uploaded ZIP inside `public_html` and select **Extract**.
5. Ensure all folders (`admin/`, `api/`, `assets/`, `css/`, `data/`, `js/`, `uploads/`, `verify/`) and files (`index.html`, etc.) are directly in `public_html`.
6. Ensure `data/` and `uploads/` directories have write permissions (755 or writeable).

### Method B: Git Deployment in Hostinger
1. In hPanel, go to **Advanced** ➔ **GIT**.
2. Connect your GitHub/Git repository URL and set Branch to `main`.
3. Set Install path to `/public_html` and click **Create**.

---

## 🔐 Step 5: Admin Panel Login & Verification

1. In your browser, navigate to your admin panel:
   **`https://yourdomain.com/admin/`**
2. Log in using the default Super Admin credentials seeded in `schema.sql`:
   - **Username:** `admin` *(or `vyomantratech@gmail.com`)*
   - **Password:** `Vyomantra@2026`
3. After logging in:
   - Check the top right user card: You will see **`Super Admin ● LIVE DB`** with a cyan badge confirming your Hostinger MySQL database is active and connected!
   - Navigate to **Course Creation CMS**: Click **+ Create New Course** to publish a new technical course or cohort.
   - Navigate to **Job Postings CMS**: Click **+ Post New Job / Internship** when you want to publish hiring roles.
   - Navigate to **Certificates**: Issue, preview, and download certificates (with QR code verification on `https://yourdomain.com/verify/`).

---

## ✅ Production Readiness Verification Checklist

| Area | Status | Notes |
|---|:---:|---|
| **Favicon** | ✅ Complete | Updated with official high-res Vyomantra emblem + `.ico` support + cache-buster `?v=2`. |
| **Demo Jobs / Internships** | ✅ Cleaned | `data/jobs.json` set to `[]`, static demo files removed, clean dynamic state on `careers.html`. |
| **Demo Courses** | ✅ Cleaned | Demo Python course removed from `courses.html`, dynamic catalog container installed. |
| **Reviews & Testimonials** | ✅ Intact | Client reviews on `index.html` and public pages preserved without modification. |
| **Course Creation CMS** | ✅ Active | Full CMS in admin panel + `api/admin/courses.php` + `api/get-courses.php`. |
| **Admin Panel Demo Data** | ✅ Cleaned | Contacts, quotes, applicants, and registrations reset to clean production state. |
| **Certificate System** | ✅ Intact | Dual DOCX download (partial & full), configurator, QR codes, and audit logs preserved. |
| **PHP Syntax & Compatibility** | ✅ 100% Passed | All 18 PHP endpoints verified syntax error-free for PHP 8.0 – 8.3+. |
| **MySQL Production Schema** | ✅ Ready | Complete `schema.sql` ready for 1-click phpMyAdmin import. |
