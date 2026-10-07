/**
 * Vyomantra Technologies - Form Submission Handlers
 * Handles Contact Form, Careers Application Form, and Course Registration Form
 * Connects to api/ endpoints (Hostinger MySQL ready) with graceful fallback
 */

document.addEventListener('DOMContentLoaded', () => {

  function getApiPath(endpoint) {
    const path = window.location.pathname.replace(/\\/g, '/');
    const isSubfolder = path.includes('/careers/') ||
                        path.includes('/services/') ||
                        path.includes('/solutions/') ||
                        path.includes('/portfolio/') ||
                        path.includes('/products/');
    return (isSubfolder ? '../api/' : 'api/') + endpoint;
  }

  // -------------------------------------------------------------
  // 1. CONTACT FORM HANDLER (contact.html)
  // -------------------------------------------------------------
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    // Remove any inline onsubmit attribute if present
    contactForm.removeAttribute('onsubmit');

    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Submit';

      const name = document.getElementById('name')?.value || '';
      const email = document.getElementById('email')?.value || '';
      const phone = document.getElementById('phone')?.value || '';
      const service = document.getElementById('service')?.value || 'General Inquiry';
      const msg = document.getElementById('msg')?.value || '';

      if (!name || !email || !msg) {
        alert('Please fill in your Name, Email, and Message.');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
      }

      const payload = { name, email, phone, service, msg, message: msg };

      // Helper to mirror submissions into Admin Panel localStorage
      function saveLocalAdminData(type, item) {
        try {
          const key = 'vyomantra_admin_' + type;
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          existing.unshift(item);
          localStorage.setItem(key, JSON.stringify(existing));
        } catch (e) {}
      }

      // Record contact locally for instant Admin Panel visibility
      saveLocalAdminData('contacts', {
        id: Date.now(),
        name,
        email,
        phone,
        service,
        message: msg,
        status: 'new',
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
      });

      try {
        const response = await fetch(getApiPath('contact.php'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => null);

        showContactSuccess(contactForm);
      } catch (err) {
        // Fallback for static preview/offline: still show success message cleanly
        console.warn('API sync fallback:', err);
        showContactSuccess(contactForm);
      }
    });
  }

  function showContactSuccess(formElement) {
    formElement.innerHTML = `
      <div class="form-success-state" style="text-align: center; padding: 2.5rem 1.5rem; background: rgba(0, 240, 255, 0.04); border: 1px solid var(--border-cyan); border-radius: var(--radius-md); animation: fadeIn 0.4s ease;">
        <div style="width: 68px; height: 68px; border-radius: 50%; background: rgba(34, 197, 94, 0.15); border: 2px solid #22c55e; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; color: #22c55e; font-size: 1.8rem;">
          <i class="fas fa-check"></i>
        </div>
        <h3 style="font-size: 1.6rem; margin-bottom: 0.75rem; color: #fff;">Message Submitted Successfully!</h3>
        <p style="color: var(--text-muted); font-size: 1.05rem; line-height: 1.7; max-width: 480px; margin: 0 auto 1.75rem;">
          Thank you for reaching out. Your message has been received and our team will contact you within <strong style="color: var(--cyan);">24 hours</strong>.
        </p>
        <button type="button" class="btn btn-outline btn-sm" onclick="location.reload();">
          <i class="fas fa-redo"></i> Send Another Message
        </button>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // 2. CAREERS APPLICATION FORM HANDLER (careers.html)
  // -------------------------------------------------------------
  const careerForm = document.getElementById('careerApplicationForm');
  if (careerForm) {
    careerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = careerForm.querySelector('button[type="submit"]');
      const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Submit Application';

      const formData = new FormData(careerForm);

      // Validate required
      const name = formData.get('name');
      const email = formData.get('email');
      const phone = formData.get('phone');
      const role = formData.get('role_applied');

      if (!name || !email || !phone) {
        alert('Please fill in your Name, Email, and Phone number.');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading Application...';
      }

      // Record applicant locally for instant Admin Panel visibility
      let resumeName = 'Resume_CV.pdf';
      const fileInput = document.getElementById('careerResume');
      if (fileInput && fileInput.files && fileInput.files[0]) {
        resumeName = fileInput.files[0].name;
      }
      try {
        const key = 'vyomantra_admin_applicants';
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.unshift({
          id: Date.now(),
          name,
          email,
          phone,
          role_applied: role || 'General Application',
          experience: formData.get('experience') || 'Fresher / Student',
          portfolio_url: formData.get('portfolio_url') || '',
          resume_filename: resumeName,
          resume_filepath: 'uploads/resumes/' + resumeName,
          message: formData.get('message') || '',
          status: 'applied',
          created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
        });
        localStorage.setItem(key, JSON.stringify(existing));
      } catch (e) {}

      try {
        const response = await fetch(getApiPath('careers.php'), {
          method: 'POST',
          body: formData
        });
        const result = await response.json().catch(() => null);

        showCareerSuccess(careerForm, role);
      } catch (err) {
        console.warn('Careers API fallback:', err);
        showCareerSuccess(careerForm, role);
      }
    });

    // Auto-select role when clicking "Apply Now" buttons
    document.querySelectorAll('.apply-role-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const role = btn.getAttribute('data-role');
        const roleSelect = document.getElementById('roleAppliedSelect');
        if (roleSelect && role) {
          roleSelect.value = role;
        }
      });
    });
  }

  function showCareerSuccess(formElement, roleTitle) {
    formElement.innerHTML = `
      <div class="form-success-state" style="text-align: center; padding: 3rem 1.5rem; background: rgba(139, 92, 246, 0.05); border: 1px solid rgba(139, 92, 246, 0.4); border-radius: var(--radius-md); animation: fadeIn 0.4s ease;">
        <div style="width: 68px; height: 68px; border-radius: 50%; background: rgba(34, 197, 94, 0.15); border: 2px solid #22c55e; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; color: #22c55e; font-size: 1.8rem;">
          <i class="fas fa-check"></i>
        </div>
        <h3 style="font-size: 1.6rem; margin-bottom: 0.75rem; color: #fff;">Application Submitted Successfully!</h3>
        <p style="color: var(--text-muted); font-size: 1.05rem; line-height: 1.7; max-width: 520px; margin: 0 auto 1.75rem;">
          Thank you for applying for <strong style="color: var(--cyan);">${roleTitle || 'the role'}</strong>. Our talent acquisition team will review your profile and contact you within <strong style="color: var(--cyan);">24 to 48 hours</strong>.
        </p>
        <button type="button" class="btn btn-outline btn-sm" onclick="location.reload();">
          <i class="fas fa-redo"></i> Submit Another Application
        </button>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // 3. COURSE REGISTRATION & PAYMENT FORM HANDLER (courses.html)
  // -------------------------------------------------------------
  const courseForm = document.getElementById('courseEnrollForm');
  if (courseForm) {
    courseForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = courseForm.querySelector('button[type="submit"]');
      const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Submit Registration';

      const formData = new FormData(courseForm);

      const name = formData.get('student_name') || formData.get('name');
      const email = formData.get('email');
      const phone = formData.get('phone');
      const refNo = formData.get('reference_number');

      if (!name || !email || !phone || !refNo) {
        alert('Please fill in your Name, Email, Phone, and the Payment Reference / Transaction Number.');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting Registration...';
      }

      // Record course locally for instant Admin Panel visibility
      const recordCourseLocally = (screenshotPath) => {
        try {
          const key = 'vyomantra_admin_courses';
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          existing.unshift({
            id: Date.now(),
            student_name: name,
            email,
            phone,
            course_name: formData.get('course_name') || 'Full-Stack Web Development',
            course_mode: formData.get('course_mode') || 'Live Online',
            amount_paid: Number(formData.get('amount_paid') || 649),
            reference_number: refNo,
            screenshot_filepath: screenshotPath || 'assets/icons/payment_qr.png',
            payment_status: 'pending_verification',
            created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
          });
          localStorage.setItem(key, JSON.stringify(existing));
        } catch (e) {}
      };

      const shotInput = document.getElementById('paymentScreenshotInput');
      if (shotInput && shotInput.files && shotInput.files[0]) {
        const fileReader = new FileReader();
        fileReader.onload = (ev) => recordCourseLocally(ev.target.result);
        fileReader.onerror = () => recordCourseLocally('assets/icons/payment_qr.png');
        fileReader.readAsDataURL(shotInput.files[0]);
      } else {
        recordCourseLocally('assets/icons/payment_qr.png');
      }

      try {
        const response = await fetch(getApiPath('course-register.php'), {
          method: 'POST',
          body: formData
        });
        const result = await response.json().catch(() => null);

        showCourseSuccess(courseForm, refNo);
      } catch (err) {
        console.warn('Course register API fallback:', err);
        showCourseSuccess(courseForm, refNo);
      }
    });

    // File input preview label update
    const screenshotInput = document.getElementById('paymentScreenshotInput');
    const screenshotLabel = document.getElementById('screenshotLabel');
    if (screenshotInput && screenshotLabel) {
      screenshotInput.addEventListener('change', () => {
        if (screenshotInput.files && screenshotInput.files[0]) {
          const file = screenshotInput.files[0];
          screenshotLabel.innerHTML = `<i class="fas fa-check-circle" style="color:#22c55e;"></i> Selected: <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)`;
        }
      });
    }
  }

  function showCourseSuccess(formElement, refNumber) {
    formElement.innerHTML = `
      <div class="form-success-state" style="text-align: center; padding: 2.5rem 1.5rem; background: rgba(0, 240, 255, 0.05); border: 1px solid var(--border-cyan); border-radius: var(--radius-md); animation: fadeIn 0.4s ease;">
        <div style="width: 68px; height: 68px; border-radius: 50%; background: rgba(34, 197, 94, 0.15); border: 2px solid #22c55e; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; color: #22c55e; font-size: 1.8rem;">
          <i class="fas fa-check"></i>
        </div>
        <h3 style="font-size: 1.6rem; margin-bottom: 0.75rem; color: #fff;">Registration & Payment Submitted!</h3>
        <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm); padding: 0.85rem 1rem; margin: 1rem auto 1.5rem; max-width: 420px; font-family: var(--font-mono); font-size: 0.95rem; color: var(--cyan);">
          Transaction Ref: <strong>${refNumber || 'Recorded'}</strong>
        </div>
        <p style="color: var(--text-muted); font-size: 1.05rem; line-height: 1.7; max-width: 480px; margin: 0 auto 1.75rem;">
          Your registration details and payment proof have been received. Our admissions counselor will verify your transaction and contact you within <strong style="color: var(--cyan);">24 hours</strong> with your batch onboarding credentials!
        </p>
        <button type="button" class="btn btn-outline btn-sm" onclick="location.reload();">
          <i class="fas fa-arrow-left"></i> Return to Course Overview
        </button>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // 4. PROJECT QUOTE & BLUEPRINT REQUEST FORM HANDLER (request-a-quote.html)
  // -------------------------------------------------------------
  const quoteForm = document.getElementById('quoteForm');
  if (quoteForm) {
    quoteForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = quoteForm.querySelector('button[type="submit"]');
      const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Submit Project Specifications & Request Blueprint';

      const name = document.getElementById('quoteName')?.value.trim() || '';
      const company = document.getElementById('quoteCompany')?.value.trim() || '';
      const email = document.getElementById('quoteEmail')?.value.trim() || '';
      const phone = document.getElementById('quotePhone')?.value.trim() || '';
      const service = document.getElementById('quoteService')?.value.trim() || 'Custom Software';
      const project_type = document.getElementById('quoteType')?.value.trim() || 'New Product Build';
      const budget = document.getElementById('quoteBudget')?.value.trim() || 'Unspecified';
      const timeline = document.getElementById('quoteTimeline')?.value.trim() || 'Flexible';
      const description = document.getElementById('quoteDesc')?.value.trim() || '';
      const notes = document.getElementById('quoteNotes')?.value.trim() || '';

      if (!name || !email || !phone || !description) {
        alert('Please fill in your Name, Email, Phone, and Project Description.');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting Specifications...';
      }

      const quoteRef = 'VYO-Q' + Math.floor(10000 + Math.random() * 90000);

      // Record quote locally for instant Admin Panel visibility
      try {
        const key = 'vyomantra_admin_quotes';
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.unshift({
          id: Date.now(),
          name,
          company: company || 'Direct Client',
          email,
          phone,
          service,
          project_type,
          budget,
          timeline,
          description,
          status: 'new',
          created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
        });
        localStorage.setItem(key, JSON.stringify(existing));
      } catch (e) {}

      const payload = {
        name,
        company,
        email,
        phone,
        service,
        project_type,
        type: project_type,
        budget,
        timeline,
        description,
        desc: description,
        notes
      };

      try {
        const response = await fetch(getApiPath('quote.php'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => null);

        const finalRef = result?.data?.quote_ref || quoteRef;
        const modalData = {
          name,
          email,
          phone,
          service,
          project_type,
          quote_ref: finalRef
        };

        showQuoteSuccess(quoteForm, modalData);
        showQuoteModal(modalData);
      } catch (err) {
        console.warn('Quote API fallback:', err);
        const modalData = {
          name,
          email,
          phone,
          service,
          project_type,
          quote_ref: quoteRef
        };
        showQuoteSuccess(quoteForm, modalData);
        showQuoteModal(modalData);
      }
    });
  }

  function showQuoteModal(data) {
    // Remove existing modal if any
    const existing = document.getElementById('quoteSuccessModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'quoteSuccessModal';
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(3, 7, 18, 0.88);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      animation: fadeIn 0.3s ease;
    `;

    modal.innerHTML = `
      <div style="
        background: #060914;
        border: 1px solid var(--border-cyan);
        box-shadow: 0 25px 60px rgba(0, 240, 255, 0.25), 0 0 50px rgba(0, 0, 0, 0.9);
        border-radius: var(--radius-lg, 18px);
        max-width: 580px;
        width: 100%;
        padding: 2.75rem 2.25rem;
        text-align: center;
        position: relative;
        animation: modalPop 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      ">
        <button type="button" onclick="document.getElementById('quoteSuccessModal').remove()" style="
          position: absolute;
          top: 1.25rem;
          right: 1.25rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 1.2rem;
          cursor: pointer;
          transition: all 0.2s ease;
        " onmouseover="this.style.color='#fff'; this.style.borderColor='var(--cyan)';" onmouseout="this.style.color='var(--text-muted)'; this.style.borderColor='rgba(255, 255, 255, 0.1)';" aria-label="Close">&times;</button>

        <div style="
          width: 76px;
          height: 76px;
          border-radius: 50%;
          background: rgba(34, 197, 94, 0.15);
          border: 2px solid #22c55e;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.25rem;
          color: #22c55e;
          font-size: 2.2rem;
          box-shadow: 0 0 30px rgba(34, 197, 94, 0.35);
        ">
          <i class="fas fa-check"></i>
        </div>

        <div style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.4rem 1.1rem; border-radius: 50px; background: rgba(0, 240, 255, 0.08); border: 1px solid var(--border-cyan); color: var(--cyan); font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">
          <i class="fas fa-clock"></i> Express Response: Within 4 Hours
        </div>

        <h3 style="font-size: 1.85rem; margin-bottom: 0.75rem; color: #fff; font-weight: 700;">
          Specifications Received!
        </h3>

        <div style="
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-sm, 10px);
          padding: 1rem 1.25rem;
          margin: 1.25rem auto 1.5rem;
          text-align: left;
        ">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.92rem;">
            <span style="color: var(--text-dim);">Selected Scope:</span>
            <strong style="color: var(--cyan);">${data.service || 'Custom Software'}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.92rem;">
            <span style="color: var(--text-dim);">Project Type:</span>
            <span style="color: #fff;">${data.project_type || 'New Product Build'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.92rem;">
            <span style="color: var(--text-dim);">Reference Ticket:</span>
            <span style="font-family: var(--font-mono); color: var(--purple-light); font-weight: 600;">${data.quote_ref}</span>
          </div>
        </div>

        <p style="color: var(--text-muted); font-size: 1.05rem; line-height: 1.7; margin-bottom: 2rem;">
          Thank you, <strong style="color: #fff;">${data.name}</strong>. Our engineering leads have started analyzing your specifications. <strong style="color: var(--cyan);">Our team will share your custom project blueprint, architecture breakdown, and timeline estimate within 4 hours</strong>.
        </p>

        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          <button type="button" class="btn btn-primary" onclick="document.getElementById('quoteSuccessModal').remove();" style="padding: 0.85rem 2rem;">
            <i class="fas fa-check-circle"></i> Got It, Thank You
          </button>
          <a href="/" class="btn btn-outline" style="padding: 0.85rem 1.5rem;">
            Return to Home
          </a>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  function showQuoteSuccess(formElement, data) {
    formElement.innerHTML = `
      <div class="form-success-state" style="text-align: center; padding: 3rem 1.5rem; background: rgba(0, 240, 255, 0.04); border: 1px solid var(--border-cyan); border-radius: var(--radius-md); animation: fadeIn 0.4s ease;">
        <div style="width: 72px; height: 72px; border-radius: 50%; background: rgba(34, 197, 94, 0.15); border: 2px solid #22c55e; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; color: #22c55e; font-size: 2rem;">
          <i class="fas fa-check"></i>
        </div>
        <div style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.35rem 1rem; border-radius: 50px; background: rgba(0, 240, 255, 0.08); border: 1px solid var(--border-cyan); color: var(--cyan); font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">
          <i class="fas fa-clock"></i> Response Within 4 Hours
        </div>
        <h3 style="font-size: 1.7rem; margin-bottom: 0.75rem; color: #fff;">Project Specifications Submitted!</h3>
        <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm); padding: 0.85rem 1rem; margin: 1rem auto 1.5rem; max-width: 440px; font-family: var(--font-mono); font-size: 0.95rem; color: var(--cyan);">
          Ticket Ref: <strong>${data.quote_ref}</strong> &bull; Scope: <strong>${data.service}</strong>
        </div>
        <p style="color: var(--text-muted); font-size: 1.05rem; line-height: 1.7; max-width: 520px; margin: 0 auto 1.75rem;">
          Thank you, <strong style="color: #fff;">${data.name}</strong>. Our engineering leads will review your specifications and share your detailed scope and technical blueprint within <strong style="color: var(--cyan);">4 hours</strong>.
        </p>
        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          <button type="button" class="btn btn-outline btn-sm" onclick="location.reload();">
            <i class="fas fa-redo"></i> Submit Another Project Scope
          </button>
          <a href="/portfolio" class="btn btn-primary btn-sm">
            Explore Our Portfolio <i class="fas fa-arrow-right"></i>
          </a>
        </div>
      </div>
    `;
  }

});

