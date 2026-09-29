# Hostinger Database Connection & Setup Guide
**Vyomantra Technologies Website Forms Backend**

---

### Overview
All website forms (**Contact Page**, **Careers Application**, **Course Registration & Payment**, and **Quote Request**) are wired to the `api/` endpoints and store data directly into your **Hostinger MySQL Database**.

---

### Step 1: Create Database in Hostinger
1. Log in to your **Hostinger hPanel** (or cPanel).
2. Go to **Databases** → **MySQL Databases**.
3. Create a new Database:
   - **Database Name**: e.g., `u123456789_vyomantra`
   - **Username**: e.g., `u123456789_admin`
   - **Password**: (Choose a secure password and save it)
4. Note down your Database Name, Username, and Password.

---

### Step 2: Import Database Tables
1. In Hostinger hPanel, click **Enter phpMyAdmin** next to your newly created database.
2. Click the **Import** tab at the top.
3. Click **Choose File** and select `schema.sql` from your website folder.
4. Click **Go** / **Import** at the bottom.
5. The following 4 tables will be created automatically:
   - `contact_messages`: Stores inquiries from [contact.html](contact.html)
   - `job_applications`: Stores job applications + uploaded resumes from [careers.html](careers.html)
   - `course_registrations`: Stores student registrations + UPI transaction reference + payment screenshots from [courses.html](courses.html)
   - `quote_requests`: Stores discovery blueprints & project requests from [request-a-quote.html](request-a-quote.html)

---

### Step 3: Connect Credentials in `api/config.php`
Open [api/config.php](api/config.php) and update these lines with your Hostinger database details:

```php
define('DB_HOST', 'localhost');                  // Keep 'localhost' on Hostinger
define('DB_NAME', 'u123456789_vyomantra');       // Your Hostinger Database Name
define('DB_USER', 'u123456789_admin');           // Your Hostinger Database Username
define('DB_PASS', 'YourSecretPasswordHere');     // Your Hostinger Database Password
```

---

### Storage of Uploaded Files
- Resumes uploaded from Careers: stored in `uploads/resumes/`
- Payment screenshots uploaded from Course Registration: stored in `uploads/payments/`
- Backup logs: stored in `logs/`

---

### Security Note
- Database queries use prepared statements with PDO (protecting against SQL injection).
- File uploads are validated for allowed extensions (PDF, DOC, DOCX, JPG, PNG, WEBP) and file size (under 10MB).
- Uploaded filenames are sanitized with timestamps to prevent collisions or execution risks.
