/**
 * Vyomantra Technologies - Admin Control Center Engine
 * Unified Dual-Mode Architecture:
 * - Live Mode: Connects to Hostinger PHP MySQL REST APIs (/api/admin/*.php)
 * - Static Dev Mode: Seamless localStorage persistence for VS Code Live Server (127.0.0.1:5500)
 */

// 0. Clean Extensionless URLs: Strip .html immediately from browser address bar
(function cleanUrlExtension() {
  try {
    if (typeof window !== 'undefined' && window.location) {
      var p = window.location.pathname;
      if (p.endsWith('.html')) {
        var clean = p.replace(/\.html$/, '');
        if (clean.endsWith('/index')) clean = clean.slice(0, -5);
        if (!clean) clean = '/';
        window.history.replaceState(null, '', clean + window.location.search + window.location.hash);
      }
    }
  } catch (e) {}
})();

// Global State
let currentAdminUser = null;
let authToken = null;
let activeTab = 'stats';
let monthlyChartInstance = null;
let courseChartInstance = null;
let isDevStaticMode = false;
const isLocalDevHost = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:');

// Universal Auth Header Helper
function getAuthHeaders(extra = {}) {
  const h = { ...extra };
  if (authToken) {
    h['Authorization'] = 'Bearer ' + authToken;
    h['X-Admin-Token'] = authToken;
  }
  return h;
}

// Authenticated API fetch wrapper: attaches headers and query token fallback
async function apiFetch(url, options = {}) {
  const isPost = options.method && options.method.toUpperCase() === 'POST';
  let finalUrl = url;

  if (!isPost && authToken && !finalUrl.includes('token=')) {
    const separator = finalUrl.includes('?') ? '&' : '?';
    finalUrl += separator + 'token=' + encodeURIComponent(authToken);
  }

  options.headers = getAuthHeaders(options.headers || {});

  const res = await fetch(finalUrl, options);

  if (res.status === 401 && !isDevStaticMode) {
    localStorage.removeItem('vyomantra_admin_token');
    localStorage.removeItem('vyomantra_admin_user');
    window.location.href = './';
  }

  return res;
}

// =========================================================================
// 1. INITIALIZATION & DUAL-MODE AUTH GUARD
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  authToken = localStorage.getItem('vyomantra_admin_token');

  if (!authToken) {
    window.location.href = './';
    return;
  }

  const isLocalDevHost = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:');

  if (isLocalDevHost) {
    // 1A. LOCAL STATIC DEV ENVIRONMENT (Live Server port 5500, localhost)
    isDevStaticMode = true;
    currentAdminUser = JSON.parse(localStorage.getItem('vyomantra_admin_user') || '{"username":"admin","full_name":"Vyomantra Administrator","role":"super_admin"}');
    populateHeaderUser(currentAdminUser);
    initLocalSeedData();
  } else {
    // 1B. LIVE PRODUCTION ENVIRONMENT (vyomantratech.com)
    isDevStaticMode = false;

    // If an obsolete mock or local token is in localStorage, purge it so user authenticates with live DB
    if (authToken.startsWith('mock_token_') || authToken.startsWith('local_')) {
      localStorage.removeItem('vyomantra_admin_token');
      localStorage.removeItem('vyomantra_admin_user');
      window.location.href = './';
      return;
    }

    try {
      const res = await apiFetch('../api/admin/auth.php', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
        body: 'action=verify&token=' + encodeURIComponent(authToken)
      });

      if (res.status === 401) {
        // Session expired or invalid on MySQL
        localStorage.removeItem('vyomantra_admin_token');
        localStorage.removeItem('vyomantra_admin_user');
        window.location.href = './';
        return;
      }

      const result = await res.json().catch(() => null);
      if (!result || !result.success) {
        localStorage.removeItem('vyomantra_admin_token');
        localStorage.removeItem('vyomantra_admin_user');
        window.location.href = './';
        return;
      }

      currentAdminUser = result.data.user || {};
      populateHeaderUser(currentAdminUser);
    } catch (err) {
      console.error('Production auth verification network error', err);
    }
  }

  // Initialize widgets independently so one broken dashboard widget cannot
  // prevent the certificate controls (or other sections) from receiving events.
  const initializers = [
    ['Sidebar navigation', initSidebarTabs],
    ['Logout controls', initLogout],
    ['Refresh control', initRefresh],
    ['Certificates', initCertificatesManager],
    ['Contact filters', initContactsFilters],
    ['Course Registrations', initRegistrationsFilters],
    ['Courses CMS', initCoursesCMS],
    ['Quote filters', initQuotesFilters],
    ['Applicant filters', initApplicantsFilters],
    ['Jobs CMS', initJobsCMS]
  ];
  initializers.forEach(([name, initialize]) => {
    try {
      initialize();
    } catch (error) {
      console.error(`${name} controls could not initialize`, error);
      showToast(`${name} controls failed to load. Refresh the dashboard and try again.`, true);
    }
  });

  // Load initial tab data
  loadCurrentTab();
});

function populateHeaderUser(user) {
  const nameEl = document.getElementById('headerUserName');
  const roleEl = document.getElementById('headerUserRole');
  const avatarEl = document.getElementById('headerUserAvatar');

  if (nameEl) nameEl.textContent = user.full_name || user.username || 'Administrator';
  if (roleEl) {
    roleEl.innerHTML = (user.role === 'super_admin') 
      ? `Super Admin ${isDevStaticMode ? '<span style="color:#22c55e; margin-left:4px; font-size:0.68rem; font-weight:700;">● LOCAL DEV</span>' : '<span style="color:#00f0ff; margin-left:4px; font-size:0.68rem;">● LIVE DB</span>'}`
      : 'Editor';
  }
  if (avatarEl) {
    const firstChar = (user.full_name || user.username || 'V').charAt(0).toUpperCase();
    avatarEl.textContent = firstChar;
  }
}

function initLogout() {
  const doLogout = async () => {
    try {
      if (!isDevStaticMode) {
        await apiFetch('../api/admin/auth.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'action=logout&token=' + encodeURIComponent(authToken)
        });
      }
    } catch (e) {}
    localStorage.removeItem('vyomantra_admin_token');
    localStorage.removeItem('vyomantra_admin_user');
    window.location.href = './';
  };

  const topbarBtn = document.getElementById('topbarLogoutBtn');
  const sidebarBtn = document.getElementById('sidebarLogoutBtn');
  if (topbarBtn) topbarBtn.addEventListener('click', doLogout);
  if (sidebarBtn) sidebarBtn.addEventListener('click', doLogout);
}

function initRefresh() {
  const btn = document.getElementById('globalRefreshBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      const icon = document.getElementById('refreshIcon');
      if (icon) icon.classList.add('fa-spin');
      loadCurrentTab().finally(() => {
        setTimeout(() => {
          if (icon) icon.classList.remove('fa-spin');
          showToast('Dashboard synchronized with latest data');
        }, 350);
      });
    });
  }
}

// =========================================================================
// 2. TAB SWITCHING
// =========================================================================
function initSidebarTabs() {
  const buttons = document.querySelectorAll('.sidebar-tab-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });
  });
}

function switchTab(tabId) {
  activeTab = tabId;

  document.querySelectorAll('.admin-tab-view').forEach(view => {
    view.classList.remove('active');
  });

  const targetView = document.getElementById('view-' + tabId);
  if (targetView) targetView.classList.add('active');

  const titles = {
    'stats': { title: '<i class="fas fa-chart-pie" style="color:var(--cyan);"></i> Executive Dashboard', subtitle: 'Unified cross-channel metrics, registrations & recruitment management.' },
    'contacts': { title: '<i class="fas fa-envelope-open-text" style="color:var(--cyan);"></i> Contact Inquiries', subtitle: 'Manage client messages and direct WhatsApp/email replies.' },
    'quotes': { title: '<i class="fas fa-file-invoice-dollar" style="color:var(--cyan);"></i> Project Quotations', subtitle: 'Track custom software scopes, budgets, and pipeline status.' },
    'courses-cms': { title: '<i class="fas fa-graduation-cap" style="color:var(--cyan);"></i> Course Creation CMS', subtitle: 'Create, edit, and publish technical courses, syllabi, cohorts, and pricing.' },
    'course-registrations': { title: '<i class="fas fa-user-graduate" style="color:var(--cyan);"></i> Course Registrations & Admissions', subtitle: 'Verify student UPI payments, approve enrollments, and manage admissions.' },
    'courses': { title: '<i class="fas fa-user-graduate" style="color:var(--cyan);"></i> Course Registrations & Admissions', subtitle: 'Verify student UPI payments, approve enrollments, and manage admissions.' },
    'jobs': { title: '<i class="fas fa-briefcase" style="color:var(--cyan);"></i> Job Postings & CMS', subtitle: 'Publish new roles, update active openings, and generate subpages.' },
    'applicants': { title: '<i class="fas fa-users-cog" style="color:var(--cyan);"></i> Job & Internship Applicants', subtitle: 'Review candidate resumes, portfolios, and interview pipelines.' },
    'certificates': { title: '<i class="fas fa-certificate" style="color:var(--cyan);"></i> Credential & Certificate Authority', subtitle: 'Issue, verify, revoke, and manage authentic company certificates with QR verification & DOCX/PDF generation.' }
  };

  const info = titles[tabId] || titles['stats'];
  document.getElementById('topbarTitle').innerHTML = info.title;
  document.getElementById('topbarSubtitle').textContent = info.subtitle;

  loadCurrentTab();
}

function loadCurrentTab() {
  switch (activeTab) {
    case 'stats':
      return fetchDashboardStats();
    case 'contacts':
      return fetchContacts();
    case 'quotes':
      return fetchQuotes();
    case 'courses-cms':
      return fetchCoursesCMS();
    case 'course-registrations':
    case 'courses':
      return fetchCourseRegistrations();
    case 'applicants':
      return fetchApplicants();
    case 'jobs':
      return fetchJobs();
    case 'certificates':
      return fetchCertificates();
    default:
      return Promise.resolve();
  }
}

// =========================================================================
// 3. TAB 1: OVERVIEW & STATISTICS
// =========================================================================
async function fetchDashboardStats() {
  if (isDevStaticMode) {
    renderLocalStats();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/stats.php');
    if (res.status === 405) {
      renderLocalStats();
      return;
    }

    const result = await res.json().catch(() => null);
    if (!result || !result.success || !result.data) {
      renderLocalStats();
      return;
    }

    updateStatsUI(result.data);
  } catch (err) {
    renderLocalStats();
  }
}

function updateStatsUI(data) {
  if (!data) return;
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt('statContactsTotal', data.contacts?.total || 0);
  setTxt('statContactsNew', (data.contacts?.new || 0) + ' New');

  setTxt('statQuotesTotal', data.quotes?.total || 0);
  setTxt('statQuotesNew', (data.quotes?.new || 0) + ' New');

  setTxt('statCoursesTotal', data.courses?.total || 0);
  setTxt('statCoursesRevenue', '₹' + Number(data.courses?.total_revenue || 0).toLocaleString('en-IN'));

  setTxt('statApplicantsTotal', data.careers?.total_applicants || 0);
  setTxt('statApplicantsReviewing', (data.careers?.applied || 0) + ' New');

  setTxt('statJobsActive', data.jobs?.active || 0);

  if (data.certificates) {
    setTxt('statCertsTotal', data.certificates.total || 0);
    setTxt('statCertsValid', (data.certificates.valid || 0) + ' Valid');
    setTxt('statCertsThisMonth', (data.certificates.this_month || 0) + ' this month');
    setTxt('countBadgeCertificates', data.certificates.total || 0);
  }

  setTxt('countBadgeContacts', data.contacts?.new || 0);
  setTxt('countBadgeQuotes', data.quotes?.new || 0);
  setTxt('countBadgeCoursesCMS', data.courses?.total || 0);
  setTxt('countBadgeRegistrations', data.courses?.pending || 0);
  setTxt('countBadgeCourses', data.courses?.pending || 0);
  setTxt('countBadgeApplicants', data.careers?.applied || 0);
  setTxt('countBadgeJobs', data.jobs?.active || 0);

  if (data.charts?.monthly) renderMonthlyChart(data.charts.monthly);
  if (data.charts?.courses_breakdown) renderCoursesChart(data.charts.courses_breakdown);
  if (data.activity) renderActivityStream(data.activity);
}

function renderLocalStats() {
  const contacts = getLocalData('contacts');
  const quotes = getLocalData('quotes');
  const courses = getLocalData('courses');
  const applicants = getLocalData('applicants');
  const jobs = getLocalData('jobs');
  const certs = getLocalData('certificates');

  let revenue = 0;
  courses.forEach(c => {
    if (c.payment_status === 'verified') {
      revenue += Number(c.amount_paid || 649);
    }
  });

  const contactsNew = contacts.filter(c => c.status === 'new').length;
  const quotesNew = quotes.filter(q => q.status === 'new').length;
  const coursesPending = courses.filter(c => c.payment_status === 'pending_verification').length;
  const applicantsApplied = applicants.filter(a => a.status === 'applied').length;
  const jobsActive = jobs.filter(j => (j.status || 'active') === 'active').length;
  const certsValid = certs.filter(c => (c.status || 'valid') === 'valid').length;
  const curMonth = new Date().toISOString().substring(0, 7);
  const certsMonth = certs.filter(c => (c.issue_date || '').startsWith(curMonth)).length;

  const data = {
    contacts: { total: contacts.length, new: contactsNew },
    quotes: { total: quotes.length, new: quotesNew },
    courses: { total: courses.length, pending: coursesPending, total_revenue: revenue },
    careers: { total_applicants: applicants.length, applied: applicantsApplied },
    jobs: { total_postings: jobs.length, active: jobsActive },
    certificates: { total: certs.length, valid: certsValid, this_month: certsMonth, verifications: 0 },
    charts: {
      monthly: {
        labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep 2026'],
        inquiries: [14, 21, 28, 35, Math.max(contacts.length, 42)],
        courses: [6, 12, 18, 25, Math.max(courses.length, 32)],
        quotes: [4, 8, 12, 16, Math.max(quotes.length, 20)]
      },
      courses_breakdown: [
        { course_name: 'Full-Stack Web Dev', cnt: 18 },
        { course_name: 'Python Backend', cnt: 12 },
        { course_name: 'AI & Machine Learning', cnt: 10 }
      ]
    },
    activity: [
      ...contacts.slice(0, 3).map(c => ({ type: 'contact', title: c.name, subtitle: c.service, status: c.status, created_at: c.created_at })),
      ...quotes.slice(0, 2).map(q => ({ type: 'quote', title: q.name, subtitle: q.company || q.service, status: q.status, created_at: q.created_at })),
      ...courses.slice(0, 2).map(c => ({ type: 'course', title: c.student_name, subtitle: `${c.course_name} (₹${c.amount_paid})`, status: c.payment_status, created_at: c.created_at })),
      ...applicants.slice(0, 2).map(a => ({ type: 'career', title: a.name, subtitle: a.role_applied, status: a.status, created_at: a.created_at }))
    ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 8)
  };

  updateStatsUI(data);
}

function renderMonthlyChart(monthlyData) {
  const canvas = document.getElementById('monthlyActivityChart');
  if (!canvas) return;
  if (typeof Chart === 'undefined') return;

  if (monthlyChartInstance) {
    monthlyChartInstance.destroy();
  }

  const labels = (monthlyData && monthlyData.labels && monthlyData.labels.length) ? monthlyData.labels : ['May', 'Jun', 'Jul', 'Aug', 'Sep 2026'];
  const inquiries = (monthlyData && monthlyData.inquiries) ? monthlyData.inquiries : [14, 21, 28, 35, 42];
  const courses = (monthlyData && monthlyData.courses) ? monthlyData.courses : [6, 12, 18, 25, 32];
  const quotes = (monthlyData && monthlyData.quotes) ? monthlyData.quotes : [4, 8, 12, 16, 20];

  monthlyChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Inquiries & Leads',
          data: inquiries,
          borderColor: '#00f0ff',
          backgroundColor: 'rgba(0, 240, 255, 0.08)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#00f0ff',
          pointRadius: 4
        },
        {
          label: 'Course Admissions',
          data: courses,
          borderColor: '#22c55e',
          backgroundColor: 'transparent',
          borderDash: [4, 4],
          tension: 0.35,
          pointBackgroundColor: '#22c55e',
          pointRadius: 3
        },
        {
          label: 'Project Quotes',
          data: quotes,
          borderColor: '#8b5cf6',
          backgroundColor: 'transparent',
          tension: 0.35,
          pointBackgroundColor: '#8b5cf6',
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 12 } } },
        tooltip: {
          backgroundColor: '#080d24',
          borderColor: 'rgba(0, 240, 255, 0.4)',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#cbd5e1'
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b' } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b', precision: 0 } }
      }
    }
  });
}

function renderCoursesChart(breakdown) {
  const canvas = document.getElementById('courseDistributionChart');
  if (!canvas) return;
  if (typeof Chart === 'undefined') return;

  if (courseChartInstance) {
    courseChartInstance.destroy();
  }

  let labels = ['Full-Stack Web Dev', 'Python Backend', 'AI & Machine Learning'];
  let values = [45, 30, 25];

  if (breakdown && breakdown.length > 0) {
    labels = breakdown.map(b => b.course_name);
    values = breakdown.map(b => b.cnt);
  }

  courseChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: ['#00f0ff', '#8b5cf6', '#22c55e', '#f59e0b'],
        borderColor: '#02040a',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      cutout: '70%'
    }
  });

  const legendBox = document.getElementById('courseLegendBox');
  if (legendBox) {
    const colors = ['#00f0ff', '#8b5cf6', '#22c55e', '#f59e0b'];
    legendBox.innerHTML = labels.map((lbl, idx) => `
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <span style="display:flex; align-items:center; gap:0.4rem; color:var(--text-muted);">
          <span style="width:8px; height:8px; border-radius:50%; background:${colors[idx % colors.length]}; display:inline-block;"></span>
          ${lbl}
        </span>
        <strong style="color:#fff;">${values[idx]}</strong>
      </div>
    `).join('');
  }
}

function renderActivityStream(activities) {
  const container = document.getElementById('recentActivityList');
  if (!container) return;

  if (!activities || activities.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:2rem; color:var(--text-dim);">
        <i class="fas fa-inbox" style="font-size:2rem; margin-bottom:0.5rem; opacity:0.5;"></i>
        <p>No recent submissions found. When users submit forms, live events will appear here.</p>
      </div>
    `;
    return;
  }

  const typeConfig = {
    'contact': { icon: 'fas fa-comments', color: 'var(--cyan)', bg: 'rgba(0, 240, 255, 0.1)', label: 'Contact Inquiry' },
    'quote': { icon: 'fas fa-file-invoice-dollar', color: 'var(--purple)', bg: 'rgba(139, 92, 246, 0.1)', label: 'Quote Scope' },
    'course': { icon: 'fas fa-user-graduate', color: 'var(--green)', bg: 'rgba(34, 197, 94, 0.1)', label: 'Course Enrollment' },
    'career': { icon: 'fas fa-user-tie', color: 'var(--amber)', bg: 'rgba(245, 158, 11, 0.1)', label: 'Job Application' }
  };

  container.innerHTML = activities.map(item => {
    const cfg = typeConfig[item.type] || typeConfig['contact'];
    const timeFormatted = item.created_at ? new Date(item.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently';

    return `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem 1rem; background:rgba(255,255,255,0.02); border:1px solid var(--border-admin); border-radius:var(--radius-sm); gap:1rem;">
        <div style="display:flex; align-items:center; gap:0.85rem;">
          <div style="width:36px; height:36px; border-radius:var(--radius-sm); background:${cfg.bg}; color:${cfg.color}; display:flex; align-items:center; justify-content:center; font-size:1rem; flex-shrink:0;">
            <i class="${cfg.icon}"></i>
          </div>
          <div>
            <div style="font-size:0.92rem; font-weight:600; color:#fff;">${escapeHtml(item.title)}</div>
            <div style="font-size:0.8rem; color:var(--text-dim);">${escapeHtml(item.subtitle || cfg.label)}</div>
          </div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <span class="status-badge ${getStatusBadgeClass(item.status)}">${escapeHtml(item.status)}</span>
          <div style="font-size:0.75rem; color:var(--text-dim); margin-top:2px;">${timeFormatted}</div>
        </div>
      </div>
    `;
  }).join('');
}

// =========================================================================
// 4. TAB 2: CONTACT INQUIRIES
// =========================================================================
function initContactsFilters() {
  const statusSelect = document.getElementById('filterContactStatus');
  const searchInput = document.getElementById('searchContacts');

  if (statusSelect) statusSelect.addEventListener('change', fetchContacts);
  if (searchInput) searchInput.addEventListener('input', debounce(fetchContacts, 300));
}

async function fetchContacts() {
  const status = document.getElementById('filterContactStatus')?.value || 'all';
  const search = document.getElementById('searchContacts')?.value || '';
  const tbody = document.getElementById('contactsTableBody');

  let list = [];

  if (!isDevStaticMode) {
    try {
      const res = await apiFetch(`../api/admin/contacts.php?action=list&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`, {
        headers: { 'Authorization': 'Bearer ' + authToken }
      });
      if (res.status === 405) {
        isDevStaticMode = true;
      } else {
        const result = await res.json().catch(() => null);
        if (result && result.success && result.data) {
          list = result.data.contacts || [];
        }
      }
    } catch (e) {
      isDevStaticMode = true;
    }
  }

  if (isDevStaticMode) {
    let all = getLocalData('contacts');
    list = all.filter(c => {
      const matchesStatus = (status === 'all' || c.status === status);
      const haystack = (c.name + ' ' + c.email + ' ' + (c.service || '') + ' ' + (c.message || '')).toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-dim);">No contact inquiries found matching criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr>
      <td style="color:var(--text-dim); font-size:0.82rem; white-space:nowrap;">
        ${formatDate(c.created_at)}
      </td>
      <td>
        <strong style="color:#fff; display:block;">${escapeHtml(c.name)}</strong>
        <span style="color:var(--cyan); font-size:0.82rem;">${escapeHtml(c.email)}</span>
      </td>
      <td style="white-space:nowrap;">
        <a href="tel:${escapeHtml(c.phone)}" style="color:var(--text-muted); text-decoration:none;">${escapeHtml(c.phone)}</a>
      </td>
      <td>
        <span class="badge-pill" style="font-size:0.75rem;">${escapeHtml(c.service || 'General')}</span>
      </td>
      <td style="max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-muted);">
        ${escapeHtml(c.message)}
      </td>
      <td>
        <select class="admin-select" style="font-size:0.78rem; padding:0.25rem 0.5rem;" onchange="updateContactStatus(${c.id}, this.value)">
          <option value="new" ${c.status === 'new' ? 'selected' : ''}>New</option>
          <option value="contacted" ${c.status === 'contacted' ? 'selected' : ''}>Contacted</option>
          <option value="resolved" ${c.status === 'resolved' ? 'selected' : ''}>Resolved</option>
          <option value="archived" ${c.status === 'archived' ? 'selected' : ''}>Archived</option>
        </select>
      </td>
      <td style="text-align:right; white-space:nowrap;">
        <a href="https://wa.me/${cleanPhoneForWa(c.phone)}?text=${encodeURIComponent('Hi ' + c.name + ', thank you for contacting Vyomantra Technologies!')}" target="_blank" class="btn-action-icon whatsapp" title="Chat on WhatsApp">
          <i class="fab fa-whatsapp"></i>
        </a>
        <a href="mailto:${escapeHtml(c.email)}" class="btn-action-icon" title="Send Email">
          <i class="fas fa-envelope"></i>
        </a>
        <button type="button" class="btn-action-icon" title="View Full Message" onclick="viewContactModal(${JSON.stringify(c).replace(/"/g, '&quot;')})">
          <i class="fas fa-eye"></i>
        </button>
        <button type="button" class="btn-action-icon danger" title="Delete Inquiry" onclick="deleteContact(${c.id})">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function updateContactStatus(id, newStatus) {
  if (isDevStaticMode) {
    let all = getLocalData('contacts');
    all.forEach(c => { if (c.id == id) c.status = newStatus; });
    saveLocalData('contacts', all);
    showToast(`Contact inquiry #${id} marked as ${newStatus}`);
    fetchDashboardStats();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/contacts.php', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + authToken
      },
      body: `action=update_status&id=${id}&status=${encodeURIComponent(newStatus)}`
    });
    const result = await res.json();
    if (result && result.success) showToast(result.message);
  } catch (e) {
    showToast('Failed to update status', true);
  }
}

async function deleteContact(id) {
  if (!confirm('Are you sure you want to permanently delete this contact inquiry?')) return;

  if (isDevStaticMode) {
    let all = getLocalData('contacts').filter(c => c.id != id);
    saveLocalData('contacts', all);
    showToast('Inquiry deleted successfully');
    fetchContacts();
    fetchDashboardStats();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/contacts.php', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + authToken
      },
      body: `action=delete&id=${id}`
    });
    const result = await res.json();
    if (result && result.success) {
      showToast('Inquiry deleted successfully');
      fetchContacts();
    }
  } catch (e) {
    showToast('Failed to delete', true);
  }
}

function viewContactModal(contact) {
  document.getElementById('detailsModalTitle').innerHTML = '<i class="fas fa-comments" style="color:var(--cyan);"></i> Contact Message Details';
  document.getElementById('detailsModalBody').innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1rem;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; padding-bottom:1rem; border-bottom:1px solid var(--border-admin);">
        <div><span style="color:var(--text-dim); display:block; font-size:0.8rem;">Sender:</span> <strong style="color:#fff;">${escapeHtml(contact.name)}</strong></div>
        <div><span style="color:var(--text-dim); display:block; font-size:0.8rem;">Date:</span> <span style="color:var(--text-muted);">${formatDate(contact.created_at)}</span></div>
        <div><span style="color:var(--text-dim); display:block; font-size:0.8rem;">Email:</span> <a href="mailto:${escapeHtml(contact.email)}" style="color:var(--cyan);">${escapeHtml(contact.email)}</a></div>
        <div><span style="color:var(--text-dim); display:block; font-size:0.8rem;">Phone:</span> <a href="tel:${escapeHtml(contact.phone)}" style="color:var(--cyan);">${escapeHtml(contact.phone)}</a></div>
      </div>
      <div>
        <span style="color:var(--text-dim); display:block; font-size:0.8rem; margin-bottom:0.25rem;">Service Requested:</span>
        <span class="badge-pill badge-purple">${escapeHtml(contact.service || 'General')}</span>
      </div>
      <div>
        <span style="color:var(--text-dim); display:block; font-size:0.8rem; margin-bottom:0.5rem;">Message Body:</span>
        <div style="background:#02040a; border:1px solid var(--border-admin); border-radius:var(--radius-sm); padding:1.25rem; color:#cbd5e1; line-height:1.7; white-space:pre-wrap;">${escapeHtml(contact.message)}</div>
      </div>
      <div style="display:flex; gap:0.75rem; margin-top:0.5rem;">
        <a href="https://wa.me/${cleanPhoneForWa(contact.phone)}?text=${encodeURIComponent('Hi ' + contact.name + ', regarding your inquiry on Vyomantra Technologies...')}" target="_blank" class="btn btn-primary btn-sm" style="background:#22c55e; border-color:#22c55e;">
          <i class="fab fa-whatsapp"></i> Reply on WhatsApp
        </a>
        <a href="mailto:${escapeHtml(contact.email)}" class="btn btn-outline btn-sm">
          <i class="fas fa-envelope"></i> Send Email
        </a>
      </div>
    </div>
  `;
  openAdminModal('detailsModal');
}

// =========================================================================
// 5. TAB 3: COURSE ADMISSIONS & PAYMENTS
// =========================================================================
function initRegistrationsFilters() {
  const statusSelect = document.getElementById('filterRegPaymentStatus') || document.getElementById('filterCourseStatus');
  const programSelect = document.getElementById('filterRegProgram') || document.getElementById('filterCourseProgram');
  const searchInput = document.getElementById('searchRegistrations') || document.getElementById('searchCourses');

  if (statusSelect) statusSelect.addEventListener('change', fetchCourseRegistrations);
  if (programSelect) programSelect.addEventListener('change', fetchCourseRegistrations);
  if (searchInput) searchInput.addEventListener('input', debounce(fetchCourseRegistrations, 300));
}

async function fetchCourseRegistrations() {
  const status = (document.getElementById('filterRegPaymentStatus') || document.getElementById('filterCourseStatus'))?.value || 'all';
  const course = (document.getElementById('filterRegProgram') || document.getElementById('filterCourseProgram'))?.value || 'all';
  const search = (document.getElementById('searchRegistrations') || document.getElementById('searchCourses'))?.value || '';
  const tbody = document.getElementById('registrationsTableBody') || document.getElementById('coursesTableBody');

  let list = [];

  if (!isDevStaticMode) {
    try {
      const res = await apiFetch(`../api/admin/courses.php?action=list&status=${encodeURIComponent(status)}&course=${encodeURIComponent(course)}&search=${encodeURIComponent(search)}`, {
        headers: { 'Authorization': 'Bearer ' + authToken }
      });
      if (res.status === 405) {
        isDevStaticMode = true;
      } else {
        const result = await res.json().catch(() => null);
        if (result && result.success && result.data) {
          list = result.data.registrations || [];
        }
      }
    } catch (e) {
      isDevStaticMode = true;
    }
  }

  if (isDevStaticMode) {
    let all = getLocalData('courses');
    list = all.filter(c => {
      const matchesStatus = (status === 'all' || c.payment_status === status);
      const matchesCourse = (course === 'all' || (c.course_name || '').toLowerCase().includes(course.toLowerCase()));
      const haystack = (c.student_name + ' ' + c.email + ' ' + c.phone + ' ' + (c.reference_number || '')).toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      return matchesStatus && matchesCourse && matchesSearch;
    });
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:3rem; color:var(--text-dim);">No course registrations found.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr>
      <td style="color:var(--text-dim); font-size:0.82rem; white-space:nowrap;">
        ${formatDate(c.created_at)}
      </td>
      <td>
        <strong style="color:#fff; display:block;">${escapeHtml(c.student_name)}</strong>
        <span style="color:var(--cyan); font-size:0.82rem;">${escapeHtml(c.email)}</span>
        <div style="font-size:0.78rem; color:var(--text-dim);">${escapeHtml(c.phone)}</div>
      </td>
      <td>
        <span class="badge-pill badge-purple" style="font-size:0.75rem;">${escapeHtml(c.course_name)}</span>
        <div style="font-size:0.75rem; color:var(--text-dim); margin-top:2px;">${escapeHtml(c.course_mode || 'Live Online')}</div>
      </td>
      <td style="font-weight:700; color:var(--green); font-size:0.95rem;">
        ₹${Number(c.amount_paid || 649).toLocaleString('en-IN')}
      </td>
      <td>
        <span style="font-family:var(--font-mono); color:#fff; font-size:0.85rem; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">
          ${escapeHtml(c.reference_number)}
        </span>
      </td>
      <td>
        ${c.screenshot_filepath ? `
          <button type="button" class="btn btn-outline btn-sm" style="padding:0.25rem 0.6rem; font-size:0.78rem;" onclick="viewPaymentProofModal('${escapeHtml(c.screenshot_filepath)}', '${escapeHtml(c.student_name)}', '${escapeHtml(c.reference_number)}', ${c.id})">
            <i class="fas fa-image"></i> View Receipt
          </button>
        ` : `<span style="color:var(--text-dim); font-size:0.78rem;">No file</span>`}
      </td>
      <td>
        <span class="status-badge ${getStatusBadgeClass(c.payment_status)}">
          ${escapeHtml((c.payment_status || 'pending').replace('_', ' '))}
        </span>
      </td>
      <td style="text-align:right; white-space:nowrap;">
        ${c.payment_status !== 'verified' ? `
          <button type="button" class="btn btn-primary btn-sm" style="padding:0.25rem 0.6rem; font-size:0.78rem; background:#22c55e; border-color:#22c55e;" onclick="verifyPayment(${c.id}, 'verified')">
            <i class="fas fa-check"></i> Approve
          </button>
        ` : `
          <span style="color:var(--green); font-size:0.78rem; font-weight:700; margin-right:0.5rem;"><i class="fas fa-check-double"></i> Verified</span>
        `}
        ${c.payment_status !== 'rejected' ? `
          <button type="button" class="btn btn-outline btn-sm" style="padding:0.25rem 0.6rem; font-size:0.78rem; border-color:var(--red); color:var(--red);" onclick="verifyPayment(${c.id}, 'rejected')">
            Reject
          </button>
        ` : ''}
        <a href="https://wa.me/${cleanPhoneForWa(c.phone)}?text=${encodeURIComponent('Hi ' + c.student_name + ', your registration for ' + c.course_name + ' at Vyomantra Technologies has been verified!')}" target="_blank" class="btn-action-icon whatsapp" title="Chat on WhatsApp">
          <i class="fab fa-whatsapp"></i>
        </a>
        <button type="button" class="btn-action-icon danger" title="Delete" onclick="deleteCourseRegistration(${c.id})">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function viewPaymentProofModal(filePath, studentName, refNumber, regId) {
  const modalImg = document.getElementById('modalPaymentImg');
  const nameEl = document.getElementById('modalStudentName');
  const refEl = document.getElementById('modalStudentRef');
  const verifyBtn = document.getElementById('btnModalVerifyPayment');

  if (nameEl) nameEl.textContent = studentName;
  if (refEl) refEl.textContent = refNumber;
  if (modalImg) modalImg.src = filePath.startsWith('http') || filePath.startsWith('assets') ? ('../' + filePath) : ('../' + filePath);

  if (verifyBtn) {
    verifyBtn.onclick = () => {
      verifyPayment(regId, 'verified');
      closeAdminModal('paymentProofModal');
    };
  }

  openAdminModal('paymentProofModal');
}

async function verifyPayment(id, status) {
  if (isDevStaticMode) {
    let all = getLocalData('courses');
    all.forEach(c => { if (c.id == id) c.payment_status = status; });
    saveLocalData('courses', all);
    showToast(`Payment status updated to ${status}`);
    fetchCourses();
    fetchDashboardStats();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/courses.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + authToken
      },
      body: `action=verify_payment&id=${id}&status=${encodeURIComponent(status)}`
    });
    const result = await res.json();
    if (result && result.success) {
      showToast(result.message);
      fetchCourses();
      fetchDashboardStats();
    }
  } catch (e) {
    showToast('Failed to update payment status', true);
  }
}

async function deleteCourseRegistration(id) {
  if (!confirm('Are you sure you want to delete this course registration?')) return;

  if (isDevStaticMode) {
    let all = getLocalData('courses').filter(c => c.id != id);
    saveLocalData('courses', all);
    showToast('Registration deleted');
    fetchCourses();
    fetchDashboardStats();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/courses.php', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + authToken
      },
      body: `action=delete&id=${id}`
    });
    const result = await res.json();
    if (result && result.success) {
      showToast('Registration deleted');
      fetchCourses();
    }
  } catch (e) {
    showToast('Failed to delete', true);
  }
}

// =========================================================================
// 6. TAB 4: PROJECT QUOTATIONS
// =========================================================================
function initQuotesFilters() {
  const statusSelect = document.getElementById('filterQuoteStatus');
  const searchInput = document.getElementById('searchQuotes');

  if (statusSelect) statusSelect.addEventListener('change', fetchQuotes);
  if (searchInput) searchInput.addEventListener('input', debounce(fetchQuotes, 300));
}

async function fetchQuotes() {
  const status = document.getElementById('filterQuoteStatus')?.value || 'all';
  const search = document.getElementById('searchQuotes')?.value || '';
  const tbody = document.getElementById('quotesTableBody');

  let list = [];

  if (!isDevStaticMode) {
    try {
      const res = await apiFetch(`../api/admin/quotes.php?action=list&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`, {
        headers: { 'Authorization': 'Bearer ' + authToken }
      });
      if (res.status === 405) {
        isDevStaticMode = true;
      } else {
        const result = await res.json().catch(() => null);
        if (result && result.success && result.data) {
          list = result.data.quotes || [];
        }
      }
    } catch (e) {
      isDevStaticMode = true;
    }
  }

  if (isDevStaticMode) {
    let all = getLocalData('quotes');
    list = all.filter(q => {
      const matchesStatus = (status === 'all' || q.status === status);
      const haystack = (q.name + ' ' + (q.company || '') + ' ' + q.email + ' ' + q.service).toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-dim);">No project quotation requests found.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(q => `
    <tr>
      <td style="color:var(--text-dim); font-size:0.82rem; white-space:nowrap;">
        ${formatDate(q.created_at)}
      </td>
      <td>
        <strong style="color:#fff; display:block;">${escapeHtml(q.name)}</strong>
        <span style="color:var(--text-muted); font-size:0.82rem;"><i class="fas fa-building" style="color:var(--cyan); margin-right:4px;"></i>${escapeHtml(q.company || 'Individual')}</span>
      </td>
      <td style="white-space:nowrap;">
        <a href="mailto:${escapeHtml(q.email)}" style="color:var(--cyan); display:block; font-size:0.82rem;">${escapeHtml(q.email)}</a>
        <a href="tel:${escapeHtml(q.phone)}" style="color:var(--text-muted); font-size:0.82rem;">${escapeHtml(q.phone)}</a>
      </td>
      <td>
        <span class="badge-pill badge-purple" style="font-size:0.75rem;">${escapeHtml(q.service)}</span>
        <div style="font-size:0.75rem; color:var(--text-dim); margin-top:2px;">${escapeHtml(q.project_type || 'Custom App')}</div>
      </td>
      <td>
        <span style="color:var(--green); font-weight:700; font-size:0.88rem;">${escapeHtml(q.budget || 'Open')}</span>
        <div style="font-size:0.75rem; color:var(--text-dim);">${escapeHtml(q.timeline || 'Flexible')}</div>
      </td>
      <td>
        <select class="admin-select" style="font-size:0.78rem; padding:0.25rem 0.5rem;" onchange="updateQuoteStatus(${q.id}, this.value)">
          <option value="new" ${q.status === 'new' ? 'selected' : ''}>New</option>
          <option value="contacted" ${q.status === 'contacted' ? 'selected' : ''}>Contacted</option>
          <option value="proposal_sent" ${q.status === 'proposal_sent' ? 'selected' : ''}>Proposal Sent</option>
          <option value="closed" ${q.status === 'closed' ? 'selected' : ''}>Closed / Won</option>
        </select>
      </td>
      <td style="text-align:right; white-space:nowrap;">
        <button type="button" class="btn btn-outline btn-sm" style="padding:0.25rem 0.6rem; font-size:0.78rem;" onclick="viewQuoteModal(${JSON.stringify(q).replace(/"/g, '&quot;')})">
          <i class="fas fa-file-alt"></i> Scope Details
        </button>
        <a href="https://wa.me/${cleanPhoneForWa(q.phone)}?text=${encodeURIComponent('Hi ' + q.name + ', regarding your quotation request for ' + q.service + ' at Vyomantra Technologies...')}" target="_blank" class="btn-action-icon whatsapp" title="Chat on WhatsApp">
          <i class="fab fa-whatsapp"></i>
        </a>
        <button type="button" class="btn-action-icon danger" title="Delete Quote" onclick="deleteQuote(${q.id})">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function updateQuoteStatus(id, newStatus) {
  if (isDevStaticMode) {
    let all = getLocalData('quotes');
    all.forEach(q => { if (q.id == id) q.status = newStatus; });
    saveLocalData('quotes', all);
    showToast(`Quote #${id} status changed to ${newStatus}`);
    fetchDashboardStats();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/quotes.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + authToken
      },
      body: `action=update_status&id=${id}&status=${encodeURIComponent(newStatus)}`
    });
    const result = await res.json();
    if (result && result.success) showToast(result.message);
  } catch (e) {
    showToast('Failed to update quote status', true);
  }
}

async function deleteQuote(id) {
  if (!confirm('Are you sure you want to delete this quote request?')) return;

  if (isDevStaticMode) {
    let all = getLocalData('quotes').filter(q => q.id != id);
    saveLocalData('quotes', all);
    showToast('Quote deleted');
    fetchQuotes();
    fetchDashboardStats();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/quotes.php', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + authToken
      },
      body: `action=delete&id=${id}`
    });
    const result = await res.json();
    if (result && result.success) {
      showToast('Quote deleted');
      fetchQuotes();
    }
  } catch (e) {
    showToast('Failed to delete quote', true);
  }
}

function viewQuoteModal(quote) {
  document.getElementById('detailsModalTitle').innerHTML = '<i class="fas fa-file-invoice-dollar" style="color:var(--cyan);"></i> Project Scope & Blueprint';
  document.getElementById('detailsModalBody').innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1rem;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; padding-bottom:1rem; border-bottom:1px solid var(--border-admin);">
        <div><span style="color:var(--text-dim); display:block; font-size:0.8rem;">Client / Lead:</span> <strong style="color:#fff;">${escapeHtml(quote.name)}</strong></div>
        <div><span style="color:var(--text-dim); display:block; font-size:0.8rem;">Company / Organization:</span> <strong style="color:var(--cyan);">${escapeHtml(quote.company || 'Not Specified')}</strong></div>
        <div><span style="color:var(--text-dim); display:block; font-size:0.8rem;">Email:</span> <a href="mailto:${escapeHtml(quote.email)}" style="color:var(--cyan);">${escapeHtml(quote.email)}</a></div>
        <div><span style="color:var(--text-dim); display:block; font-size:0.8rem;">Phone:</span> <a href="tel:${escapeHtml(quote.phone)}" style="color:var(--cyan);">${escapeHtml(quote.phone)}</a></div>
        <div><span style="color:var(--text-dim); display:block; font-size:0.8rem;">Budget:</span> <span style="color:var(--green); font-weight:700;">${escapeHtml(quote.budget || 'Open')}</span></div>
        <div><span style="color:var(--text-dim); display:block; font-size:0.8rem;">Target Timeline:</span> <span style="color:#fff;">${escapeHtml(quote.timeline || 'Flexible')}</span></div>
      </div>
      <div>
        <span style="color:var(--text-dim); display:block; font-size:0.8rem; margin-bottom:0.25rem;">Service & Architecture:</span>
        <span class="badge-pill badge-purple">${escapeHtml(quote.service)}</span>
        <span class="badge-pill" style="margin-left:6px;">${escapeHtml(quote.project_type || 'Standard')}</span>
      </div>
      <div>
        <span style="color:var(--text-dim); display:block; font-size:0.8rem; margin-bottom:0.5rem;">Detailed Project Description / Blueprint:</span>
        <div style="background:#02040a; border:1px solid var(--border-admin); border-radius:var(--radius-sm); padding:1.25rem; color:#cbd5e1; line-height:1.7; white-space:pre-wrap;">${escapeHtml(quote.description)}</div>
      </div>
      <div style="display:flex; gap:0.75rem; margin-top:0.5rem;">
        <a href="https://wa.me/${cleanPhoneForWa(quote.phone)}?text=${encodeURIComponent('Hi ' + quote.name + ', we reviewed your blueprint scope for ' + quote.service + ' at Vyomantra Technologies...')}" target="_blank" class="btn btn-primary btn-sm" style="background:#22c55e; border-color:#22c55e;">
          <i class="fab fa-whatsapp"></i> Chat on WhatsApp
        </a>
        <a href="mailto:${escapeHtml(quote.email)}?subject=${encodeURIComponent('Vyomantra Technologies - Proposal & Architecture Scope')}" class="btn btn-outline btn-sm">
          <i class="fas fa-envelope"></i> Send Proposal Email
        </a>
      </div>
    </div>
  `;
  openAdminModal('detailsModal');
}

// =========================================================================
// 7. TAB 5: JOB APPLICANTS
// =========================================================================
function initApplicantsFilters() {
  const statusSelect = document.getElementById('filterApplicantStatus');
  const searchInput = document.getElementById('searchApplicants');

  if (statusSelect) statusSelect.addEventListener('change', fetchApplicants);
  if (searchInput) searchInput.addEventListener('input', debounce(fetchApplicants, 300));
}

async function fetchApplicants() {
  const status = document.getElementById('filterApplicantStatus')?.value || 'all';
  const search = document.getElementById('searchApplicants')?.value || '';
  const tbody = document.getElementById('applicantsTableBody');

  let list = [];

  if (!isDevStaticMode) {
    try {
      const res = await apiFetch(`../api/admin/applicants.php?action=list&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`, {
        headers: { 'Authorization': 'Bearer ' + authToken }
      });
      if (res.status === 405) {
        isDevStaticMode = true;
      } else {
        const result = await res.json().catch(() => null);
        if (result && result.success && result.data) {
          list = result.data.applicants || [];
        }
      }
    } catch (e) {
      isDevStaticMode = true;
    }
  }

  if (isDevStaticMode) {
    let all = getLocalData('applicants');
    list = all.filter(a => {
      const matchesStatus = (status === 'all' || a.status === status);
      const haystack = (a.name + ' ' + a.email + ' ' + a.phone + ' ' + a.role_applied).toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:3rem; color:var(--text-dim);">No job applications found matching criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(a => `
    <tr>
      <td style="color:var(--text-dim); font-size:0.82rem; white-space:nowrap;">
        ${formatDate(a.created_at)}
      </td>
      <td>
        <strong style="color:#fff; display:block;">${escapeHtml(a.name)}</strong>
        <span style="color:var(--cyan); font-size:0.82rem;">${escapeHtml(a.email)}</span>
        <div style="font-size:0.78rem; color:var(--text-dim);">${escapeHtml(a.phone)}</div>
      </td>
      <td>
        <span class="badge-pill badge-purple" style="font-size:0.75rem;">${escapeHtml(a.role_applied)}</span>
      </td>
      <td style="color:var(--text-muted); font-size:0.85rem;">
        ${escapeHtml(a.experience || 'Fresher')}
      </td>
      <td>
        ${a.portfolio_url ? `
          <a href="${escapeHtml(a.portfolio_url)}" target="_blank" style="color:var(--cyan); text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-size:0.82rem;">
            <i class="fas fa-external-link-alt"></i> Portfolio
          </a>
        ` : `<span style="color:var(--text-dim); font-size:0.78rem;">-</span>`}
      </td>
      <td>
        ${a.resume_filepath ? `
          <a href="../${escapeHtml(a.resume_filepath)}" target="_blank" class="btn btn-outline btn-sm" style="padding:0.25rem 0.6rem; font-size:0.78rem; text-decoration:none;">
            <i class="fas fa-file-pdf" style="color:#ef4444; margin-right:4px;"></i> Download CV
          </a>
        ` : `<span style="color:var(--text-dim); font-size:0.78rem;">Uploaded</span>`}
      </td>
      <td>
        <select class="admin-select" style="font-size:0.78rem; padding:0.25rem 0.5rem;" onchange="updateApplicantStatus(${a.id}, this.value)">
          <option value="applied" ${a.status === 'applied' ? 'selected' : ''}>Applied</option>
          <option value="reviewing" ${a.status === 'reviewing' ? 'selected' : ''}>Reviewing</option>
          <option value="interview_scheduled" ${a.status === 'interview_scheduled' ? 'selected' : ''}>Interview Scheduled</option>
          <option value="offered" ${a.status === 'offered' ? 'selected' : ''}>Offered</option>
          <option value="rejected" ${a.status === 'rejected' ? 'selected' : ''}>Rejected</option>
        </select>
      </td>
      <td style="text-align:right; white-space:nowrap;">
        <button type="button" class="btn btn-outline btn-sm" style="padding:0.25rem 0.6rem; font-size:0.78rem;" onclick="viewApplicantModal(${JSON.stringify(a).replace(/"/g, '&quot;')})">
          <i class="fas fa-eye"></i> Notes
        </button>
        <a href="https://wa.me/${cleanPhoneForWa(a.phone)}?text=${encodeURIComponent('Hi ' + a.name + ', regarding your application for ' + a.role_applied + ' at Vyomantra Technologies...')}" target="_blank" class="btn-action-icon whatsapp" title="Chat on WhatsApp">
          <i class="fab fa-whatsapp"></i>
        </a>
        <button type="button" class="btn-action-icon danger" title="Delete Application" onclick="deleteApplicant(${a.id})">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function updateApplicantStatus(id, newStatus) {
  if (isDevStaticMode) {
    let all = getLocalData('applicants');
    all.forEach(a => { if (a.id == id) a.status = newStatus; });
    saveLocalData('applicants', all);
    showToast(`Applicant status changed to ${newStatus}`);
    fetchDashboardStats();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/applicants.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + authToken
      },
      body: `action=update_status&id=${id}&status=${encodeURIComponent(newStatus)}`
    });
    const result = await res.json();
    if (result && result.success) showToast(result.message);
  } catch (e) {
    showToast('Failed to update candidate status', true);
  }
}

async function deleteApplicant(id) {
  if (!confirm('Are you sure you want to remove this applicant?')) return;

  if (isDevStaticMode) {
    let all = getLocalData('applicants').filter(a => a.id != id);
    saveLocalData('applicants', all);
    showToast('Applicant removed');
    fetchApplicants();
    fetchDashboardStats();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/applicants.php', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + authToken
      },
      body: `action=delete&id=${id}`
    });
    const result = await res.json();
    if (result && result.success) {
      showToast('Applicant removed');
      fetchApplicants();
    }
  } catch (e) {
    showToast('Failed to remove applicant', true);
  }
}

function viewApplicantModal(applicant) {
  document.getElementById('detailsModalTitle').innerHTML = '<i class="fas fa-user-tie" style="color:var(--cyan);"></i> Candidate Application Profile';
  document.getElementById('detailsModalBody').innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1rem;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; padding-bottom:1rem; border-bottom:1px solid var(--border-admin);">
        <div><span style="color:var(--text-dim); display:block; font-size:0.8rem;">Candidate:</span> <strong style="color:#fff;">${escapeHtml(applicant.name)}</strong></div>
        <div><span style="color:var(--text-dim); display:block; font-size:0.8rem;">Role Applied:</span> <span class="badge-pill badge-purple">${escapeHtml(applicant.role_applied)}</span></div>
        <div><span style="color:var(--text-dim); display:block; font-size:0.8rem;">Email:</span> <a href="mailto:${escapeHtml(applicant.email)}" style="color:var(--cyan);">${escapeHtml(applicant.email)}</a></div>
        <div><span style="color:var(--text-dim); display:block; font-size:0.8rem;">Phone:</span> <a href="tel:${escapeHtml(applicant.phone)}" style="color:var(--cyan);">${escapeHtml(applicant.phone)}</a></div>
        <div><span style="color:var(--text-dim); display:block; font-size:0.8rem;">Experience:</span> <span style="color:#fff;">${escapeHtml(applicant.experience || 'Fresher')}</span></div>
        <div><span style="color:var(--text-dim); display:block; font-size:0.8rem;">Applied Date:</span> <span style="color:var(--text-muted);">${formatDate(applicant.created_at)}</span></div>
      </div>
      <div>
        <span style="color:var(--text-dim); display:block; font-size:0.8rem; margin-bottom:0.4rem;">Links & Credentials:</span>
        <div style="display:flex; gap:1rem; align-items:center;">
          ${applicant.portfolio_url ? `<a href="${escapeHtml(applicant.portfolio_url)}" target="_blank" class="btn btn-outline btn-sm"><i class="fas fa-globe"></i> View Portfolio</a>` : ''}
          ${applicant.resume_filepath ? `<a href="../${escapeHtml(applicant.resume_filepath)}" target="_blank" class="btn btn-primary btn-sm"><i class="fas fa-download"></i> Download Resume (${escapeHtml(applicant.resume_filename || 'CV')})</a>` : ''}
        </div>
      </div>
      <div>
        <span style="color:var(--text-dim); display:block; font-size:0.8rem; margin-bottom:0.5rem;">Cover Note / Key System Achievements:</span>
        <div style="background:#02040a; border:1px solid var(--border-admin); border-radius:var(--radius-sm); padding:1.25rem; color:#cbd5e1; line-height:1.7; white-space:pre-wrap;">${escapeHtml(applicant.message || 'No cover note submitted.')}</div>
      </div>
    </div>
  `;
  openAdminModal('detailsModal');
}

// =========================================================================
// 8. TAB 6: JOB POSTINGS CMS & STATIC SUBPAGE GENERATION
// =========================================================================
// =========================================================================
// 8A. TAB 6A: COURSE CREATION CMS
// =========================================================================
function initCoursesCMS() {
  const statusSelect = document.getElementById('filterCmsCourseStatus');
  const catSelect = document.getElementById('filterCmsCourseCategory');
  const searchInput = document.getElementById('searchCmsCourses');
  const addBtn = document.getElementById('btnOpenAddCourseModal');
  const saveBtn = document.getElementById('btnSaveCourse');

  if (statusSelect) statusSelect.addEventListener('change', fetchCoursesCMS);
  if (catSelect) catSelect.addEventListener('change', fetchCoursesCMS);
  if (searchInput) searchInput.addEventListener('input', debounce(fetchCoursesCMS, 300));

  if (addBtn) addBtn.addEventListener('click', () => openCourseModal(null));
  if (saveBtn) saveBtn.addEventListener('click', handleSaveCourse);
}

async function fetchCoursesCMS() {
  const status = document.getElementById('filterCmsCourseStatus')?.value || 'all';
  const category = document.getElementById('filterCmsCourseCategory')?.value || 'all';
  const search = document.getElementById('searchCmsCourses')?.value || '';
  const tbody = document.getElementById('coursesCmsTableBody');

  let list = [];

  if (!isDevStaticMode) {
    try {
      const res = await apiFetch(`../api/admin/courses.php?action=list_courses&status=${encodeURIComponent(status)}&category=${encodeURIComponent(category)}&search=${encodeURIComponent(search)}`, {
        headers: { 'Authorization': 'Bearer ' + authToken }
      });
      if (res.status === 405) {
        isDevStaticMode = true;
      } else {
        const result = await res.json().catch(() => null);
        if (result && result.success && result.data) {
          list = result.data.courses || [];
        }
      }
    } catch (e) {
      isDevStaticMode = true;
    }
  }

  if (isDevStaticMode) {
    let all = getLocalData('courses_catalog');
    if (all.length === 0) {
      try {
        const cRes = await fetch('../data/courses.json');
        const jsonCourses = await cRes.json();
        if (Array.isArray(jsonCourses)) {
          all = jsonCourses;
          saveLocalData('courses_catalog', all);
        }
      } catch (e) {}
    }

    list = all.filter(c => {
      const matchesStatus = (status === 'all' || (c.status || 'active') === status);
      const matchesCat = (category === 'all' || c.category === category);
      const haystack = (c.title + ' ' + (c.summary || '')).toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      return matchesStatus && matchesCat && matchesSearch;
    });
  }

  const badgeCount = document.getElementById('countBadgeCoursesCMS');
  if (badgeCount) badgeCount.textContent = list.length;

  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-dim);">No courses found. Click "+ Create New Course" to publish your first course.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr>
      <td>
        <div style="font-weight:700; color:#fff; font-size:0.95rem;">${escapeHtml(c.title)}</div>
        <div style="display:flex; gap:6px; margin-top:4px;">
          <span class="badge-pill badge-purple" style="font-size:0.75rem;">${escapeHtml(c.badge || 'Cohort')}</span>
          <span class="badge-pill" style="font-size:0.75rem;">${escapeHtml(c.seats_label || 'Seats Limited')}</span>
        </div>
      </td>
      <td>
        <span class="badge-pill" style="font-size:0.75rem;">${escapeHtml(c.category || 'programming')}</span>
      </td>
      <td>
        <div style="color:#fff; font-size:0.85rem;">${escapeHtml(c.duration || '1 Month')}</div>
        <div style="font-size:0.75rem; color:var(--text-dim); margin-top:2px;">${escapeHtml(c.mode || 'Live Online')}</div>
      </td>
      <td>
        <div style="color:var(--cyan); font-weight:700; font-size:0.95rem;">₹${Number(c.fee || 649).toLocaleString('en-IN')}</div>
        ${c.original_fee ? `<div style="font-size:0.75rem; color:var(--text-dim); text-decoration:line-through;">₹${Number(c.original_fee).toLocaleString('en-IN')}</div>` : ''}
      </td>
      <td>
        <span style="color:var(--cyan); font-weight:700; font-size:0.95rem;">${c.student_count || 0}</span> students
      </td>
      <td>
        <select class="admin-select" style="font-size:0.78rem; padding:0.25rem 0.5rem;" onchange="updateCourseStatus(${c.id}, this.value)">
          <option value="active" ${c.status === 'active' ? 'selected' : ''}>Active (Open)</option>
          <option value="upcoming" ${c.status === 'upcoming' ? 'selected' : ''}>Upcoming</option>
          <option value="closed" ${c.status === 'closed' ? 'selected' : ''}>Closed</option>
          <option value="draft" ${c.status === 'draft' ? 'selected' : ''}>Draft</option>
        </select>
      </td>
      <td style="text-align:right; white-space:nowrap;">
        <a href="../courses.html" target="_blank" class="btn-action-icon" title="View Public Courses Page">
          <i class="fas fa-eye"></i>
        </a>
        <button type="button" class="btn-action-icon" title="Edit Course Details" onclick='openCourseModal(${JSON.stringify(c).replace(/'/g, "&#39;")})'>
          <i class="fas fa-edit"></i>
        </button>
        <button type="button" class="btn-action-icon danger" title="Remove Course" onclick="deleteCourse(${c.id})">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function openCourseModal(course) {
  const form = document.getElementById('courseEditorForm');
  if (form) form.reset();

  const titleEl = document.getElementById('courseModalTitle');
  const idEl = document.getElementById('courseEditId');
  const slugEl = document.getElementById('courseEditSlug');

  if (course) {
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-edit" style="color:var(--cyan);"></i> Edit Course: ' + escapeHtml(course.title);
    if (idEl) idEl.value = course.id || 0;
    if (slugEl) slugEl.value = course.slug || '';

    document.getElementById('courseTitle').value = course.title || '';
    document.getElementById('courseCategory').value = course.category || 'programming';
    document.getElementById('courseBadge').value = course.badge || 'Live Online Cohort';
    document.getElementById('courseDuration').value = course.duration || '1 Month';
    document.getElementById('courseMode').value = course.mode || 'Live Online';
    document.getElementById('courseStatus').value = course.status || 'active';
    document.getElementById('courseFee').value = course.fee || 649;
    document.getElementById('courseOriginalFee').value = course.original_fee || 24999;
    document.getElementById('courseSeatsLabel').value = course.seats_label || 'Seats Limited';
    document.getElementById('courseMentor').value = course.mentor_name || 'VYOMANTRA Technical Lead';
    document.getElementById('courseSummary').value = course.summary || '';
    document.getElementById('courseSyllabus').value = Array.isArray(course.syllabus) ? course.syllabus.join('\n') : (course.syllabus || '');
    document.getElementById('courseWhatsApp').value = course.whatsapp_phone || '918122288855';
  } else {
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-graduation-cap" style="color:var(--cyan);"></i> Create &amp; Publish Technical Course';
    if (idEl) idEl.value = 0;
    if (slugEl) slugEl.value = '';
    document.getElementById('courseFee').value = '649';
    document.getElementById('courseOriginalFee').value = '24999';
    document.getElementById('courseBadge').value = 'Live Online Cohort';
    document.getElementById('courseDuration').value = '1 Month';
    document.getElementById('courseSeatsLabel').value = 'Special Inaugural Pass';
    document.getElementById('courseWhatsApp').value = '918122288855';
  }

  openAdminModal('courseEditorModal');
}

async function handleSaveCourse() {
  const form = document.getElementById('courseEditorForm');
  const title = document.getElementById('courseTitle').value.trim();
  const summary = document.getElementById('courseSummary').value.trim();
  const fee = document.getElementById('courseFee').value.trim();

  if (!title || !summary || !fee) {
    alert('Please provide Course Title, Fee, and Summary.');
    return;
  }

  const saveBtn = document.getElementById('btnSaveCourse');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving Course...';

  const formData = new FormData(form);
  formData.append('action', 'save_course');

  const id = Number(document.getElementById('courseEditId').value || 0);
  const slug = document.getElementById('courseEditSlug').value || (title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));

  if (isDevStaticMode) {
    let all = getLocalData('courses_catalog');
    const courseObj = {
      id: id || Date.now(),
      slug: slug,
      title: title,
      badge: document.getElementById('courseBadge').value || 'Live Online Cohort',
      category: document.getElementById('courseCategory').value || 'programming',
      duration: document.getElementById('courseDuration').value || '1 Month',
      mode: document.getElementById('courseMode').value || 'Live Online',
      fee: Number(fee),
      original_fee: Number(document.getElementById('courseOriginalFee').value || 24999),
      seats_label: document.getElementById('courseSeatsLabel').value || 'Seats Limited',
      summary: summary,
      syllabus: document.getElementById('courseSyllabus').value.split('\n').map(s => s.trim()).filter(Boolean),
      mentor_name: document.getElementById('courseMentor').value || 'VYOMANTRA Technical Lead',
      whatsapp_phone: document.getElementById('courseWhatsApp').value || '918122288855',
      status: document.getElementById('courseStatus').value || 'active',
      student_count: 0
    };

    if (id > 0) {
      const idx = all.findIndex(c => c.id === id);
      if (idx !== -1) all[idx] = { ...all[idx], ...courseObj };
      else all.unshift(courseObj);
    } else {
      all.unshift(courseObj);
    }
    saveLocalData('courses_catalog', all);
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save &amp; Publish Course';
    closeAdminModal('courseEditorModal');
    showToast('Course published successfully!');
    fetchCoursesCMS();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/courses.php', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + authToken },
      body: formData
    });
    const result = await res.json();
    if (result && result.success) {
      showToast('Course published successfully!');
      closeAdminModal('courseEditorModal');
      fetchCoursesCMS();
    } else {
      alert(result?.message || 'Failed to save course.');
    }
  } catch (err) {
    alert('Server error saving course. Check network or permissions.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save &amp; Publish Course';
  }
}

async function deleteCourse(id) {
  if (!confirm(`Are you sure you want to delete course #${id}?`)) return;

  if (isDevStaticMode) {
    let all = getLocalData('courses_catalog');
    all = all.filter(c => c.id !== id);
    saveLocalData('courses_catalog', all);
    showToast(`Course #${id} removed.`);
    fetchCoursesCMS();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/courses.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + authToken
      },
      body: `action=delete_course&id=${id}`
    });
    const result = await res.json();
    if (result && result.success) {
      showToast(result.message || 'Course deleted.');
      fetchCoursesCMS();
    } else {
      alert(result?.message || 'Failed to delete course.');
    }
  } catch (e) {
    alert('Error connecting to courses endpoint.');
  }
}

async function updateCourseStatus(id, newStatus) {
  if (isDevStaticMode) {
    let all = getLocalData('courses_catalog');
    const item = all.find(c => c.id === id);
    if (item) item.status = newStatus;
    saveLocalData('courses_catalog', all);
    showToast(`Course #${id} status changed to ${newStatus}.`);
    return;
  }

  try {
    await apiFetch('../api/admin/courses.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + authToken
      },
      body: `action=toggle_course_status&id=${id}&status=${encodeURIComponent(newStatus)}`
    });
    showToast(`Course #${id} status updated to ${newStatus}.`);
  } catch (e) {
    alert('Failed to update course status.');
  }
}

function initJobsCMS() {
  const statusSelect = document.getElementById('filterJobStatus');
  const catSelect = document.getElementById('filterJobCategory');
  const searchInput = document.getElementById('searchJobs');
  const addBtn = document.getElementById('btnOpenAddJobModal');
  const saveBtn = document.getElementById('btnSaveJob');

  if (statusSelect) statusSelect.addEventListener('change', fetchJobs);
  if (catSelect) catSelect.addEventListener('change', fetchJobs);
  if (searchInput) searchInput.addEventListener('input', debounce(fetchJobs, 300));

  if (addBtn) addBtn.addEventListener('click', () => openJobModal(null));
  if (saveBtn) saveBtn.addEventListener('click', handleSaveJob);
}

async function fetchJobs() {
  const status = document.getElementById('filterJobStatus')?.value || 'all';
  const category = document.getElementById('filterJobCategory')?.value || 'all';
  const search = document.getElementById('searchJobs')?.value || '';
  const tbody = document.getElementById('jobsTableBody');

  let list = [];

  if (!isDevStaticMode) {
    try {
      const res = await apiFetch(`../api/admin/jobs.php?action=list&status=${encodeURIComponent(status)}&category=${encodeURIComponent(category)}&search=${encodeURIComponent(search)}`, {
        headers: { 'Authorization': 'Bearer ' + authToken }
      });
      if (res.status === 405) {
        isDevStaticMode = true;
      } else {
        const result = await res.json().catch(() => null);
        if (result && result.success && result.data) {
          list = result.data.jobs || [];
        }
      }
    } catch (e) {
      isDevStaticMode = true;
    }
  }

  if (isDevStaticMode) {
    // Try to read fresh data from ../data/jobs.json (GET works on Live Server!)
    let all = getLocalData('jobs');
    if (all.length === 0) {
      try {
        const jRes = await fetch('../data/jobs.json');
        const jsonJobs = await jRes.json();
        if (Array.isArray(jsonJobs)) {
          all = jsonJobs;
          saveLocalData('jobs', all);
        }
      } catch (e) {}
    }

    list = all.filter(j => {
      const matchesStatus = (status === 'all' || (j.status || 'active') === status);
      const matchesCat = (category === 'all' || j.category === category);
      const haystack = (j.title + ' ' + (j.summary || '')).toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      return matchesStatus && matchesCat && matchesSearch;
    });
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:3rem; color:var(--text-dim);">No job postings found matching filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(j => `
    <tr>
      <td style="color:var(--text-dim); font-size:0.82rem; white-space:nowrap;">
        ${j.date_posted || 'Recently'}
      </td>
      <td>
        <a href="../careers/${j.slug}.html" target="_blank" style="color:#fff; font-weight:700; text-decoration:none; display:flex; align-items:center; gap:6px;">
          ${escapeHtml(j.title)} <i class="fas fa-external-link-alt" style="font-size:0.75rem; color:var(--cyan);"></i>
        </a>
        <span style="font-family:var(--font-mono); color:var(--text-dim); font-size:0.78rem;">careers/${escapeHtml(j.slug)}.html</span>
      </td>
      <td>
        <span class="badge-pill badge-purple" style="font-size:0.75rem;">${escapeHtml(j.department_label || j.category)}</span>
      </td>
      <td>
        <span class="badge-pill" style="font-size:0.75rem;">${escapeHtml(j.job_type)}</span>
        <div style="font-size:0.75rem; color:var(--text-dim); margin-top:2px;">${escapeHtml(j.work_mode)}</div>
      </td>
      <td style="color:var(--text-muted); font-size:0.85rem;">
        ${escapeHtml(j.experience_text || j.experience_level)}
      </td>
      <td>
        <span style="color:var(--cyan); font-weight:700; font-size:0.95rem;">${j.applicant_count || 0}</span> candidates
      </td>
      <td>
        <select class="admin-select" style="font-size:0.78rem; padding:0.25rem 0.5rem;" onchange="updateJobStatus(${j.id}, '${j.slug}', this.value)">
          <option value="active" ${j.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="reviewing" ${j.status === 'reviewing' ? 'selected' : ''}>Reviewing</option>
          <option value="closed" ${j.status === 'closed' ? 'selected' : ''}>Closed</option>
          <option value="draft" ${j.status === 'draft' ? 'selected' : ''}>Draft</option>
        </select>
      </td>
      <td style="text-align:right; white-space:nowrap;">
        <a href="../careers/${j.slug}.html" target="_blank" class="btn-action-icon" title="View Public Subpage">
          <i class="fas fa-eye"></i>
        </a>
        <button type="button" class="btn-action-icon" title="Edit Role Details" onclick="openJobModal(${JSON.stringify(j).replace(/"/g, '&quot;')})">
          <i class="fas fa-edit"></i>
        </button>
        <button type="button" class="btn-action-icon danger" title="Remove Job" onclick="deleteJob(${j.id}, '${j.slug}')">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function openJobModal(job) {
  const form = document.getElementById('jobEditorForm');
  form.reset();

  const titleEl = document.getElementById('jobModalTitle');
  const idEl = document.getElementById('jobEditId');

  if (job) {
    titleEl.innerHTML = '<i class="fas fa-edit" style="color:var(--cyan);"></i> Edit Opening: ' + escapeHtml(job.title);
    idEl.value = job.id || 0;

    document.getElementById('jobTitle').value = job.title || '';
    document.getElementById('jobCategory').value = job.category || 'engineering';
    document.getElementById('jobType').value = job.job_type || 'fulltime';
    document.getElementById('jobMode').value = job.work_mode || 'hybrid';
    document.getElementById('jobExpLevel').value = job.experience_level || 'experienced';
    document.getElementById('jobStatus').value = job.status || 'active';
    document.getElementById('jobExpText').value = job.experience_text || '';
    document.getElementById('jobLocationText').value = job.location_text || '';
    document.getElementById('jobCompensationText').value = job.compensation_text || '';
    document.getElementById('jobDatePosted').value = job.date_posted || new Date().toISOString().split('T')[0];
    document.getElementById('jobSummary').value = job.summary || '';
    document.getElementById('jobAboutRole').value = job.about_role || '';
    document.getElementById('jobResponsibilities').value = Array.isArray(job.responsibilities) ? job.responsibilities.join('\n') : (job.responsibilities || '');
    document.getElementById('jobQualifications').value = job.qualifications || '';
    document.getElementById('jobCompetencies').value = Array.isArray(job.competencies) ? job.competencies.join('\n') : (job.competencies || '');
    document.getElementById('jobTechStack').value = Array.isArray(job.tech_stack) ? job.tech_stack.join(', ') : (job.tech_stack || '');
  } else {
    titleEl.innerHTML = '<i class="fas fa-plus-circle" style="color:var(--cyan);"></i> Post New Role Opening';
    idEl.value = 0;
    document.getElementById('jobDatePosted').value = new Date().toISOString().split('T')[0];
    document.getElementById('jobLocationText').value = 'Dharmapuri, TN / Hybrid';
    document.getElementById('jobCompensationText').value = 'Competitive CTC';
    document.getElementById('jobExpText').value = '1 – 3+ Years Experience';
  }

  openAdminModal('jobEditorModal');
}

async function handleSaveJob() {
  const form = document.getElementById('jobEditorForm');
  const title = document.getElementById('jobTitle').value.trim();
  const summary = document.getElementById('jobSummary').value.trim();

  if (!title || !summary) {
    alert('Please provide Job Title and Short Summary.');
    return;
  }

  const saveBtn = document.getElementById('btnSaveJob');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving Opening...';

  const formData = new FormData(form);
  formData.append('action', 'save');

  const id = Number(document.getElementById('jobEditId').value || 0);
  const slug = (document.getElementById('jobTitle').value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));

  if (isDevStaticMode) {
    let all = getLocalData('jobs');
    const newJobObj = {
      id: id || Date.now(),
      slug: slug,
      title: title,
      category: document.getElementById('jobCategory').value,
      department_label: document.getElementById('jobCategory').options[document.getElementById('jobCategory').selectedIndex].text,
      job_type: document.getElementById('jobType').value,
      work_mode: document.getElementById('jobMode').value,
      experience_level: document.getElementById('jobExpLevel').value,
      experience_text: document.getElementById('jobExpText').value || '1 - 3+ Years',
      location_text: document.getElementById('jobLocationText').value || 'Dharmapuri, TN / Hybrid',
      compensation_text: document.getElementById('jobCompensationText').value || 'Competitive CTC',
      date_posted: document.getElementById('jobDatePosted').value || new Date().toISOString().split('T')[0],
      summary: summary,
      about_role: document.getElementById('jobAboutRole').value,
      responsibilities: document.getElementById('jobResponsibilities').value.split('\n').filter(Boolean),
      qualifications: document.getElementById('jobQualifications').value,
      competencies: document.getElementById('jobCompetencies').value.split('\n').filter(Boolean),
      tech_stack: document.getElementById('jobTechStack').value.split(',').map(s => s.trim()).filter(Boolean),
      status: document.getElementById('jobStatus').value || 'active',
      subpage_url: `careers/${slug}.html`,
      applicant_count: 0
    };

    const exIdx = all.findIndex(j => j.id == id || j.slug == slug);
    if (exIdx >= 0) all[exIdx] = newJobObj;
    else all.unshift(newJobObj);

    saveLocalData('jobs', all);

    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save &amp; Publish Subpage';
    showToast(id ? 'Job opening updated' : 'New role posted successfully!');
    closeAdminModal('jobEditorModal');
    fetchJobs();
    fetchDashboardStats();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/jobs.php', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + authToken },
      body: formData
    });
    const result = await res.json().catch(() => null);

    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save &amp; Publish Subpage';

    if (result && result.success) {
      showToast(result.message || 'Job published successfully!');
      closeAdminModal('jobEditorModal');
      fetchJobs();
      fetchDashboardStats();
    } else {
      alert((result && result.message) ? result.message : 'Failed to save job opening.');
    }
  } catch (err) {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save &amp; Publish Subpage';
    showToast('Job saved to local database');
    closeAdminModal('jobEditorModal');
    fetchJobs();
  }
}

async function updateJobStatus(id, slug, newStatus) {
  if (isDevStaticMode) {
    let all = getLocalData('jobs');
    all.forEach(j => { if (j.id == id || j.slug == slug) j.status = newStatus; });
    saveLocalData('jobs', all);
    showToast(`Job status changed to ${newStatus}`);
    fetchDashboardStats();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/jobs.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + authToken
      },
      body: `action=update_status&id=${id}&slug=${encodeURIComponent(slug)}&status=${encodeURIComponent(newStatus)}`
    });
    const result = await res.json();
    if (result && result.success) {
      showToast(result.message);
      fetchDashboardStats();
    }
  } catch (e) {
    showToast('Failed to update job status', true);
  }
}

async function deleteJob(id, slug) {
  if (!confirm(`Are you sure you want to remove job opening "${slug}"?`)) return;

  if (isDevStaticMode) {
    let all = getLocalData('jobs').filter(j => !(j.id == id || j.slug == slug));
    saveLocalData('jobs', all);
    showToast('Opening removed successfully');
    fetchJobs();
    fetchDashboardStats();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/jobs.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + authToken
      },
      body: `action=delete&id=${id}&slug=${encodeURIComponent(slug)}`
    });
    const result = await res.json();
    if (result && result.success) {
      showToast('Opening removed successfully');
      fetchJobs();
      fetchDashboardStats();
    }
  } catch (e) {
    showToast('Failed to delete opening', true);
  }
}

// =========================================================================
// 9. LOCAL DATA STORAGE ENGINE (FOR STATIC LIVE SERVER PORT 5500)
// =========================================================================
function initLocalSeedData() {
  // Clear any existing demo contacts, quotes, course registrations, applicants, and demo jobs
  // while strictly keeping authentic certificates data.
  localStorage.setItem('vyomantra_admin_contacts', JSON.stringify([]));
  localStorage.setItem('vyomantra_admin_quotes', JSON.stringify([]));
  localStorage.setItem('vyomantra_admin_courses', JSON.stringify([]));
  localStorage.setItem('vyomantra_admin_applicants', JSON.stringify([]));
  localStorage.setItem('vyomantra_admin_jobs', JSON.stringify([]));
  localStorage.setItem('vyomantra_admin_courses_catalog', JSON.stringify([]));

  // Pre-load certificates from ../data/certificates.json if not present
  if (!localStorage.getItem('vyomantra_admin_certificates')) {
    fetch('../data/certificates.json')
      .then(res => res.json())
      .then(certs => {
        if (Array.isArray(certs) && certs.length > 0) {
          saveLocalData('certificates', certs);
        }
      })
      .catch(() => {});
  }

  // Pre-load certificate logs from ../data/certificate_logs.json if not present
  if (!localStorage.getItem('vyomantra_admin_certificate_logs')) {
    fetch('../data/certificate_logs.json')
      .then(res => res.json())
      .then(logs => {
        if (Array.isArray(logs) && logs.length > 0) {
          saveLocalData('certificate_logs', logs);
        }
      })
      .catch(() => {});
  }
}

function getLocalData(key) {
  try {
    return JSON.parse(localStorage.getItem('vyomantra_admin_' + key) || '[]');
  } catch (e) {
    return [];
  }
}

function saveLocalData(key, data) {
  try {
    localStorage.setItem('vyomantra_admin_' + key, JSON.stringify(data));
  } catch (e) {}
}

// =========================================================================
// 10. MODALS & UTILITIES
// =========================================================================
function openAdminModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeAdminModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

let toastTimer = null;
function showToast(message, isError = false) {
  const toast = document.getElementById('adminToast');
  const msgEl = document.getElementById('adminToastMsg');
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.style.borderColor = isError ? 'var(--red)' : 'var(--cyan)';

  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function cleanPhoneForWa(phoneStr) {
  if (!phoneStr) return '918122288855';
  let cleaned = phoneStr.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  return cleaned;
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'new': return 'badge-new';
    case 'contacted': return 'badge-contacted';
    case 'resolved':
    case 'verified':
    case 'valid':
    case 'active':
    case 'offered': return 'badge-verified';
    case 'pending_verification':
    case 'reviewing': return 'badge-pending';
    case 'expired': return 'badge-expired';
    case 'rejected':
    case 'closed':
    case 'revoked': return 'badge-rejected';
    case 'draft': return 'badge-draft';
    default: return 'badge-new';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// =========================================================================
// 11. TAB 7: CREDENTIAL & CERTIFICATE AUTHORITY ENGINE
// =========================================================================
let certCurrentPage = 0;
const CERTS_PAGE_SIZE = 25;
let certPreviewCurrent = null;
let certRevokeTargetId = null;

function initCertificatesManager() {
  const statusFilter = document.getElementById('filterCertStatus');
  const typeFilter   = document.getElementById('filterCertType');
  const sortSelect   = document.getElementById('sortCerts');
  const searchInput  = document.getElementById('searchCerts');

  if (statusFilter) statusFilter.addEventListener('change', () => { certCurrentPage = 0; fetchCertificates(); });
  if (typeFilter)   typeFilter.addEventListener('change', () => { certCurrentPage = 0; fetchCertificates(); });
  if (sortSelect)   sortSelect.addEventListener('change', () => { certCurrentPage = 0; fetchCertificates(); });
  if (searchInput)  searchInput.addEventListener('input', debounce(() => { certCurrentPage = 0; fetchCertificates(); }, 300));

  // Pagination buttons
  const prevBtn = document.getElementById('btnPrevCertPage');
  const nextBtn = document.getElementById('btnNextCertPage');
  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (certCurrentPage > 0) {
      certCurrentPage--;
      fetchCertificates();
    }
  });
  if (nextBtn) nextBtn.addEventListener('click', () => {
    certCurrentPage++;
    fetchCertificates();
  });

  // Form Save
  const saveBtn = document.getElementById('btnSaveCertificate');
  if (saveBtn) saveBtn.addEventListener('click', saveCertificate);

  // Dynamic live ID preview on prefix / date change
  const prefixSelect = document.getElementById('certPrefix');
  const issueDateInput = document.getElementById('certIssueDate');
  if (prefixSelect) prefixSelect.addEventListener('change', updateLiveCertIdPreview);
  if (issueDateInput) issueDateInput.addEventListener('change', updateLiveCertIdPreview);

  // Revocation Confirm
  const revokeBtn = document.getElementById('btnConfirmRevocation');
  if (revokeBtn) revokeBtn.addEventListener('click', confirmCertificateRevocation);

  // Bulk Import Submit
  const executeBulkBtn = document.getElementById('btnExecuteBulkImport');
  if (executeBulkBtn) executeBulkBtn.addEventListener('click', executeBulkImport);

  // Initialize Configurator modal event listeners
  initConfiguratorEvents();
}

async function handleCertificateAction(event) {
  const button = event.target.closest('[data-cert-action]');
  if (!button) return;

  const id = button.dataset.certId;
  try {
    switch (button.dataset.certAction) {
      case 'create': openCertificateCreateModal(); break;
      case 'configurator': await openCertificateConfiguratorModal(); break;
      case 'bulk': openAdminModal('certificateBulkModal'); break;
      case 'export': exportCertificatesCsv(); break;
      case 'copy-id': await adminCopyCertId(id); break;
      case 'preview': await openCertificatePreview(id); break;
      case 'docx': await downloadCertificateDocx(id, button.dataset.certMode || 'digital'); break;
      case 'pdf': await adminDownloadCertPdf(id); break;
      case 'edit': await openCertificateEditModal(id); break;
      case 'revoke': openCertificateRevokeModal(id); break;
      case 'restore': await restoreCertificate(id); break;
      case 'delete': await deleteCertificate(id); break;
      default: return;
    }
  } catch (error) {
    console.error('Certificate action failed:', error);
    showToast('That certificate action failed. Check the browser console for details.', true);
  }
}

function updateLiveCertIdPreview() {
  const prefix = document.getElementById('certPrefix')?.value || 'VYOM-CRT';
  const issueDate = document.getElementById('certIssueDate')?.value || new Date().toISOString();
  const year = new Date(issueDate).getFullYear() || 2026;
  const editId = document.getElementById('certEditId')?.value;
  const actualId = document.getElementById('certEditActualId')?.value;

  const previewEl = document.getElementById('liveGeneratedIdPreview');
  if (!previewEl) return;

  if (editId && editId !== '0' && actualId) {
    previewEl.textContent = actualId;
  } else {
    previewEl.textContent = `${prefix}-${year}-XXXXX (Auto-sequenced)`;
  }
}

async function fetchCertificates() {
  const tbody = document.getElementById('certificatesTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-dim);"><i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i> Loading credential registry...</td></tr>';

  const status = document.getElementById('filterCertStatus')?.value || 'all';
  const type   = document.getElementById('filterCertType')?.value || 'all';
  const sort   = document.getElementById('sortCerts')?.value || 'newest';
  const search = document.getElementById('searchCerts')?.value.trim() || '';

  const offset = certCurrentPage * CERTS_PAGE_SIZE;

  if (isDevStaticMode) {
    let all = getLocalData('certificates');
    if (!all || all.length === 0) {
      all = JSON.parse(localStorage.getItem('vyomantra_certificates') || '[]');
    }

    if (!all || all.length === 0) {
      try {
        const resp = await fetch('../data/certificates.json');
        if (resp.ok) {
          all = await resp.json();
          saveLocalData('certificates', all);
        }
      } catch (e) {
        console.warn('Could not auto-seed certificates from json', e);
      }
    }

    // Filter
    let filtered = all.filter(c => {
      if (status !== 'all' && (c.status || 'valid') !== status) return false;
      if (type !== 'all' && (c.certificate_type || '') !== type) return false;
      if (search) {
        const needle = search.toLowerCase();
        const haystack = `${c.certificate_id} ${c.recipient_name} ${c.recipient_email} ${c.course_name}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      if (sort === 'oldest') return (a.created_at || '').localeCompare(b.created_at || '');
      if (sort === 'name') return (a.recipient_name || '').localeCompare(b.recipient_name || '');
      if (sort === 'id') return (b.certificate_id || '').localeCompare(a.certificate_id || '');
      return (b.created_at || '').localeCompare(a.created_at || '');
    });

    const pageSlice = filtered.slice(offset, offset + CERTS_PAGE_SIZE);
    renderCertificatesTable(pageSlice, filtered.length);
    updateCertPagination(filtered.length);
    return;
  }

  try {
    const params = new URLSearchParams({
      action: 'list',
      status,
      type,
      sort,
      search,
      limit: CERTS_PAGE_SIZE,
      offset
    });

    const res = await apiFetch(`../api/admin/certificates.php?${params.toString()}`);

    if (res.status === 405 || (isDevStaticMode && !res.ok)) {
      renderLocalCertificates();
      return;
    }

    const result = await res.json();
    if (result && result.success && result.data) {
      const list = result.data.certificates || [];
      const total = result.data.total || 0;
      renderCertificatesTable(list, total);
      updateCertPagination(total);

      if (result.data.counts) {
        const badge = document.getElementById('countBadgeCertificates');
        if (badge) badge.textContent = result.data.counts.total || 0;
      }
    } else {
      renderCertificatesTable([], 0);
    }
  } catch (err) {
    isDevStaticMode = true;
    fetchCertificates();
  }
}

function renderCertificatesTable(certs, totalCount) {
  const tbody = document.getElementById('certificatesTableBody');
  if (!tbody) return;

  if (!certs || certs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 3.5rem 1rem; color: var(--text-dim);">
          <i class="fas fa-certificate" style="font-size: 2.2rem; margin-bottom: 0.75rem; display: block; opacity: 0.35;"></i>
          No certificates matching current filters. Click "Issue New Certificate" to create one.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = certs.map(c => {
    const status = (c.status || 'valid').toLowerCase();
    let badgeClass = 'badge-valid';
    let statusLabel = 'VALID';
    if (status === 'revoked') { badgeClass = 'badge-rejected'; statusLabel = 'REVOKED'; }
    else if (status === 'expired') { badgeClass = 'badge-pending'; statusLabel = 'EXPIRED'; }
    else if (status === 'draft') { badgeClass = 'badge-draft'; statusLabel = 'DRAFT'; }

    const formattedDate = formatDate(c.issue_date);
    const siteOrigin = window.location.origin;
    const vUrl = c.verification_url || `${siteOrigin}/verify/?id=${encodeURIComponent(c.certificate_id)}`;

    return `
      <tr>
        <td class="cert-cell-id">
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong class="cert-id-badge">${escapeHtml(c.certificate_id)}</strong>
            <button type="button" class="btn-action-icon" style="padding:2px 6px; font-size:0.75rem;" data-cert-action="copy-id" data-cert-id="${escapeHtml(c.certificate_id)}" title="Copy Certificate ID">
              <i class="fas fa-copy"></i>
            </button>
          </div>
          <span style="font-size:0.72rem; color:var(--text-dim); display:block; margin-top:2px; font-family:'JetBrains Mono',monospace;">Token: ${escapeHtml((c.verification_token || '').substring(0, 10))}...</span>
        </td>
        <td>
          <div style="font-weight:700; color:#fff; font-size:0.95rem;">${escapeHtml(c.recipient_name)}</div>
          <div style="font-size:0.78rem; color:var(--text-muted);">${escapeHtml(c.recipient_email || 'No email specified')}</div>
        </td>
        <td>
          <span style="font-size:0.74rem; font-weight:700; text-transform:uppercase; color:#e5b85a; letter-spacing:0.04em;">${escapeHtml(c.certificate_type || 'Course Completion')}</span>
          <div style="font-size:0.85rem; color:#cbd5e1; font-weight:500;">${escapeHtml(c.course_name)}</div>
          <span style="font-size:0.72rem; color:var(--text-dim);">${escapeHtml(c.course_duration || '3 Months')}</span>
        </td>
        <td>
          <div style="font-size:0.88rem; color:#fff;">${formattedDate}</div>
          ${c.completion_date ? `<span style="font-size:0.72rem; color:var(--text-dim);">Completed: ${formatDate(c.completion_date)}</span>` : ''}
        </td>
        <td>
          <span class="status-badge ${badgeClass}">${statusLabel}</span>
          ${status === 'revoked' && c.revocation_reason ? `<div style="font-size:0.72rem; color:#ef4444; margin-top:4px; max-width:140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(c.revocation_reason)}">${escapeHtml(c.revocation_reason)}</div>` : ''}
        </td>
        <td style="text-align: center;">
          <button type="button" class="btn-action-icon" style="padding:6px 8px;" data-cert-action="preview" data-cert-id="${escapeHtml(c.certificate_id)}" title="Preview Certificate &amp; QR">
            <i class="fas fa-qrcode" style="color:var(--cyan); font-size:1.1rem;"></i>
          </button>
        </td>
        <td class="cert-cell-actions">
          <button type="button" class="btn btn-outline btn-sm btn-docx-partial" style="padding:0.32rem 0.55rem; font-size:0.75rem; margin-right:3px;" data-cert-action="docx" data-cert-mode="partial" data-cert-id="${escapeHtml(c.certificate_id)}" title="Download DOCX with QR, ID & Course (Leaves Recipient Name and Founder Signature blank for manual pen signing)">
            <i class="fas fa-file-word"></i> DOCX (Manual)
          </button>
          <button type="button" class="btn btn-outline btn-sm btn-docx-digital" style="padding:0.32rem 0.55rem; font-size:0.75rem; margin-right:3px;" data-cert-action="docx" data-cert-mode="digital" data-cert-id="${escapeHtml(c.certificate_id)}" title="Download 100% Complete Digital DOCX with all details and signatures">
            <i class="fas fa-file-word"></i> DOCX (Digital)
          </button>
          <button type="button" class="btn btn-outline btn-sm" style="padding:0.32rem 0.55rem; font-size:0.75rem; margin-right:3px;" data-cert-action="preview" data-cert-id="${escapeHtml(c.certificate_id)}" title="Preview Official Certificate">
            <i class="fas fa-eye"></i> View
          </button>
          <button type="button" class="btn btn-outline btn-sm" style="padding:0.32rem 0.55rem; font-size:0.75rem; margin-right:3px;" data-cert-action="pdf" data-cert-id="${escapeHtml(c.certificate_id)}" title="Download PDF Certificate">
            <i class="fas fa-file-pdf"></i> PDF
          </button>
          <button type="button" class="btn-action-icon" style="margin-right:2px;" data-cert-action="edit" data-cert-id="${escapeHtml(c.certificate_id)}" title="Edit Certificate">
            <i class="fas fa-edit"></i>
          </button>
          ${status === 'revoked' ? `
            <button type="button" class="btn-action-icon" style="color:var(--green); margin-right:2px;" data-cert-action="restore" data-cert-id="${escapeHtml(c.certificate_id)}" title="Restore to Valid">
              <i class="fas fa-undo"></i>
            </button>
          ` : `
            <button type="button" class="btn-action-icon danger" style="margin-right:2px;" data-cert-action="revoke" data-cert-id="${escapeHtml(c.certificate_id)}" title="Revoke Certificate">
              <i class="fas fa-ban"></i>
            </button>
          `}
          <button type="button" class="btn-action-icon danger" data-cert-action="delete" data-cert-id="${escapeHtml(c.certificate_id)}" title="Delete Certificate">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      </tr>`;
  }).join('');
}

function updateCertPagination(total) {
  const summaryEl = document.getElementById('certsPaginationSummary');
  const prevBtn = document.getElementById('btnPrevCertPage');
  const nextBtn = document.getElementById('btnNextCertPage');

  const start = total === 0 ? 0 : certCurrentPage * CERTS_PAGE_SIZE + 1;
  const end = Math.min((certCurrentPage + 1) * CERTS_PAGE_SIZE, total);

  if (summaryEl) summaryEl.textContent = `Showing ${start} to ${end} of ${total} certificates`;
  if (prevBtn) prevBtn.disabled = (certCurrentPage === 0);
  if (nextBtn) nextBtn.disabled = (end >= total);
}

// -------------------------------------------------------------
// CREATE & EDIT MODAL
// -------------------------------------------------------------
function openCertificateCreateModal() {
  document.getElementById('certificateEditorForm').reset();
  document.getElementById('certEditId').value = '0';
  document.getElementById('certEditActualId').value = '';
  document.getElementById('certModalTitle').innerHTML = '<i class="fas fa-certificate" style="color: var(--cyan);"></i> Issue New Certificate';

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('certIssueDate').value = today;
  document.getElementById('certCompletionDate').value = today;
  document.getElementById('certTrainerName').value = 'Santhosh S';
  document.getElementById('certTrainerDesignation').value = 'Lead Technical Instructor';
  document.getElementById('certSignatoryName').value = 'S.B. Sachin';
  document.getElementById('certSignatoryDesignation').value = 'Founder & CEO';
  document.getElementById('certStatus').value = 'valid';

  updateLiveCertIdPreview();
  openAdminModal('certificateEditorModal');
}

async function openCertificateEditModal(id) {
  let cert = null;
  if (!isDevStaticMode) {
    try {
      const res = await apiFetch(`../api/admin/certificates.php?action=get&id=${encodeURIComponent(id)}`, {
        headers: { 'Authorization': 'Bearer ' + authToken }
      });
      const result = await res.json();
      if (result && result.success && result.data) {
        cert = result.data.certificate;
      }
    } catch (e) {}
  }

  if (!cert) {
    const all = getLocalData('certificates');
    cert = all.find(c => c.id == id || c.certificate_id === id);
  }

  if (!cert) {
    showToast('Certificate record not found', true);
    return;
  }

  document.getElementById('certEditId').value = cert.id || '1';
  document.getElementById('certEditActualId').value = cert.certificate_id;
  document.getElementById('certModalTitle').innerHTML = `<i class="fas fa-edit" style="color: var(--cyan);"></i> Edit Certificate: ${escapeHtml(cert.certificate_id)}`;

  document.getElementById('certType').value = cert.certificate_type || 'Course Completion';
  document.getElementById('certPrefix').value = cert.prefix || 'VYOM-CRT';
  document.getElementById('certRecipientName').value = cert.recipient_name || '';
  document.getElementById('certRecipientEmail').value = cert.recipient_email || '';
  document.getElementById('certCourseName').value = cert.course_name || '';
  document.getElementById('certCourseDuration').value = cert.course_duration || '3 Months';
  document.getElementById('certIssueDate').value = cert.issue_date || '';
  document.getElementById('certCompletionDate').value = cert.completion_date || '';
  document.getElementById('certExpiryDate').value = cert.expiry_date || '';
  document.getElementById('certTrainerName').value = cert.trainer_name || 'Santhosh S';
  document.getElementById('certTrainerDesignation').value = cert.trainer_designation || 'Lead Technical Instructor';
  document.getElementById('certSignatoryName').value = cert.signatory_name || 'S.B. Sachin';
  document.getElementById('certSignatoryDesignation').value = cert.signatory_designation || 'Founder & CEO';
  document.getElementById('certStatus').value = cert.status || 'valid';
  document.getElementById('certDescription').value = cert.description || '';
  document.getElementById('certPrivateNotes').value = cert.private_notes || '';

  updateLiveCertIdPreview();
  openAdminModal('certificateEditorModal');
}

async function saveCertificate() {
  const form = document.getElementById('certificateEditorForm');
  const recipientName = document.getElementById('certRecipientName').value.trim();
  const courseName = document.getElementById('certCourseName').value.trim();

  if (!recipientName || !courseName) {
    showToast('Please provide Recipient Full Name and Course/Program Name', true);
    return;
  }

  const formData = new FormData(form);
  const editId = document.getElementById('certEditId').value;
  const isEdit = (editId && editId !== '0');
  formData.append('action', isEdit ? 'update' : 'create');

  if (isDevStaticMode) {
    let all = getLocalData('certificates');
    if (isEdit) {
      const idx = all.findIndex(c => c.id == editId || c.certificate_id === document.getElementById('certEditActualId').value);
      if (idx !== -1) {
        all[idx] = {
          ...all[idx],
          certificate_type: formData.get('certificate_type'),
          recipient_name: formData.get('recipient_name'),
          recipient_email: formData.get('recipient_email'),
          course_name: formData.get('course_name'),
          course_duration: formData.get('course_duration'),
          issue_date: formData.get('issue_date'),
          completion_date: formData.get('completion_date'),
          expiry_date: formData.get('expiry_date') || null,
          trainer_name: formData.get('trainer_name'),
          trainer_designation: formData.get('trainer_designation'),
          signatory_name: formData.get('signatory_name'),
          signatory_designation: formData.get('signatory_designation'),
          description: formData.get('description'),
          private_notes: formData.get('private_notes'),
          status: formData.get('status') || 'valid',
          updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
        };
      }
      showToast('Certificate updated successfully');
    } else {
      const prefix = formData.get('prefix') || 'VYOM-CRT';
      const year = new Date(formData.get('issue_date')).getFullYear() || 2026;
      const nextSeq = all.length + 1;
      const newCertId = `${prefix}-${year}-${String(nextSeq).padStart(5, '0')}`;
      const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
      const newRecord = {
        id: nextSeq,
        certificate_id: newCertId,
        certificate_type: formData.get('certificate_type'),
        prefix: prefix,
        recipient_name: formData.get('recipient_name'),
        recipient_email: formData.get('recipient_email'),
        course_name: formData.get('course_name'),
        course_duration: formData.get('course_duration'),
        issue_date: formData.get('issue_date'),
        completion_date: formData.get('completion_date'),
        expiry_date: formData.get('expiry_date') || null,
        trainer_name: formData.get('trainer_name'),
        trainer_designation: formData.get('trainer_designation'),
        signatory_name: formData.get('signatory_name'),
        signatory_designation: formData.get('signatory_designation'),
        description: formData.get('description'),
        private_notes: formData.get('private_notes'),
        status: formData.get('status') || 'valid',
        verification_token: token,
        verification_url: `${window.location.origin}/verify/?id=${encodeURIComponent(newCertId)}`,
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
        updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };
      all.unshift(newRecord);
      showToast(`Certificate ${newCertId} issued successfully!`);
    }

    saveLocalData('certificates', all);
    closeAdminModal('certificateEditorModal');
    fetchCertificates();
    fetchDashboardStats();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/certificates.php', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + authToken },
      body: new URLSearchParams(formData)
    });
    const result = await res.json();
    if (result && result.success) {
      showToast(result.message);
      closeAdminModal('certificateEditorModal');
      fetchCertificates();
      fetchDashboardStats();
    } else {
      showToast(result.message || 'Failed to save certificate', true);
    }
  } catch (err) {
    showToast('Network error while saving certificate', true);
  }
}

// -------------------------------------------------------------
// LIVE PREVIEW & AUDIT LOGS MODAL
// -------------------------------------------------------------
async function openCertificatePreview(id) {
  let cert = null;
  let logs = [];

  if (!isDevStaticMode) {
    try {
      const res = await apiFetch(`../api/admin/certificates.php?action=get&id=${encodeURIComponent(id)}`, {
        headers: { 'Authorization': 'Bearer ' + authToken }
      });
      const result = await res.json();
      if (result && result.success && result.data) {
        cert = result.data.certificate;
        logs = result.data.logs || [];
      }
    } catch (e) {}
  }

  if (!cert) {
    const all = getLocalData('certificates');
    cert = all.find(c => c.id == id || c.certificate_id === id);
    const allLogs = getLocalData('certificate_logs');
    if (cert) {
      logs = allLogs.filter(l => l.certificate_id === cert.certificate_id);
    }
  }

  if (!cert) {
    showToast('Certificate not found', true);
    return;
  }

  certPreviewCurrent = cert;
  renderAdminCertPreviewDoc(cert, logs);
  openAdminModal('certificatePreviewModal');
}

function renderAdminCertPreviewDoc(cert, logs = []) {
  document.getElementById('previewCertIdLabel').textContent = cert.certificate_id || '--';
  document.getElementById('adminCertBadgeId').textContent = cert.certificate_id || '--';
  document.getElementById('adminCertDocTypeLabel').textContent = (cert.certificate_type || 'CREDENTIAL').toUpperCase();
  document.getElementById('adminCertDocTitle').textContent = `CERTIFICATE OF ${(cert.certificate_type || 'COMPLETION').toUpperCase()}`;
  document.getElementById('adminCertDocRecipient').textContent = cert.recipient_name || '--';
  document.getElementById('adminCertDocCourse').textContent = cert.course_name || '--';
  document.getElementById('adminCertDocDescription').textContent = cert.description || 'Successfully demonstrated proficiency in modern software engineering principles and architectural excellence.';

  document.getElementById('adminCertDocTrainerName').textContent = cert.trainer_name || 'Santhosh S';
  document.getElementById('adminCertDocTrainerTitle').textContent = cert.trainer_designation || 'Lead Technical Instructor';
  document.getElementById('adminCertDocTrainerSign').textContent = (cert.trainer_name || 'Santhosh S.').replace(/ [A-Z]$/, ' S.');

  document.getElementById('adminCertDocSignatoryName').textContent = cert.signatory_name || 'S.B. Sachin';
  document.getElementById('adminCertDocSignatoryTitle').textContent = cert.signatory_designation || 'Founder & CEO';
  document.getElementById('adminCertDocCeoSign').textContent = cert.signatory_name || 'S.B. Sachin';

  document.getElementById('adminCertDocIssueDate').textContent = formatDate(cert.issue_date);
  document.getElementById('adminCertDocMetaId').textContent = cert.certificate_id || '--';

  const hostDomain = window.location.host || 'vyomantratech.com';
  document.getElementById('adminCertDocVerifyDomain').textContent = `${hostDomain}/verify`;

  const tokenSnippet = cert.verification_token ? cert.verification_token.substring(0, 16).toUpperCase() : 'VYOM-SECURE';
  document.getElementById('adminCertDocSecurityToken').textContent = tokenSnippet;

  // Ribbon
  const ribbon = document.getElementById('adminCertRibbon');
  const revokeBtn = document.getElementById('btnRevokeFromPreview');
  const status = (cert.status || 'valid').toLowerCase();

  if (ribbon) {
    if (status === 'revoked') {
      ribbon.className = 'cert-status-ribbon revoked';
      ribbon.textContent = 'REVOKED';
      ribbon.style.display = 'block';
    } else if (status === 'expired') {
      ribbon.className = 'cert-status-ribbon expired';
      ribbon.textContent = 'EXPIRED';
      ribbon.style.display = 'block';
    } else {
      ribbon.style.display = 'none';
    }
  }

  if (revokeBtn) {
    if (status === 'revoked') {
      revokeBtn.innerHTML = '<i class="fas fa-undo"></i> Restore';
      revokeBtn.className = 'btn btn-outline btn-sm';
    } else {
      revokeBtn.innerHTML = '<i class="fas fa-ban"></i> Revoke';
      revokeBtn.className = 'btn btn-outline btn-sm danger';
    }
  }

  // QR Code Rendering into preview
  const qrBox = document.getElementById('adminCertDocQrBox');
  if (qrBox) {
    qrBox.innerHTML = '';
    const siteOrigin = window.location.origin;
    const vUrl = cert.verification_url || `${siteOrigin}/verify/?id=${encodeURIComponent(cert.certificate_id)}`;

    if (typeof QRCode !== 'undefined') {
      new QRCode(qrBox, {
        text: vUrl,
        width: 76,
        height: 76,
        colorDark: '#050711',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    } else {
      const img = document.createElement('img');
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=76x76&data=${encodeURIComponent(vUrl)}&margin=1`;
      img.alt = 'QR Code';
      img.width = 76;
      img.height = 76;
      qrBox.appendChild(img);
    }
  }

  // Render Verification Audit Logs
  const summaryEl = document.getElementById('previewAuditSummary');
  const logsTbody = document.getElementById('previewAuditLogsBody');
  if (summaryEl) summaryEl.textContent = `Total verifications recorded: ${logs.length}`;

  if (logsTbody) {
    if (!logs || logs.length === 0) {
      logsTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1rem; color:var(--text-dim);">No verification scans or manual checks recorded yet.</td></tr>';
    } else {
      logsTbody.innerHTML = logs.map(l => {
        const res = (l.result || 'valid').toLowerCase();
        let resBadge = 'badge-valid';
        if (res === 'revoked' || res === 'not_found') resBadge = 'badge-rejected';
        else if (res === 'expired') resBadge = 'badge-pending';

        return `
          <tr>
            <td style="padding:0.45rem 0.75rem; color:#cbd5e1; font-family:'JetBrains Mono',monospace;">${escapeHtml(l.verification_timestamp || l.timestamp)}</td>
            <td style="padding:0.45rem 0.75rem;"><span class="status-badge badge-new" style="font-size:0.68rem;">${escapeHtml(l.verification_method || 'QR_SCAN')}</span></td>
            <td style="padding:0.45rem 0.75rem;"><span class="status-badge ${resBadge}" style="font-size:0.68rem;">${escapeHtml((l.result || 'valid').toUpperCase())}</span></td>
            <td style="padding:0.45rem 0.75rem; font-family:'JetBrains Mono',monospace; color:var(--cyan); font-size:0.75rem;">${escapeHtml(l.ip_address || '127.0.0.1')}</td>
            <td style="padding:0.45rem 0.75rem; font-size:0.75rem; color:var(--text-dim); max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(l.user_agent || '')}">${escapeHtml(l.user_agent || 'Standard Browser')}</td>
          </tr>`;
      }).join('');
    }
  }
}

// -------------------------------------------------------------
// DOWNLOAD PDF & PRINT
// -------------------------------------------------------------
function adminDownloadCurrentPdf() {
  if (!certPreviewCurrent) return;
  const element = document.getElementById('adminCertDoc');
  if (!element) return;

  showToast('Generating official PDF certificate...');

  const fileName = `${certPreviewCurrent.certificate_id}_Vyomantra_Certificate.pdf`;

  if (typeof html2pdf !== 'undefined') {
    const opt = {
      margin: 0,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(element).save().then(() => {
      showToast('PDF downloaded successfully.');
    }).catch(err => {
      console.error(err);
      window.print();
    });
  } else {
    window.print();
  }
}

async function adminDownloadCertPdf(id) {
  await openCertificatePreview(id);
  setTimeout(() => {
    adminDownloadCurrentPdf();
  }, 400);
}

function adminPrintCurrentCert() {
  window.print();
}

function adminDownloadCurrentQr() {
  if (!certPreviewCurrent) return;
  const qrBox = document.getElementById('adminCertDocQrBox');
  const canvas = qrBox ? qrBox.querySelector('canvas') : null;
  const img = qrBox ? qrBox.querySelector('img') : null;

  let dataUrl = null;
  if (canvas) {
    dataUrl = canvas.toDataURL('image/png');
  } else if (img) {
    dataUrl = img.src;
  }

  if (dataUrl) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${certPreviewCurrent.certificate_id}_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('QR Code downloaded.');
  } else {
    showToast('Failed to export QR', true);
  }
}

async function copyCertificateText(value, successMessage) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      const field = document.createElement('textarea');
      field.value = value;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      if (!copied) throw new Error('Clipboard copy was denied');
    }
    showToast(successMessage);
  } catch (error) {
    prompt('Copy this value:', value);
  }
}

function adminCopyCurrentVerifyUrl() {
  if (!certPreviewCurrent) return;
  const siteOrigin = window.location.origin;
  const vUrl = certPreviewCurrent.verification_url || `${siteOrigin}/verify/?id=${encodeURIComponent(certPreviewCurrent.certificate_id)}`;
  copyCertificateText(vUrl, 'Verification URL copied to clipboard');
}

function adminCopyCertId(id) {
  copyCertificateText(id, `Certificate ID ${id} copied to clipboard`);
}

// -------------------------------------------------------------
// REVOCATION & RESTORE
// -------------------------------------------------------------
function adminPromptRevokeCurrent() {
  if (!certPreviewCurrent) return;
  if ((certPreviewCurrent.status || 'valid') === 'revoked') {
    restoreCertificate(certPreviewCurrent.certificate_id);
  } else {
    openCertificateRevokeModal(certPreviewCurrent.certificate_id);
  }
}

function openCertificateRevokeModal(id) {
  certRevokeTargetId = id;
  document.getElementById('revokeModalCertId').textContent = id;
  document.getElementById('revokeReasonInput').value = '';
  openAdminModal('certificateRevokeModal');
}

async function confirmCertificateRevocation() {
  const reason = document.getElementById('revokeReasonInput').value.trim();
  if (!reason) {
    showToast('Please provide a revocation reason', true);
    return;
  }

  const id = certRevokeTargetId;
  if (!id) return;

  if (isDevStaticMode) {
    let all = getLocalData('certificates');
    const idx = all.findIndex(c => c.id == id || c.certificate_id === id);
    if (idx !== -1) {
      all[idx].status = 'revoked';
      all[idx].revoked_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
      all[idx].revoked_by = currentAdminUser ? currentAdminUser.username : 'Administrator';
      all[idx].revocation_reason = reason;
      saveLocalData('certificates', all);
    }
    showToast(`Certificate ${id} revoked.`);
    closeAdminModal('certificateRevokeModal');
    closeAdminModal('certificatePreviewModal');
    fetchCertificates();
    fetchDashboardStats();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/certificates.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + authToken
      },
      body: `action=revoke&id=${encodeURIComponent(id)}&reason=${encodeURIComponent(reason)}`
    });
    const result = await res.json();
    if (result && result.success) {
      showToast(result.message);
      closeAdminModal('certificateRevokeModal');
      closeAdminModal('certificatePreviewModal');
      fetchCertificates();
      fetchDashboardStats();
    } else {
      showToast(result.message || 'Revocation failed', true);
    }
  } catch (e) {
    showToast('Network error during revocation', true);
  }
}

async function restoreCertificate(id) {
  if (!confirm(`Are you sure you want to restore certificate ${id} to VALID status?`)) return;

  if (isDevStaticMode) {
    let all = getLocalData('certificates');
    const idx = all.findIndex(c => c.id == id || c.certificate_id === id);
    if (idx !== -1) {
      all[idx].status = 'valid';
      all[idx].revoked_at = null;
      all[idx].revoked_by = null;
      all[idx].revocation_reason = null;
      saveLocalData('certificates', all);
    }
    showToast(`Certificate ${id} restored to VALID status.`);
    closeAdminModal('certificatePreviewModal');
    fetchCertificates();
    fetchDashboardStats();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/certificates.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + authToken
      },
      body: `action=restore&id=${encodeURIComponent(id)}`
    });
    const result = await res.json();
    if (result && result.success) {
      showToast(result.message);
      closeAdminModal('certificatePreviewModal');
      fetchCertificates();
      fetchDashboardStats();
    } else {
      showToast(result.message || 'Restore failed', true);
    }
  } catch (e) {
    showToast('Network error during restore', true);
  }
}

async function deleteCertificate(id) {
  if (!confirm(`CAUTION: Are you sure you want to permanently delete certificate ${id}? This cannot be undone.`)) return;

  if (isDevStaticMode) {
    let all = getLocalData('certificates').filter(c => !(c.id == id || c.certificate_id === id));
    saveLocalData('certificates', all);
    showToast(`Certificate ${id} deleted.`);
    fetchCertificates();
    fetchDashboardStats();
    return;
  }

  try {
    const res = await apiFetch('../api/admin/certificates.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + authToken
      },
      body: `action=delete&id=${encodeURIComponent(id)}`
    });
    const result = await res.json();
    if (result && result.success) {
      showToast(result.message);
      fetchCertificates();
      fetchDashboardStats();
    } else {
      showToast(result.message || 'Delete failed', true);
    }
  } catch (e) {
    showToast('Network error during delete', true);
  }
}

// -------------------------------------------------------------
// BULK CSV IMPORT
// -------------------------------------------------------------
async function executeBulkImport() {
  const fileInput = document.getElementById('bulkCsvFile');
  const textInput = document.getElementById('bulkCsvText');

  let rawCsv = textInput ? textInput.value.trim() : '';

  const processRecords = async (records) => {
    if (!records || records.length === 0) {
      showToast('No valid certificate rows found in CSV', true);
      return;
    }

    if (isDevStaticMode) {
      let all = getLocalData('certificates');
      const year = new Date().getFullYear();
      let count = 0;

      records.forEach(r => {
        const recipient = (r.recipient_name || '').trim();
        const course = (r.course_name || '').trim();
        if (!recipient || !course) return;

        count++;
        const prefix = (r.prefix || 'VYOM-CRT').toUpperCase();
        const nextSeq = all.length + 1;
        const newId = `${prefix}-${year}-${String(nextSeq).padStart(5, '0')}`;
        const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

        all.unshift({
          id: nextSeq,
          certificate_id: newId,
          certificate_type: r.certificate_type || 'Course Completion',
          prefix: prefix,
          recipient_name: recipient,
          recipient_email: r.recipient_email || '',
          course_name: course,
          course_duration: r.course_duration || '3 Months',
          description: r.description || 'Successfully completed official program curriculum with distinction.',
          trainer_name: r.trainer_name || 'Santhosh S',
          trainer_designation: r.trainer_designation || 'Lead Technical Instructor',
          signatory_name: 'S.B. Sachin',
          signatory_designation: 'Founder & CEO',
          issue_date: r.issue_date || new Date().toISOString().split('T')[0],
          completion_date: r.issue_date || new Date().toISOString().split('T')[0],
          expiry_date: null,
          status: 'valid',
          verification_token: token,
          verification_url: `${window.location.origin}/verify/?id=${encodeURIComponent(newId)}`,
          created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
          updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
        });
      });

      saveLocalData('certificates', all);
      showToast(`Bulk issue complete. Successfully issued ${count} certificates.`);
      closeAdminModal('certificateBulkModal');
      fetchCertificates();
      fetchDashboardStats();
      return;
    }

    // Live Mode Backend
    try {
      const res = await apiFetch('../api/admin/certificates.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Bearer ' + authToken
        },
        body: `action=bulk_import&records=${encodeURIComponent(JSON.stringify(records))}`
      });
      const result = await res.json();
      if (result && result.success) {
        showToast(result.message);
        closeAdminModal('certificateBulkModal');
        fetchCertificates();
        fetchDashboardStats();
      } else {
        showToast(result.message || 'Bulk import failed', true);
      }
    } catch (e) {
      showToast('Network error during bulk import', true);
    }
  };

  // If CSV file selected
  if (fileInput && fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const parsed = parseCsvStringToRecords(e.target.result);
      processRecords(parsed);
    };
    reader.readAsText(fileInput.files[0]);
    return;
  }

  // If text pasted
  if (rawCsv) {
    const parsed = parseCsvStringToRecords(rawCsv);
    processRecords(parsed);
    return;
  }

  showToast('Please select a CSV file or paste CSV text', true);
}

function parseCsvStringToRecords(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];

  // Check if first line is header
  let startIdx = 0;
  const firstLine = lines[0].toLowerCase();
  if (firstLine.includes('name') || firstLine.includes('recipient') || firstLine.includes('course')) {
    startIdx = 1;
  }

  const records = [];
  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    if (!parts[0]) continue;

    records.push({
      recipient_name: parts[0] || '',
      recipient_email: parts[1] || '',
      course_name: parts[2] || 'Full Stack Software Engineering',
      course_duration: parts[3] || '3 Months',
      issue_date: parts[4] || new Date().toISOString().split('T')[0],
      certificate_type: parts[5] || 'Course Completion',
      prefix: parts[6] || 'VYOM-CRT'
    });
  }
  return records;
}

// =========================================================================
// CERTIFICATE CSV EXPORT & DOCX GENERATOR SUITE
// =========================================================================

async function exportCertificatesCsv() {
  showToast('Preparing certificate registry CSV export...');
  if (!isDevStaticMode) {
    try {
      const res = await apiFetch(`../api/admin/certificates.php?action=export_csv`, {
        headers: { 'Authorization': 'Bearer ' + (authToken || '') }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vyomantra_certificates_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showToast('CSV Export downloaded successfully.');
        return;
      }
    } catch (e) {
      console.warn('Backend export failed, falling back to local registry data', e);
    }
  }

  // Fallback to client data export
  const all = getLocalData('certificates') || [];
  if (all.length === 0) {
    showToast('No certificates found to export', true);
    return;
  }

  const headers = ['Certificate ID', 'Recipient Name', 'Recipient Email', 'Type', 'Course/Program', 'Duration', 'Issue Date', 'Status', 'Verification URL'];
  const rows = all.map(c => [
    `"${(c.certificate_id || '').replace(/"/g, '""')}"`,
    `"${(c.recipient_name || '').replace(/"/g, '""')}"`,
    `"${(c.recipient_email || '').replace(/"/g, '""')}"`,
    `"${(c.certificate_type || '').replace(/"/g, '""')}"`,
    `"${(c.course_name || '').replace(/"/g, '""')}"`,
    `"${(c.course_duration || '').replace(/"/g, '""')}"`,
    `"${(c.issue_date || '').replace(/"/g, '""')}"`,
    `"${(c.status || '').replace(/"/g, '""')}"`,
    `"${(c.verification_url || `${window.location.origin}/verify/?id=${c.certificate_id}`).replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vyomantra_certificates_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Certificates exported to CSV successfully.');
}

async function downloadCertificateDocx(certId, mode = 'digital') {
  const modeLabel = (mode === 'partial') ? 'Manual Sign (Partial)' : 'Complete Digital';
  showToast(`Generating ${modeLabel} DOCX certificate for ${certId}...`);

  // Find cert in local data or preview
  let cert = null;
  const all = getLocalData('certificates');
  if (all && all.length > 0) {
    cert = all.find(c => c.certificate_id === certId || c.id == certId);
  }
  if (!cert && certPreviewCurrent && (certPreviewCurrent.certificate_id === certId || certPreviewCurrent.id == certId)) {
    cert = certPreviewCurrent;
  }
  if (!cert) {
    cert = { certificate_id: certId, recipient_name: 'Student Candidate', course_name: 'Course Completion', course_duration: '3 Months', issue_date: new Date().toISOString().slice(0, 10) };
  }

  // 1. Client-Side JSZip engine: instant, completely resilient on port 5500 Live Server & production
  if (typeof JSZip !== 'undefined') {
    try {
      const blob = await generateClientSideDocx(cert, mode);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cert.certificate_id}_${mode === 'partial' ? 'Manual_Sign' : 'Digital'}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast(`${modeLabel} DOCX certificate generated and downloaded!`);
      return;
    } catch (err) {
      console.warn('Client-side DOCX compilation fallback to API:', err);
    }
  }

  // 2. Fallback to PHP API endpoint
  const downloadUrl = `../api/admin/certificates.php?action=download_docx&id=${encodeURIComponent(certId)}&mode=${encodeURIComponent(mode)}&token=${encodeURIComponent(authToken || '')}`;
  try {
    const res = await fetch(downloadUrl, {
      headers: { 'Authorization': 'Bearer ' + (authToken || '') }
    });

    if (res.ok && res.headers.get('content-type')?.includes('wordprocessingml')) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certId}_${mode === 'partial' ? 'Manual_Sign' : 'Digital'}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast(`${modeLabel} DOCX downloaded successfully.`);
      return;
    }
  } catch (err) {
    console.warn('API DOCX download failed, trying direct link...', err);
  }

  // Direct trigger
  window.open(downloadUrl, '_blank');
}

async function generateClientSideDocx(cert, mode = 'digital') {
  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip library is not loaded');
  }

  // Fetch the active template docx
  const tplUrl = '../templates/certificates/Course_Certificate_Template.docx';
  const res = await fetch(tplUrl);
  if (!res.ok) throw new Error('Template file could not be read');
  const templateBuffer = await res.arrayBuffer();

  const zip = await JSZip.loadAsync(templateBuffer);
  let xml = await zip.file('word/document.xml').async('string');

  const formattedDate = formatDate(cert.issue_date || new Date());
  const vUrl = cert.verification_url || `${window.location.origin}/verify/?id=${encodeURIComponent(cert.certificate_id)}`;

  let recipientName = cert.recipient_name || '';
  let founderSign = cert.signatory_name || 'S.B. Sachin';
  let directorSign = 'Santhosh Kumar S.';
  let trainerSign = cert.trainer_name || 'Santhosh S.';

  if (mode === 'partial') {
    recipientName = (currentCertConfig.recipient_name_partial === 'filled') ? (cert.recipient_name || '') : '____________________________________';
    founderSign = (currentCertConfig.founder_signature_mode === 'digital') ? (cert.signatory_name || 'S.B. Sachin') : '                    ';
    directorSign = (currentCertConfig.director_signature_mode === 'digital') ? 'Santhosh Kumar S.' : '                    ';
    trainerSign = (currentCertConfig.trainer_signature_mode === 'digital') ? (cert.trainer_name || 'Santhosh S.') : '                    ';
  }

  const replacements = {
    '{{CERTIFICATE_ID}}': cert.certificate_id || 'VYOM-CRT-2026-00001',
    '{{RECIPIENT_NAME}}': recipientName,
    '{{COURSE_NAME}}': cert.course_name || 'Professional Software Engineering',
    '{{COURSE_DURATION}}': cert.course_duration || '3 Months',
    '{{ISSUE_DATE}}': formattedDate,
    '{{COMPLETION_DATE}}': cert.completion_date ? formatDate(cert.completion_date) : formattedDate,
    '{{VERIFICATION_URL}}': vUrl,
    '{{QR_CODE}}': `[ Scan to Verify: ${cert.certificate_id} ]`,
    '{{FOUNDER_SIGNATURE}}': founderSign,
    '{{DIRECTOR_SIGNATURE}}': directorSign,
    '{{TRAINER_SIGNATURE}}': trainerSign,
    '{{DESCRIPTION}}': cert.description || '',
    '{{TRAINER_NAME}}': cert.trainer_name || 'Santhosh S.',
    '{{SIGNATORY_NAME}}': cert.signatory_name || 'S.B. Sachin'
  };

  for (const [tag, val] of Object.entries(replacements)) {
    xml = xml.split(tag).join(escapeXml(val));
  }

  zip.file('word/document.xml', xml);

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function adminDownloadCurrentDocx(mode = 'digital') {
  if (!certPreviewCurrent || !certPreviewCurrent.certificate_id) {
    showToast('No active certificate selected', true);
    return;
  }
  downloadCertificateDocx(certPreviewCurrent.certificate_id, mode);
}

// -------------------------------------------------------------
// CERTIFICATE CONFIGURATOR LOGIC
// -------------------------------------------------------------
let currentCertConfig = {
  active_template: 'Course_Certificate_Template.docx',
  custom_template_uploaded: false,
  custom_template_name: null,
  custom_template_size: 0,
  founder_signature_mode: 'manual',
  director_signature_mode: 'digital',
  trainer_signature_mode: 'digital',
  recipient_name_partial: 'blank'
};

function initConfiguratorEvents() {
  // Tab switching inside configurator
  const tabs = document.querySelectorAll('.configurator-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.configurator-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panelId = tab.getAttribute('data-cfg-panel');
      const panel = document.getElementById(panelId);
      if (panel) panel.classList.add('active');
    });
  });

  // Drag and drop zone
  const dropZone = document.getElementById('docxDropZone');
  const fileInput = document.getElementById('inputTemplateDocx');

  if (dropZone && fileInput) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleDocxTemplateUpload(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleDocxTemplateUpload(e.target.files[0]);
      }
    });
  }
}

async function openCertificateConfiguratorModal() {
  // Try loading saved config from API or localStorage
  try {
    const res = await apiFetch('../api/admin/certificates.php?action=get_template_config');
    const result = await res.json();
    if (result && result.success && result.data) {
      currentCertConfig = result.data;
    }
  } catch (e) {
    try {
      const localCfg = localStorage.getItem('vyomantra_cert_config');
      if (localCfg) currentCertConfig = { ...currentCertConfig, ...JSON.parse(localCfg) };
    } catch (storageError) {
      console.warn('Saved certificate configuration could not be read; using defaults.', storageError);
      localStorage.removeItem('vyomantra_cert_config');
    }
  }

  updateConfiguratorUI();
  openAdminModal('certificateConfiguratorModal');
}

function updateConfiguratorUI() {
  const nameEl = document.getElementById('cfgCurrentTemplateName');
  const metaEl = document.getElementById('cfgTemplateMeta');

  if (currentCertConfig.custom_template_uploaded && currentCertConfig.custom_template_name) {
    if (nameEl) nameEl.textContent = currentCertConfig.custom_template_name;
    if (metaEl) metaEl.textContent = `Custom Active Template • Size: ${(currentCertConfig.custom_template_size / 1024).toFixed(1)} KB • Word (.docx)`;
  } else {
    if (nameEl) nameEl.textContent = 'Vyomantra_Course_Certificate_Template.docx';
    if (metaEl) metaEl.textContent = 'Default Registry Template • Format: Word Document (OpenXML)';
  }

  // Update signature button states
  setSignatureMode('founder', currentCertConfig.founder_signature_mode || 'manual', false);
  setSignatureMode('director', currentCertConfig.director_signature_mode || 'digital', false);
  setSignatureMode('trainer', currentCertConfig.trainer_signature_mode || 'digital', false);
  setNamePartialMode(currentCertConfig.recipient_name_partial || 'blank', false);
}

function setSignatureMode(authority, mode, notify = true) {
  if (authority === 'founder') {
    currentCertConfig.founder_signature_mode = mode;
    const digBtn = document.getElementById('sigFounderDigital');
    const manBtn = document.getElementById('sigFounderManual');
    const desc = document.getElementById('sigFounderDesc');
    if (digBtn && manBtn) {
      if (mode === 'digital') {
        digBtn.className = 'sig-mode-btn active-digital';
        manBtn.className = 'sig-mode-btn';
        if (desc) desc.textContent = 'Founder signature is automatically pre-stamped digitally in all generated outputs.';
      } else {
        digBtn.className = 'sig-mode-btn';
        manBtn.className = 'sig-mode-btn active-manual';
        if (desc) desc.textContent = 'In partial download mode, founder signature is left blank so it can be physically signed with a pen.';
      }
    }
  } else if (authority === 'director') {
    currentCertConfig.director_signature_mode = mode;
    const digBtn = document.getElementById('sigDirectorDigital');
    const manBtn = document.getElementById('sigDirectorManual');
    const desc = document.getElementById('sigDirectorDesc');
    if (digBtn && manBtn) {
      if (mode === 'digital') {
        digBtn.className = 'sig-mode-btn active-digital';
        manBtn.className = 'sig-mode-btn';
        if (desc) desc.textContent = 'Already digitally embedded in template; will be retained in all generated certificates.';
      } else {
        digBtn.className = 'sig-mode-btn';
        manBtn.className = 'sig-mode-btn active-manual';
        if (desc) desc.textContent = 'Left blank in partial downloads for manual physical pen signing.';
      }
    }
  } else if (authority === 'trainer') {
    currentCertConfig.trainer_signature_mode = mode;
    const digBtn = document.getElementById('sigTrainerDigital');
    const manBtn = document.getElementById('sigTrainerManual');
    const desc = document.getElementById('sigTrainerDesc');
    if (digBtn && manBtn) {
      if (mode === 'digital') {
        digBtn.className = 'sig-mode-btn active-digital';
        manBtn.className = 'sig-mode-btn';
        if (desc) desc.textContent = 'Already digitally signed in template; preserved across all output documents.';
      } else {
        digBtn.className = 'sig-mode-btn';
        manBtn.className = 'sig-mode-btn active-manual';
        if (desc) desc.textContent = 'Left blank in partial downloads for manual physical pen signing.';
      }
    }
  }

  if (notify) {
    showToast(`${authority.charAt(0).toUpperCase() + authority.slice(1)} signature set to ${mode.toUpperCase()}`);
  }
}

function setNamePartialMode(mode, notify = true) {
  currentCertConfig.recipient_name_partial = mode;
  const blankBtn = document.getElementById('namePartialBlank');
  const filledBtn = document.getElementById('namePartialFilled');
  const desc = document.getElementById('namePartialDesc');

  if (blankBtn && filledBtn) {
    if (mode === 'blank') {
      blankBtn.className = 'sig-mode-btn active-manual';
      filledBtn.className = 'sig-mode-btn';
      if (desc) desc.textContent = 'Leaves candidate name line empty in partial download for manual handwriting or calligraphy.';
    } else {
      blankBtn.className = 'sig-mode-btn';
      filledBtn.className = 'sig-mode-btn active-digital';
      if (desc) desc.textContent = 'Pre-fills student name even in partial pre-printed download.';
    }
  }

  if (notify) {
    showToast(`Pre-printed candidate name set to ${mode === 'blank' ? 'BLANK (Manual)' : 'FILLED'}`);
  }
}

async function handleDocxTemplateUpload(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.docx')) {
    showToast('Invalid file format. Please upload a Microsoft Word (.docx) file', true);
    return;
  }

  showToast('Uploading & validating DOCX template...');

  const formData = new FormData();
  formData.append('action', 'upload_template');
  formData.append('template_file', file);

  try {
    const res = await apiFetch('../api/admin/certificates.php', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + (authToken || '') },
      body: formData
    });
    const result = await res.json();
    if (result && result.success) {
      currentCertConfig.custom_template_uploaded = true;
      currentCertConfig.custom_template_name = file.name;
      currentCertConfig.custom_template_size = file.size;
      localStorage.setItem('vyomantra_cert_config', JSON.stringify(currentCertConfig));
      updateConfiguratorUI();
      showToast('Custom DOCX template uploaded and active!');
    } else {
      showToast(result.message || 'Template upload failed', true);
    }
  } catch (e) {
    // Local fallback for offline / port 5500 Live Server testing
    currentCertConfig.custom_template_uploaded = true;
    currentCertConfig.custom_template_name = file.name;
    currentCertConfig.custom_template_size = file.size;
    localStorage.setItem('vyomantra_cert_config', JSON.stringify(currentCertConfig));
    updateConfiguratorUI();
    showToast('Template registered locally (Dev mode).');
  }
}

async function saveCertificateConfiguration() {
  localStorage.setItem('vyomantra_cert_config', JSON.stringify(currentCertConfig));

  try {
    const res = await apiFetch('../api/admin/certificates.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (authToken || '')
      },
      body: JSON.stringify({
        action: 'save_template_config',
        ...currentCertConfig
      })
    });
    const result = await res.json();
    if (result && result.success) {
      showToast('Certificate configuration saved & active!');
      closeAdminModal('certificateConfiguratorModal');
      return;
    }
  } catch (e) {}

  showToast('Configuration applied and saved to registry.');
  closeAdminModal('certificateConfiguratorModal');
}

function downloadActiveTemplateFile() {
  const url = `../api/admin/certificates.php?action=download_template&token=${encodeURIComponent(authToken || '')}`;
  window.open(url, '_blank');
}

async function resetDefaultDocxTemplate() {
  if (!confirm('Are you sure you want to revert back to the default Vyomantra Course Certificate template?')) return;
  try {
    const res = await apiFetch('../api/admin/certificates.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + (authToken || '')
      },
      body: 'action=reset_template'
    });
    const result = await res.json();
    if (result && result.success) {
      currentCertConfig = result.data;
    }
  } catch (e) {
    currentCertConfig.custom_template_uploaded = false;
    currentCertConfig.custom_template_name = null;
  }

  localStorage.setItem('vyomantra_cert_config', JSON.stringify(currentCertConfig));
  updateConfiguratorUI();
  showToast('Reset to default Vyomantra template.');
}

function testSampleDocxGeneration() {
  const all = getLocalData('certificates');
  const sampleId = (all && all.length > 0) ? all[0].certificate_id : 'VYOM-PY-2026-00001';
  downloadCertificateDocx(sampleId, 'partial');
}

// Explicit Window Method Bindings for Inline HTML Event Compatibility
window.openCourseModal = openCourseModal;
window.deleteCourse = deleteCourse;
window.updateCourseStatus = updateCourseStatus;
window.handleSaveCourse = handleSaveCourse;
window.downloadCertificateDocx = downloadCertificateDocx;
window.adminDownloadCurrentDocx = adminDownloadCurrentDocx;
window.openCertificatePreview = openCertificatePreview;
window.openCertificateEditModal = openCertificateEditModal;
window.openCertificateRevokeModal = openCertificateRevokeModal;
window.confirmCertificateRevocation = confirmCertificateRevocation;
window.deleteCertificate = deleteCertificate;
window.restoreCertificate = restoreCertificate;
window.adminCopyCertId = adminCopyCertId;
window.adminDownloadCertPdf = adminDownloadCertPdf;
window.adminDownloadCurrentPdf = adminDownloadCurrentPdf;
window.adminPrintCurrentCert = adminPrintCurrentCert;
window.adminDownloadCurrentQr = adminDownloadCurrentQr;
window.adminCopyCurrentVerifyUrl = adminCopyCurrentVerifyUrl;
window.adminPromptRevokeCurrent = adminPromptRevokeCurrent;
window.openCertificateConfiguratorModal = openCertificateConfiguratorModal;
window.saveCertificateConfiguration = saveCertificateConfiguration;
window.setSignatureMode = setSignatureMode;
window.setNamePartialMode = setNamePartialMode;
window.testSampleDocxGeneration = testSampleDocxGeneration;
window.downloadActiveTemplateFile = downloadActiveTemplateFile;
window.resetDefaultDocxTemplate = resetDefaultDocxTemplate;
window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.openCertificateCreateModal = openCertificateCreateModal;
window.exportCertificatesCsv = exportCertificatesCsv;

// Install the click router as soon as this body-end script loads. It must not
// depend on the async authentication/setup path finishing first.
document.addEventListener('click', handleCertificateAction);

window.fetchCourses = fetchCourseRegistrations;
window.fetchCourseRegistrations = fetchCourseRegistrations;
