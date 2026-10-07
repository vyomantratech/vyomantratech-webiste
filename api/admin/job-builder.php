<?php
header('X-Robots-Tag: noindex, nofollow', true);
/**
 * Vyomantra Technologies - Static Job Subpage Generator
 * Automatically compiles clean static HTML subpages in careers/[slug].html
 * and keeps data/jobs.json synchronized.
 */

function generateJobSubpage($jobData) {
    $slug = preg_replace('/[^a-z0-9_-]/', '', strtolower($jobData['slug'] ?? ''));
    if (empty($slug)) {
        return false;
    }

    $title        = htmlspecialchars($jobData['title'] ?? 'Role Opening');
    $dept         = htmlspecialchars($jobData['department_label'] ?? 'Engineering & Development');
    $category     = htmlspecialchars($jobData['category'] ?? 'engineering');
    $jobType      = htmlspecialchars($jobData['job_type'] ?? 'fulltime');
    $typeLabel    = ($jobType === 'internship') ? 'Internship (3–6 Months)' : (($jobType === 'contract') ? 'Contract Role' : 'Full-Time Permanent');
    $location     = htmlspecialchars($jobData['location_text'] ?? 'Dharmapuri, TN / Hybrid');
    $comp         = htmlspecialchars($jobData['compensation_text'] ?? 'Competitive CTC');
    $expText      = htmlspecialchars($jobData['experience_text'] ?? '1 – 3+ Years Experience');
    $summary      = htmlspecialchars($jobData['summary'] ?? '');
    $aboutRole    = nl2br(htmlspecialchars($jobData['about_role'] ?? ''));
    $qualText     = nl2br(htmlspecialchars($jobData['qualifications'] ?? ''));
    $datePosted   = htmlspecialchars($jobData['date_posted'] ?? date('Y-m-d'));
    $formattedDate= date('F d, Y', strtotime($datePosted));

    $responsibilities = is_array($jobData['responsibilities'] ?? []) ? $jobData['responsibilities'] : (json_decode($jobData['responsibilities'] ?? '[]', true) ?: []);
    $competencies     = is_array($jobData['competencies'] ?? []) ? $jobData['competencies'] : (json_decode($jobData['competencies'] ?? '[]', true) ?: []);
    $techStack        = is_array($jobData['tech_stack'] ?? []) ? $jobData['tech_stack'] : (json_decode($jobData['tech_stack'] ?? '[]', true) ?: []);

    // Build responsibilities HTML
    $respHtml = '';
    foreach ($responsibilities as $item) {
        $respHtml .= '<li style="display: flex; gap: 0.75rem; color: var(--text-muted); line-height: 1.6;">'
                   . '<i class="fas fa-check-circle" style="color: var(--cyan); margin-top: 4px; flex-shrink: 0;"></i>'
                   . '<span>' . htmlspecialchars($item) . '</span>'
                   . '</li>' . "\n";
    }

    // Build competencies HTML
    $compHtml = '';
    foreach ($competencies as $item) {
        $compHtml .= '<li style="display: flex; gap: 0.75rem; line-height: 1.6;">'
                   . '<i class="fas fa-angle-right" style="color: var(--cyan); margin-top: 3px;"></i>'
                   . '<span>' . htmlspecialchars($item) . '</span>'
                   . '</li>' . "\n";
    }

    // Build tech stack tags HTML
    $techHtml = '';
    foreach ($techStack as $tag) {
        $techHtml .= '<span class="badge-pill" style="font-size: 0.78rem;">' . htmlspecialchars($tag) . '</span>' . "\n";
    }

    $html = <<<HTML
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{$title} | Careers | Vyomantra Technologies</title>
  <meta name="description" content="{$summary}">
  <link rel="canonical" href="https://vyomantratech.com/careers/{$slug}">
  <meta property="og:title" content="{$title} | Vyomantra Technologies">
  <meta property="og:description" content="{$summary}">
  <link rel="icon" type="image/png" href="../assets/icons/vyomantra_logo.png">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <link rel="stylesheet" href="../css/main.css">
  <link rel="stylesheet" href="../css/components.css">
  <link rel="stylesheet" href="../css/animations.css">
</head>

<body>

  <!-- Header Navigation -->
  <header class="site-header">
    <div class="container nav-wrapper">
      <a href="/" class="brand-logo">
        <img src="../assets/icons/vyomantra_logo.png" alt="Vyomantra Technologies Logo">
        <div>
          VYOMANTRA
          <span>TECHNOLOGIES</span>
        </div>
      </a>

      <nav>
        <ul class="nav-menu">
          <li><a href="/" class="nav-link">Home</a></li>
          <li class="dropdown">
            <a href="/services" class="nav-link">Services <i class="fas fa-chevron-down" style="font-size:0.75rem;"></i></a>
            <div class="dropdown-menu">
              <a href="/services/web-development" class="dropdown-item">Web Development</a>
              <a href="/services/mobile-app-development" class="dropdown-item">Mobile App Development</a>
              <a href="/services/software-development" class="dropdown-item">Software Development</a>
              <a href="/services/ai-machine-learning" class="dropdown-item">AI & Machine Learning</a>
              <a href="/services/automation" class="dropdown-item">Automation</a>
              <a href="/services/erp-crm" class="dropdown-item">ERP & CRM Solutions</a>
              <a href="/services/ui-ux-design" class="dropdown-item">UI/UX Design</a>
              <a href="/services/cloud-devops" class="dropdown-item">Cloud & DevOps</a>
              <a href="/services/digital-marketing" class="dropdown-item">Digital Marketing</a>
              <a href="/services/seo" class="dropdown-item">SEO</a>
              <a href="/services/branding" class="dropdown-item">Branding & Creative</a>
              <a href="/services/it-consulting" class="dropdown-item">IT Consulting</a>
            </div>
          </li>
          <li class="dropdown">
            <a href="/solutions" class="nav-link">Solutions <i class="fas fa-chevron-down" style="font-size:0.75rem;"></i></a>
            <div class="dropdown-menu">
              <a href="/solutions/business-websites" class="dropdown-item">Business Websites</a>
              <a href="/solutions/custom-software" class="dropdown-item">Custom Software</a>
              <a href="/solutions/erp-crm" class="dropdown-item">ERP & CRM</a>
              <a href="/solutions/ai-solutions" class="dropdown-item">AI Solutions</a>
              <a href="/solutions/automation" class="dropdown-item">Automation</a>
              <a href="/solutions/saas" class="dropdown-item">SaaS Products</a>
              <a href="/solutions/ecommerce" class="dropdown-item">E-commerce</a>
            </div>
          </li>
          <li><a href="/products" class="nav-link">Products</a></li>
          <li><a href="/portfolio" class="nav-link">Portfolio</a></li>
          <li><a href="/about" class="nav-link">About Us</a></li>
          <li><a href="/careers" class="nav-link active">Careers</a></li>
          <li><a href="/courses" class="nav-link">Courses</a></li>
          <li><a href="/contact" class="nav-link">Contact</a></li>
        </ul>
      </nav>

      <div class="header-actions">
        <a href="/request-a-quote" class="btn btn-primary btn-sm">Get a Quote</a>
        <button class="mobile-toggle" id="mobileToggle" aria-label="Toggle navigation">
          <i class="fas fa-bars"></i>
        </button>
      </div>
    </div>
  </header>

  <!-- Mobile Drawer -->
  <div class="mobile-drawer" id="mobileDrawer">
    <div class="mobile-drawer-header">
      <div class="brand-logo">
        <img src="../assets/icons/vyomantra_logo.png" alt="Vyomantra Logo">
        <div>VYOMANTRA<span>TECHNOLOGIES</span></div>
      </div>
      <button class="modal-close" id="closeMenu" style="position:static;">&times;</button>
    </div>
    <ul class="mobile-nav-list">
      <li><a href="/" class="mobile-nav-link">Home</a></li>
      <li><a href="/services" class="mobile-nav-link">Services</a></li>
      <li><a href="/solutions" class="mobile-nav-link">Solutions</a></li>
      <li><a href="/products" class="mobile-nav-link">Products</a></li>
      <li><a href="/portfolio" class="mobile-nav-link">Portfolio</a></li>
      <li><a href="/about" class="mobile-nav-link">About Us</a></li>
      <li><a href="/careers" class="mobile-nav-link active">Careers</a></li>
      <li><a href="/courses" class="mobile-nav-link">Courses</a></li>
      <li><a href="/contact" class="mobile-nav-link">Contact</a></li>
    </ul>
    <div style="padding: 1.5rem; text-align: center;">
      <a href="/request-a-quote" class="btn btn-primary" style="width: 100%;">Get a Quote</a>
    </div>
  </div>

  <!-- Breadcrumbs & Job Header -->
  <section style="padding: 3.5rem 0 2rem 0; border-bottom: 1px solid var(--border-subtle); background: radial-gradient(circle at 50% 0%, rgba(0, 240, 255, 0.08), transparent 70%);">
    <div class="container">
      <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: var(--text-dim); margin-bottom: 1.5rem; flex-wrap: wrap;">
        <a href="/" style="color: var(--text-dim);">Home</a>
        <span>/</span>
        <a href="/careers" style="color: var(--text-dim);">Careers</a>
        <span>/</span>
        <span style="color: var(--cyan);">{$title}</span>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1.5rem;">
        <div style="max-width: 780px;">
          <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.75rem;">
            <span class="badge-pill" style="border-color: #22c55e; color: #22c55e; background: rgba(34, 197, 94, 0.1);">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e; display: inline-block; margin-right: 5px;"></span>
              Actively Hiring
            </span>
            <span class="badge-pill badge-purple">{$dept}</span>
            <span class="badge-pill">{$typeLabel}</span>
          </div>

          <h1 style="font-size: clamp(2rem, 4vw, 2.8rem); font-weight: 800; color: #fff; margin-bottom: 1rem; line-height: 1.2;">
            {$title}
          </h1>

          <p style="color: var(--text-muted); font-size: 1.1rem; line-height: 1.7; margin-bottom: 1.5rem;">
            {$summary}
          </p>

          <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; font-size: 0.95rem; color: var(--text-muted);">
            <div><i class="fas fa-map-marker-alt" style="color: var(--cyan); margin-right: 0.5rem;"></i> {$location}</div>
            <div><i class="fas fa-calendar-alt" style="color: var(--cyan); margin-right: 0.5rem;"></i> Posted: <strong>{$formattedDate}</strong></div>
            <div><i class="fas fa-money-bill-wave" style="color: var(--cyan); margin-right: 0.5rem;"></i> {$comp}</div>
            <div><i class="fas fa-briefcase" style="color: var(--cyan); margin-right: 0.5rem;"></i> {$expText}</div>
          </div>
        </div>

        <div>
          <a href="#applySection" class="btn btn-primary btn-lg" style="box-shadow: 0 0 25px rgba(0, 240, 255, 0.4);">
            <i class="fas fa-paper-plane"></i> Apply for this Role
          </a>
        </div>
      </div>
    </div>
  </section>

  <!-- Job Details Main Body -->
  <section style="padding: 4rem 0 6rem 0;">
    <div class="container">
      <div style="display: grid; grid-template-columns: 1fr 340px; gap: 3.5rem; align-items: start;">

        <!-- Left Column: Specifications -->
        <div>

          <!-- 1. Role Overview -->
          <div style="margin-bottom: 3rem;">
            <h2 style="font-size: 1.6rem; color: #fff; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem;">
              <i class="fas fa-laptop-code" style="color: var(--cyan);"></i> About the Role
            </h2>
            <div style="color: var(--text-muted); line-height: 1.8;">
              {$aboutRole}
            </div>
          </div>

          <!-- 2. Key Responsibilities -->
          <div style="margin-bottom: 3rem;">
            <h2 style="font-size: 1.6rem; color: #fff; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.75rem;">
              <i class="fas fa-tasks" style="color: var(--cyan);"></i> Responsibilities
            </h2>
            <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.85rem;">
              {$respHtml}
            </ul>
          </div>

          <!-- 3. Eligibility & Requirements -->
          <div style="margin-bottom: 3rem;">
            <h2 style="font-size: 1.6rem; color: #fff; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.75rem;">
              <i class="fas fa-user-check" style="color: var(--cyan);"></i> Eligibility & Requirements
            </h2>
            <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.75rem;">
              <h4 style="color: var(--text-bright); font-size: 1.1rem; margin-bottom: 0.75rem;">Experience & Qualifications:</h4>
              <p style="color: var(--text-muted); line-height: 1.7; margin-bottom: 1.25rem;">
                {$qualText}
              </p>

              <h4 style="color: var(--text-bright); font-size: 1.1rem; margin-bottom: 0.75rem;">Core Competencies:</h4>
              <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; color: var(--text-muted); margin-bottom: 0;">
                {$compHtml}
              </ul>
            </div>
          </div>

          <!-- 4. Application Form Section -->
          <div id="applySection" style="padding-top: 1rem;">
            <div class="contact-form-box" style="border-color: var(--border-cyan); padding: 2.5rem; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);">
              <div style="margin-bottom: 2rem;">
                <span class="badge-pill badge-purple" style="margin-bottom: 0.75rem;">Application Form</span>
                <h3 style="font-size: 1.8rem; color: #fff; margin-bottom: 0.5rem;">Apply for {$title}</h3>
                <p style="color: var(--text-muted); font-size: 0.95rem; margin: 0;">
                  Submit your details and CV below. Our hiring team reviews all applications within <strong>24–48 hours</strong>.
                </p>
              </div>

              <form id="careerApplicationForm" enctype="multipart/form-data">
                <input type="hidden" name="role_applied" value="{$title}">

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem;">
                  <div class="form-group">
                    <label class="form-label" for="careerName">Full Name *</label>
                    <input type="text" id="careerName" name="name" class="form-control" placeholder="e.g. Karthik Venkat" required>
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="careerEmail">Email Address *</label>
                    <input type="email" id="careerEmail" name="email" class="form-control" placeholder="karthik@domain.com" required>
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="careerPhone">Phone / WhatsApp Number *</label>
                    <input type="tel" id="careerPhone" name="phone" class="form-control" placeholder="+91 98765 43210" required>
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="careerExperience">Years of Experience</label>
                    <select id="careerExperience" name="experience" class="form-control" style="background:#050711;">
                      <option value="Fresher / Student">Fresher / Student</option>
                      <option value="1 - 2 Years">1 – 2 Years</option>
                      <option value="2 - 4 Years">2 – 4 Years</option>
                      <option value="5+ Years">5+ Years (Senior)</option>
                    </select>
                  </div>
                </div>

                <div class="form-group" style="margin-top: 1.25rem;">
                  <label class="form-label" for="careerPortfolio">Portfolio / GitHub / LinkedIn URL</label>
                  <input type="url" id="careerPortfolio" name="portfolio_url" class="form-control" placeholder="https://github.com/yourhandle">
                </div>

                <div class="form-group" style="margin-top: 1.25rem;">
                  <label class="form-label" for="careerResume">Upload Resume / CV (PDF, DOC, DOCX - Max 10MB) *</label>
                  <input type="file" id="careerResume" name="resume" class="form-control" accept=".pdf,.doc,.docx" required style="padding: 0.65rem 0.85rem; background: #050711;">
                </div>

                <div class="form-group" style="margin-top: 1.25rem;">
                  <label class="form-label" for="careerMessage">Cover Note / Key Achievements</label>
                  <textarea id="careerMessage" name="message" class="form-control" rows="4" placeholder="Briefly describe projects, relevant experience, or why you want to build at Vyomantra..."></textarea>
                </div>

                <button type="submit" class="btn btn-primary btn-lg" style="width: 100%; margin-top: 1.25rem; font-size: 1.1rem; padding: 1rem 2rem;">
                  <i class="fas fa-paper-plane"></i> Submit Application
                </button>
              </form>
            </div>
          </div>

        </div>

        <!-- Right Column: Sidebar Job Summary Widget -->
        <aside style="position: sticky; top: 100px;">
          <!-- Quick Facts -->
          <div style="background: rgba(15, 20, 45, 0.7); border: 1px solid var(--border-cyan); border-radius: var(--radius-md); padding: 1.75rem; margin-bottom: 1.5rem; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);">
            <h3 style="font-size: 1.2rem; color: #fff; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-subtle);">
              Job Specifications
            </h3>

            <div style="display: flex; flex-direction: column; gap: 1rem; font-size: 0.95rem;">
              <div>
                <span style="color: var(--text-dim); display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">Role Title</span>
                <strong style="color: #fff;">{$title}</strong>
              </div>
              <div>
                <span style="color: var(--text-dim); display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">Department</span>
                <span style="color: var(--cyan);">{$dept}</span>
              </div>
              <div>
                <span style="color: var(--text-dim); display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">Work Location</span>
                <span style="color: #fff;">{$location}</span>
              </div>
              <div>
                <span style="color: var(--text-dim); display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">Job Type</span>
                <span style="color: #fff;">{$typeLabel}</span>
              </div>
              <div>
                <span style="color: var(--text-dim); display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">Date Posted</span>
                <span style="color: #fff;">{$formattedDate}</span>
              </div>
              <div>
                <span style="color: var(--text-dim); display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">Experience</span>
                <span style="color: #fff;">{$expText}</span>
              </div>
              <div>
                <span style="color: var(--text-dim); display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">Compensation</span>
                <span style="color: #22c55e; font-weight: 600;">{$comp}</span>
              </div>
            </div>

            <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border-subtle);">
              <a href="#applySection" class="btn btn-primary" style="width: 100%; justify-content: center;">
                Apply Now <i class="fas fa-arrow-down"></i>
              </a>
            </div>
          </div>

          <!-- Tech Stack Tags -->
          <div style="background: rgba(15, 20, 45, 0.5); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 1.5rem;">
            <h4 style="font-size: 1rem; color: #fff; margin-bottom: 0.85rem;">Core Technologies</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
              {$techHtml}
            </div>
          </div>

          <!-- Back Link -->
          <a href="/careers" class="btn btn-outline" style="width: 100%; justify-content: center;">
            <i class="fas fa-arrow-left"></i> All Openings
          </a>
        </aside>

      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <a href="/" class="brand-logo">
            <img src="../assets/icons/vyomantra_logo.png" alt="Vyomantra Logo">
            <div>VYOMANTRA<span>TECHNOLOGIES</span></div>
          </a>
          <p>Enterprise software development, custom web architectures, and autonomous AI systems engineered for modern business scale.</p>
        </div>
        <div class="footer-col">
          <h4>Services</h4>
          <ul class="footer-links">
            <li><a href="/services/web-development">Web Development</a></li>
            <li><a href="/services/mobile-app-development">Mobile App Development</a></li>
            <li><a href="/services/software-development">Software Development</a></li>
            <li><a href="/services/ai-machine-learning">AI & Machine Learning</a></li>
            <li><a href="/services/cloud-devops">Cloud & DevOps</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Solutions</h4>
          <ul class="footer-links">
            <li><a href="/solutions/business-websites">Business Websites</a></li>
            <li><a href="/solutions/custom-software">Custom Software</a></li>
            <li><a href="/solutions/erp-crm">ERP & CRM</a></li>
            <li><a href="/solutions/ecommerce">E-commerce</a></li>
            <li><a href="/products/stockmitra">StockMitra</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Connect</h4>
          <ul class="footer-links">
            <li><i class="fas fa-map-marker-alt" style="color:var(--cyan); margin-right:6px;"></i> Dharmapuri, Tamil Nadu, India</li>
            <li><i class="fas fa-phone-alt" style="color:var(--cyan); margin-right:6px;"></i> +91 8122288855</li>
            <li><i class="fas fa-envelope" style="color:var(--cyan); margin-right:6px;"></i> vyomantratech@gmail.com</li>
            <li><a href="/request-a-quote" style="color:var(--cyan); font-weight:600;"><i class="fas fa-file-invoice" style="margin-right:6px;"></i> Request a Quote</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2026 Vyomantra Technologies. All rights reserved.</p>
        <p><a href="/privacy-policy" style="color:var(--text-dim); margin-right:1rem;">Privacy Policy</a> <a href="/terms-and-conditions" style="color:var(--text-dim); margin-right:1rem;">Terms & Conditions</a> <a href="/refund-policy" style="color:var(--text-dim);">Refund Policy</a></p>
      </div>
    </div>
  </footer>

  <!-- Floating Quick Action Dock -->
  <div class="floating-dock">
    <a href="https://wa.me/918122288855" target="_blank" class="dock-btn dock-whatsapp" aria-label="WhatsApp Us">
      <img src="../assets/icons/whatsapp.png" alt="WhatsApp">
    </a>
  </div>

  <script src="../js/main.js"></script>
  <script src="../js/form-handlers.js"></script>
</body>

</html>
HTML;

    $targetFile = __DIR__ . '/../../careers/' . $slug . '.html';
    $careersDir = dirname($targetFile);
    if (!is_dir($careersDir)) {
        @mkdir($careersDir, 0755, true);
    }

    $written = @file_put_contents($targetFile, $html);
    return ($written !== false);
}

/**
 * Synchronizes data/jobs.json cache
 */
function syncJobsJsonFile($jobsArray) {
    $targetFile = __DIR__ . '/../../data/jobs.json';
    $dataDir = dirname($targetFile);
    if (!is_dir($dataDir)) {
        @mkdir($dataDir, 0755, true);
    }
    return (@file_put_contents($targetFile, json_encode($jobsArray, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) !== false);
}
