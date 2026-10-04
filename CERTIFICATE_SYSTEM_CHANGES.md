# Certificate system update (what changed)

## Deploy steps
1. Back up the database and the site folder.
2. phpMyAdmin > Import `scripts/migrate_certificates_v2.sql` (adds `program_type` and `recognition`; nothing is deleted).
3. Upload the changed files (listed below). Keep your existing `api/config.php` credentials.
4. Delete `data/admin_session.json` on the server and log in again (it holds a login token).
5. Delete the sample/test records in `data/certificates.json` and the test rows in the `certificates` table before going live.
6. Open `https://yourdomain/data/certificates.json` and `https://yourdomain/uploads/certificates/x.pdf`: both must show "403 Forbidden".

## Field mapping (existing column -> meaning on the new certificate)
- course_name -> Program / Event Name
- course_duration -> Duration
- trainer_name -> Mentor / Lead name (left signature)
- signatory_name -> Founder name
- NEW program_type (Training Program, Internship, Hackathon, Workshop, Webinar, Competition)
- NEW recognition (Completed, Participant, Winner, Runner-up, Intern, Volunteer)
- certificate_type -> OF [TYPE] (Completion, Participation, Achievement, Internship, Excellence, Appreciation)

## Public verify page shows only
status, recipient name, program name, program type, certificate type, recognition, duration, date of issue, certificate ID, issued by, PDF download (valid certificates only).
Revoked certificates show status only. Email, notes, token, revoke reason and file paths are never returned.
