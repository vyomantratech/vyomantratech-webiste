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
      ? `Super Admin ${isDevStaticMode ? '<span style="color:#22c55e; margin-left:6px; font-size:0.68rem; font-weight:700;">&bull; LOCAL DEV</span>' : '<span style="color:#00f0ff; margin-left:6px; font-size:0.68rem; font-weight:700;">&bull; LIVE DB</span>'}`
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
    'certificates': { title: '<i class="fas fa-certificate" style="color:var(--cyan);"></i> Certificate Verification Registry', subtitle: 'Create verification IDs and QR codes, then attach your manually completed certificate PDF.' }
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
  setTxt('statCoursesRevenue', '\u20B9' + Number(data.courses?.total_revenue || 0).toLocaleString('en-IN'));

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
      ...courses.slice(0, 2).map(c => ({ type: 'course', title: c.student_name, subtitle: `${c.course_name} (\u20B9${c.amount_paid})`, status: c.payment_status, created_at: c.created_at })),
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
        &#8377;${Number(c.amount_paid || 649).toLocaleString('en-IN')}
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
        <div style="color:var(--cyan); font-weight:700; font-size:0.95rem;">&#8377;${Number(c.fee || 649).toLocaleString('en-IN')}</div>
        ${c.original_fee ? `<div style="font-size:0.75rem; color:var(--text-dim); text-decoration:line-through;">&#8377;${Number(c.original_fee).toLocaleString('en-IN')}</div>` : ''}
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
    document.getElementById('jobExpText').value = '1 - 3+ Years Experience';
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
  // Clear all demo/sample data on each load to start with a clean admin panel.
  // Real data is managed via the MySQL database (API) or explicitly created by admin.
  localStorage.setItem('vyomantra_admin_contacts', JSON.stringify([]));
  localStorage.setItem('vyomantra_admin_quotes', JSON.stringify([]));
  localStorage.setItem('vyomantra_admin_courses', JSON.stringify([]));
  localStorage.setItem('vyomantra_admin_applicants', JSON.stringify([]));
  localStorage.setItem('vyomantra_admin_jobs', JSON.stringify([]));
  localStorage.setItem('vyomantra_admin_courses_catalog', JSON.stringify([]));
  // Always reset certificates and logs localStorage so stale sample records never persist.
  localStorage.setItem('vyomantra_admin_certificates', JSON.stringify([]));
  localStorage.setItem('vyomantra_admin_certificate_logs', JSON.stringify([]));
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
const CERTS_PAGE_SIZE = 25;
let certCurrentPage = 0;
let latestGeneratedCertificate = null;
let currentCertificatesList = [];

function initCertificatesManager() {
  const form = document.getElementById('certificateEditorForm');
  const saveButton = document.getElementById('btnSaveCertificate');
  const searchInput = document.getElementById('searchCerts');
  const previousButton = document.getElementById('btnPrevCertPage');
  const nextButton = document.getElementById('btnNextCertPage');
  const qrButton = document.getElementById('btnDownloadGeneratedQr');
  const viewFieldsButton = document.getElementById('btnViewGeneratedFilledFields');
  const uploadButton = document.getElementById('btnUploadFinalDocx');
  const uploadInput = document.getElementById('generatedFinalDocx');
  const btnCloseGen = document.getElementById('btnCloseGeneratedPanel');
  const btnFillPython = document.getElementById('btnFillCoursePython');
  const durationInput = document.getElementById('certCourseDuration');
  const issueDateInput = document.getElementById('certIssueDate');

  // Set initial default form values matching 1month_python course.docx
  if (issueDateInput && !issueDateInput.value) {
    issueDateInput.value = new Date().toISOString().slice(0, 10);
  }
  if (durationInput && !durationInput.value) {
    durationInput.value = '1 Month';
  }
  const mentorNameInput = document.getElementById('certMentorName');
  if (mentorNameInput && !mentorNameInput.value) mentorNameInput.value = 'Santhosh S';
  const mentorTitleInput = document.getElementById('certMentorTitle');
  if (mentorTitleInput && !mentorTitleInput.value) mentorTitleInput.value = 'Program Lead';
  const signatoryNameInput = document.getElementById('certSignatoryName');
  if (signatoryNameInput && !signatoryNameInput.value) signatoryNameInput.value = 'S.B. Sachin';
  const signatoryTitleInput = document.getElementById('certSignatoryTitle');
  if (signatoryTitleInput && !signatoryTitleInput.value) signatoryTitleInput.value = 'Founder & CEO';

  // Wire Python with AI quick-fill button
  btnFillPython?.addEventListener('click', () => {
    const courseInput = document.getElementById('certCourseName');
    if (courseInput) courseInput.value = 'Advanced Python & Applied AI Engineering';
    if (durationInput) durationInput.value = '1 Month';
    document.querySelectorAll('[data-duration-val]').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.durationVal === '1 Month');
    });
    showToast('Applied: Advanced Python & Applied AI Engineering (1 Month)');
  });

  // Wire duration chips
  document.querySelectorAll('[data-duration-val]').forEach(chip => {
    chip.addEventListener('click', () => {
      if (durationInput) durationInput.value = chip.dataset.durationVal;
      document.querySelectorAll('[data-duration-val]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  // Keep duration chips synced if typed manually
  durationInput?.addEventListener('input', () => {
    const val = durationInput.value.trim().toLowerCase();
    document.querySelectorAll('[data-duration-val]').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.durationVal.toLowerCase() === val);
    });
  });

  // Wire close generated panel button
  btnCloseGen?.addEventListener('click', () => {
    const panel = document.getElementById('generatedCertificatePanel');
    const grid = document.getElementById('certWorkflowGrid');
    if (panel) panel.style.display = 'none';
    if (grid) grid.classList.remove('has-generated');
  });

  saveButton?.addEventListener('click', saveCertificate);
  searchInput?.addEventListener('input', debounce(() => { certCurrentPage = 0; fetchCertificates(); }, 250));
  previousButton?.addEventListener('click', () => { if (certCurrentPage > 0) { certCurrentPage--; fetchCertificates(); } });
  nextButton?.addEventListener('click', () => { certCurrentPage++; fetchCertificates(); });
  qrButton?.addEventListener('click', downloadGeneratedQr);
  viewFieldsButton?.addEventListener('click', () => {
    if (latestGeneratedCertificate?.certificate_id) {
      openCertFillDetailsModal(latestGeneratedCertificate.certificate_id);
    }
  });
  document.querySelectorAll('[data-copy-generated]').forEach(button => button.addEventListener('click', () => {
    const field = document.getElementById(`generatedCert${button.dataset.copyGenerated.charAt(0).toUpperCase()}${button.dataset.copyGenerated.slice(1)}`);
    if (field) copyCertificateText(field.value, `${button.dataset.copyGenerated.toUpperCase()} copied`);
  }));
  uploadButton?.addEventListener('click', () => uploadInput?.click());
  uploadInput?.addEventListener('change', async () => {
    if (latestGeneratedCertificate && uploadInput.files?.[0]) {
      await uploadFinalCertificateDocx(latestGeneratedCertificate.certificate_id, uploadInput.files[0]);
      uploadInput.value = '';
    }
  });
}

async function handleCertificateAction(event) {
  const button = event.target.closest('[data-cert-action]');
  if (!button) return;
  try {
    if (button.dataset.certAction === 'download-qr') {
      await downloadCertificateQr(button.dataset.certName, button.dataset.certId, button.dataset.certUrl);
    } else if (button.dataset.certAction === 'view-details') {
      await openCertFillDetailsModal(button.dataset.certId);
    } else if (button.dataset.certAction === 'copy-id') {
      await copyCertificateText(button.dataset.certId, 'Certificate ID copied');
    } else if (button.dataset.certAction === 'copy-token') {
      await copyCertificateText(button.dataset.certToken, 'Verification token copied');
    } else if (button.dataset.certAction === 'copy-url') {
      await copyCertificateText(button.dataset.certUrl, 'Verification link copied');
    } else if (button.dataset.certAction === 'revoke' || button.dataset.certAction === 'reinstate') {
      await changeCertificateStatus(button.dataset.certId, button.dataset.certAction);
    } else if (button.dataset.certAction === 'delete') {
      await deleteCertificate(button.dataset.certId);
    }
  } catch (error) {
    console.error('Certificate action failed:', error);
    showToast('Certificate action failed. Please try again.', true);
  }
}

// Revoke (asks for a reason) or reinstate a certificate. The PDF is kept; public access is blocked while revoked.
async function changeCertificateStatus(certificateId, action) {
  let reason = '';
  if (action === 'revoke') {
    reason = (window.prompt(`Reason for revoking ${certificateId}? (kept private, never shown publicly)`) || '').trim();
    if (!reason) { showToast('Revoke cancelled: a reason is required.', true); return; }
  } else if (!window.confirm(`Reinstate ${certificateId} as valid?`)) {
    return;
  }
  if (isDevStaticMode) {
    const all = getLocalData('certificates') || [];
    all.forEach(c => { if (c.certificate_id === certificateId) { c.status = action === 'revoke' ? 'revoked' : 'valid'; c.revocation_reason = action === 'revoke' ? reason : null; } });
    saveLocalData('certificates', all);
  } else {
    const body = new FormData();
    body.append('action', action); body.append('certificate_id', certificateId); body.append('reason', reason);
    const response = await apiFetch('../api/admin/certificates.php', { method: 'POST', headers: { 'Authorization': `Bearer ${authToken || ''}` }, body });
    const result = await response.json();
    if (!response.ok || !result?.success) throw new Error(result?.message || 'Could not update the certificate status.');
  }
  showToast(action === 'revoke' ? `${certificateId} revoked.` : `${certificateId} reinstated.`);
  await fetchCertificates();
}

async function deleteCertificate(certificateId) {
  if (!certificateId) return;
  const confirmed = window.confirm(`Permanently delete certificate "${certificateId}"?\n\nThis will remove the verification record and any uploaded certificate files. This action cannot be undone.`);
  if (!confirmed) return;

  try {
    if (isDevStaticMode) {
      let all = getLocalData('certificates') || [];
      all = all.filter(c => c.certificate_id !== certificateId && String(c.id) !== certificateId);
      saveLocalData('certificates', all);
    } else {
      const body = new FormData();
      body.append('action', 'delete');
      body.append('certificate_id', certificateId);
      const response = await apiFetch('../api/admin/certificates.php', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken || ''}` },
        body
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Could not delete the certificate.');
      }
    }
    showToast(`Certificate ${certificateId} deleted.`);
    await fetchCertificates();
    fetchDashboardStats();
  } catch (error) {
    console.error('Delete certificate failed:', error);
    showToast(error.message || 'Could not delete the certificate.', true);
  }
}

async function fetchCertificates() {
  const tbody = document.getElementById('certificatesTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-dim);">Loading verification registry...</td></tr>';
  const search = document.getElementById('searchCerts')?.value.trim() || '';
  const offset = certCurrentPage * CERTS_PAGE_SIZE;

  if (isDevStaticMode) {
    let all = getLocalData('certificates') || [];
    if (!all.length) {
      try {
        const response = await fetch('../data/certificates.json');
        if (response.ok) { all = await response.json(); saveLocalData('certificates', all); }
      } catch (_) {}
    }
    const needle = search.toLowerCase();
    const filtered = all.filter(cert => !needle || `${cert.certificate_id} ${cert.recipient_name} ${cert.course_name}`.toLowerCase().includes(needle))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    currentCertificatesList = all;
    renderCertificatesTable(filtered.slice(offset, offset + CERTS_PAGE_SIZE), filtered.length);
    updateCertPagination(filtered.length);
    return;
  }

  try {
    const params = new URLSearchParams({ action: 'list', status: 'all', type: 'all', sort: 'newest', search, limit: CERTS_PAGE_SIZE, offset });
    const response = await apiFetch(`../api/admin/certificates.php?${params.toString()}`);
    const result = await response.json();
    if (!response.ok || !result?.success) throw new Error(result?.message || 'Could not load certificate records.');
    const certificates = result.data?.certificates || [];
    currentCertificatesList = certificates;
    renderCertificatesTable(certificates, result.data?.total || 0);
    updateCertPagination(result.data?.total || 0);
    const badge = document.getElementById('countBadgeCertificates');
    if (badge && result.data?.counts) badge.textContent = result.data.counts.total || 0;
  } catch (error) {
    console.error('Certificate registry load failed:', error);
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--red);">Could not load the verification registry.</td></tr>';
  }
}

function renderCertificatesTable(certificates, total) {
  const tbody = document.getElementById('certificatesTableBody');
  if (!tbody) return;
  if (!certificates.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-dim);">No verification records found.</td></tr>';
    return;
  }
  tbody.innerHTML = certificates.map(cert => {
    const id = escapeHtml(cert.certificate_id || '');
    const name = escapeHtml(cert.recipient_name || '');
    const safeName = escapeHtml(cert.recipient_name || 'Certificate');
    const url = escapeHtml(cert.verification_url || `${window.location.origin}/verify/?id=${encodeURIComponent(cert.certificate_id || '')}`);
    const token = escapeHtml(cert.verification_token || '');
    const pdfUrl = cert.certificate_pdf_url ? `../api/download.php?id=${encodeURIComponent(cert.certificate_id || '')}` : '';
    const st = String(cert.status || 'valid').toLowerCase();
    const stColor = st === 'valid' ? '#10b981' : (st === 'revoked' ? '#ef4444' : '#f59e0b');
    const actionBtn = st === 'revoked'
      ? `<button type="button" class="btn btn-outline btn-sm" data-cert-action="reinstate" data-cert-id="${id}" title="Reinstate Certificate">Reinstate</button>`
      : `<button type="button" class="btn btn-outline btn-sm" data-cert-action="revoke" data-cert-id="${id}" style="color:#f59e0b;border-color:rgba(245,158,11,0.5);" title="Revoke Certificate">Revoke</button>`;
    const deleteBtn = `<button type="button" class="btn btn-outline btn-sm" data-cert-action="delete" data-cert-id="${id}" title="Permanently delete certificate" style="color:#ef4444;border-color:rgba(239,68,68,0.5);"><i class="fas fa-trash-alt"></i></button>`;
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;margin-bottom:0.25rem;">
          <strong style="color:#fff;font-size:0.95rem;">${name}</strong>
          <button type="button" class="btn btn-outline btn-sm btn-view-cert-details" data-cert-action="view-details" data-cert-id="${id}" title="View all filled certificate fields for editing template" style="padding:2px 8px;font-size:0.72rem;line-height:1.2;border-color:rgba(0,240,255,0.45);color:var(--cyan);border-radius:12px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;background:rgba(0,240,255,0.06);transition:all 0.2s;">
            <i class="fas fa-list-alt"></i> View More
          </button>
        </div>
        <div style="font-size:.78rem;color:var(--text-muted);">${escapeHtml(cert.course_name || '')} &bull; ${escapeHtml(cert.program_type || '')} &bull; ${escapeHtml(cert.certificate_type || 'Certificate')} &bull; ${escapeHtml(cert.recognition || '')}</div>
      </td>
      <td><div style="display:flex;gap:.35rem;align-items:center;flex-wrap:wrap;"><strong class="cert-id-badge">${id}</strong><button type="button" class="btn-action-icon" data-cert-action="copy-id" data-cert-id="${id}" title="Copy ID"><i class="fas fa-copy"></i></button></div><div style="font-size:.72rem;color:var(--text-dim);margin-top:4px;">Token: ${token}</div></td>
      <td><span style="font-weight:700;font-size:.78rem;color:${stColor};text-transform:uppercase;">${escapeHtml(st)}</span></td>
      <td>${escapeHtml(formatDate(cert.issue_date))}</td>
      <td><button type="button" class="btn btn-outline btn-sm" data-cert-action="download-qr" data-cert-name="${safeName}" data-cert-id="${id}" data-cert-url="${url}"><i class="fas fa-qrcode"></i> Download QR</button><button type="button" class="btn-action-icon" data-cert-action="copy-token" data-cert-token="${token}" title="Copy token"><i class="fas fa-key"></i></button><button type="button" class="btn-action-icon" data-cert-action="copy-url" data-cert-url="${url}" title="Copy verification link"><i class="fas fa-link"></i></button></td>
      <td>${pdfUrl ? `<a class="btn btn-outline btn-sm" href="${pdfUrl}" download><i class="fas fa-file-pdf"></i> Download File</a>` : `<label class="btn btn-outline btn-sm" style="cursor:pointer;"><i class="fas fa-upload"></i> Upload DOCX / PDF<input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" data-cert-upload="${id}" style="display:none;"></label><div style="font-size:.7rem;color:var(--text-dim);margin-top:3px;">Not uploaded yet</div>`}</td>
      <td><div style="display:inline-flex;gap:.35rem;align-items:center;">${actionBtn}${deleteBtn}</div></td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('[data-cert-upload]').forEach(input => input.addEventListener('change', async () => {
    if (input.files?.[0]) await uploadFinalCertificateDocx(input.dataset.certUpload, input.files[0]);
    input.value = '';
  }));
}

function updateCertPagination(total) {
  const summary = document.getElementById('certsPaginationSummary');
  const previous = document.getElementById('btnPrevCertPage');
  const next = document.getElementById('btnNextCertPage');
  const start = total ? certCurrentPage * CERTS_PAGE_SIZE + 1 : 0;
  if (summary) summary.textContent = `Showing ${start} - ${Math.min((certCurrentPage + 1) * CERTS_PAGE_SIZE, total)} of ${total} records`;
  if (previous) previous.disabled = certCurrentPage === 0;
  if (next) next.disabled = (certCurrentPage + 1) * CERTS_PAGE_SIZE >= total;
}

async function saveCertificate() {
  const form = document.getElementById('certificateEditorForm');
  if (!form?.reportValidity()) return;
  const button = document.getElementById('btnSaveCertificate');
  button.disabled = true;
  const formData = new FormData(form);
  formData.set('action', 'create');
  try {
    let certificate;
    if (isDevStaticMode) {
      const all = getLocalData('certificates') || [];
      const prefixByType = { 'Training Program': 'VYOM-CRS', 'Internship': 'VYOM-INT', 'Hackathon': 'VYOM-HCK', 'Workshop': 'VYOM-WRK', 'Webinar': 'VYOM-EVT', 'Competition': 'VYOM-EVT' };
      const prefix = prefixByType[String(formData.get('program_type') || 'Training Program')] || 'VYOM-CRS';
      const issueDate = String(formData.get('issue_date') || new Date().toISOString().slice(0, 10));
      const year = new Date(`${issueDate}T00:00:00`).getFullYear() || new Date().getFullYear();
      const matcher = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-${year}-(\\d+)(?:-[A-Z0-9]{4})?$`);
      const sequence = all.reduce((max, item) => Math.max(max, Number((item.certificate_id || '').match(matcher)?.[1] || 0)), 0) + 1;
      const certificateId = `${prefix}-${year}-${String(sequence).padStart(4, '0')}`;
      const random = new Uint8Array(16);
      crypto.getRandomValues(random);
      const token = [...random].map(value => value.toString(16).padStart(2, '0')).join('');
      certificate = {
        id: Date.now(), certificate_id: certificateId, verification_token: token,
        verification_url: `${window.location.origin}/verify/?id=${token}`,
        certificate_type: String(formData.get('certificate_type') || 'Completion'),
        program_type: String(formData.get('program_type') || 'Training Program'),
        recognition: String(formData.get('recognition') || 'Completed'), prefix,
        trainer_name: String(formData.get('trainer_name') || 'Santhosh S').trim(),
        trainer_designation: String(formData.get('trainer_designation') || 'Program Lead').trim(),
        signatory_name: String(formData.get('signatory_name') || 'S.B. Sachin').trim(),
        signatory_designation: String(formData.get('signatory_designation') || 'Founder & CEO').trim(),
        recipient_name: String(formData.get('recipient_name') || '').trim(),
        recipient_email: String(formData.get('recipient_email') || '').trim(),
        course_name: String(formData.get('course_name') || '').trim(),
        course_duration: String(formData.get('course_duration') || '1 Month').trim(),
        issue_date: issueDate, completion_date: String(formData.get('completion_date') || issueDate),
        private_notes: String(formData.get('private_notes') || '').trim(), status: 'valid',
        template_id: '1month_python_course',
        issued_by: 'VYOMANTRA TECHNOLOGIES', created_at: new Date().toISOString()
      };
      all.unshift(certificate);
      saveLocalData('certificates', all);
    } else {
      const response = await apiFetch('../api/admin/certificates.php', { method: 'POST', headers: { 'Authorization': `Bearer ${authToken || ''}` }, body: formData });
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.message || 'Could not create the certificate record.');
      certificate = result.data?.certificate;
    }
    if (!certificate) throw new Error('The registry did not return the generated verification details.');
    currentCertificatesList.unshift(certificate);
    form.reset();
    const today = new Date().toISOString().slice(0, 10);
    const issueInput = document.getElementById('certIssueDate');
    const compInput = document.getElementById('certCompletionDate');
    const statusInput = document.getElementById('certStatus');
    const durationInput = document.getElementById('certCourseDuration');
    const mentorNameInput = document.getElementById('certMentorName');
    const mentorTitleInput = document.getElementById('certMentorTitle');
    const signNameInput = document.getElementById('certSignatoryName');
    const signTitleInput = document.getElementById('certSignatoryTitle');
    if (issueInput) issueInput.value = today;
    if (compInput) compInput.value = '';
    if (statusInput) statusInput.value = 'valid';
    if (durationInput) durationInput.value = '1 Month';
    if (mentorNameInput) mentorNameInput.value = 'Santhosh S';
    if (mentorTitleInput) mentorTitleInput.value = 'Program Lead';
    if (signNameInput) signNameInput.value = 'S.B. Sachin';
    if (signTitleInput) signTitleInput.value = 'Founder & CEO';
    document.querySelectorAll('[data-duration-val]').forEach(c => {
      c.classList.toggle('active', c.dataset.durationVal === '1 Month');
    });
    showGeneratedCertificate(certificate);
    showToast(`Verification record ${certificate.certificate_id} created.`);
    await fetchCertificates();
    fetchDashboardStats();
  } catch (error) {
    console.error('Certificate record create failed:', error);
    showToast(error.message || 'Could not create the certificate record.', true);
  } finally {
    button.disabled = false;
  }
}

function showGeneratedCertificate(certificate) {
  latestGeneratedCertificate = certificate;
  const panel = document.getElementById('generatedCertificatePanel');
  const grid = document.getElementById('certWorkflowGrid');
  const id = certificate.certificate_id;
  const url = certificate.verification_url || `${window.location.origin}/verify/?id=${encodeURIComponent(id)}`;
  document.getElementById('generatedCertId').value = id;
  document.getElementById('generatedCertToken').value = certificate.verification_token || '';
  document.getElementById('generatedCertUrl').value = url;
  document.getElementById('generatedPdfStatus').textContent = '';
  const qrBox = document.getElementById('generatedQrBox');
  qrBox.replaceChildren();
  if (typeof QRCode !== 'undefined') new QRCode(qrBox, { text: url, width: 190, height: 190, colorDark: '#07111d', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
  if (panel) panel.style.display = 'block';
  if (grid) grid.classList.add('has-generated');
  document.getElementById('generatedFinalDocx').value = '';
  panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function copyCertificateText(value, successMessage) {
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(String(value || ''));
    else {
      const field = document.createElement('textarea'); field.value = String(value || ''); field.style.position = 'fixed'; field.style.opacity = '0';
      document.body.appendChild(field); field.select();
      if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
      field.remove();
    }
    showToast(successMessage);
  } catch (_) { prompt('Copy this value:', String(value || '')); }
}

function safeQrName(name, id) {
  const safeRecipient = String(name || 'Certificate').normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim() || 'Certificate';
  const safeId = String(id || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
  return `${safeRecipient}_${safeId}.png`;
}

async function downloadCertificateQr(name, id, verificationUrl) {
  if (typeof QRCode === 'undefined') throw new Error('QR generation library is unavailable.');
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;background:#fff;padding:8px;';
  document.body.appendChild(holder);
  new QRCode(holder, { text: verificationUrl, width: 600, height: 600, colorDark: '#07111d', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
  await new Promise(resolve => setTimeout(resolve, 30));
  const canvas = holder.querySelector('canvas');
  let blob;
  if (canvas) blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  else {
    const image = holder.querySelector('img');
    const response = await fetch(image.src);
    blob = await response.blob();
  }
  holder.remove();
  if (!blob) throw new Error('QR image could not be created.');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = safeQrName(name, id); link.click();
  URL.revokeObjectURL(url);
}

function downloadGeneratedQr() {
  if (!latestGeneratedCertificate) return;
  const url = latestGeneratedCertificate.verification_url || `${window.location.origin}/verify/?id=${encodeURIComponent(latestGeneratedCertificate.certificate_id)}`;
  downloadCertificateQr(latestGeneratedCertificate.recipient_name, latestGeneratedCertificate.certificate_id, url)
    .then(() => showToast('Verification QR downloaded.'))
    .catch(error => showToast(error.message, true));
}

async function uploadFinalCertificateDocx(certificateId, file) {
  const isPdf  = /\.pdf$/i.test(file.name);
  const isDocx = /\.docx$/i.test(file.name);
  if (!isPdf && !isDocx) { showToast('Please choose a .pdf or .docx certificate file.', true); return; }
  if (isDevStaticMode && isDocx) { showToast('DOCX upload requires the PHP server. Upload a PDF, or use the live site.', true); return; }
  const status = document.getElementById('generatedPdfStatus');
  if (status) status.textContent = isPdf ? 'Uploading PDF...' : 'Uploading DOCX...';
  const action = isPdf ? 'upload_final_pdf' : 'upload_final_docx';
  const fieldName = isPdf ? 'final_pdf' : 'final_docx';
  const body = new FormData(); body.append('action', action); body.append('id', certificateId); body.append(fieldName, file);
  try {
    const response = await apiFetch('../api/admin/certificates.php', { method: 'POST', headers: { 'Authorization': `Bearer ${authToken || ''}` }, body });
    const result = await response.json();
    if (!response.ok || !result?.success) throw new Error(result?.message || 'Could not upload the certificate file.');
    if (latestGeneratedCertificate?.certificate_id === certificateId) {
      latestGeneratedCertificate.certificate_pdf_url = result.data?.certificate_pdf_url;
      if (status) status.textContent = 'Certificate file ready. It will appear on the public verification page.';
    }
    showToast(isPdf ? 'PDF uploaded and attached.' : 'DOCX uploaded and attached.');
    await fetchCertificates();
  } catch (error) {
    console.error('Certificate file upload failed:', error);
    if (status) status.textContent = error.message || 'Upload failed.';
    showToast(error.message || 'Upload failed.', true);
  }
}

// =========================================================================
// 12. CERTIFICATE FILL ASSISTANT (FIELD VIEWER & ONE-CLICK COPY HELPER)
// =========================================================================
async function openCertFillDetailsModal(certificateId) {
  if (!certificateId) return;

  // Search cached memory
  let cert = currentCertificatesList.find(c => (c.certificate_id === certificateId || String(c.id) === String(certificateId)));

  if (!cert && latestGeneratedCertificate && (latestGeneratedCertificate.certificate_id === certificateId || String(latestGeneratedCertificate.id) === String(certificateId))) {
    cert = latestGeneratedCertificate;
  }

  if (!cert && isDevStaticMode) {
    const all = getLocalData('certificates') || [];
    cert = all.find(c => (c.certificate_id === certificateId || String(c.id) === String(certificateId)));
  }

  // If not found in cache, fetch via API
  if (!cert && !isDevStaticMode) {
    try {
      const res = await apiFetch(`../api/admin/certificates.php?action=list&search=${encodeURIComponent(certificateId)}&limit=1`);
      const result = await res.json().catch(() => null);
      if (result?.success && result?.data?.certificates?.length) {
        cert = result.data.certificates.find(c => c.certificate_id === certificateId || String(c.id) === String(certificateId)) || result.data.certificates[0];
      }
    } catch (e) {
      console.error('Error fetching certificate details', e);
    }
  }

  if (!cert) {
    showToast('Certificate record not found.', true);
    return;
  }

  renderCertFillDetailsModal(cert);
  openAdminModal('certFillDetailsModal');
}

function renderCertFillDetailsModal(cert) {
  const container = document.getElementById('certFillDetailsBody');
  if (!container) return;

  const id = cert.certificate_id || '';
  const recipientName = cert.recipient_name || '';
  const safeName = recipientName || 'Certificate';
  const recipientEmail = cert.recipient_email || '';
  const courseName = cert.course_name || '';
  const certType = cert.certificate_type || 'Completion';
  const certTitleHeader = `Certificate of ${certType}`;
  const programType = cert.program_type || 'Training Program';
  const recognition = cert.recognition || 'Completed';
  const duration = cert.course_duration || '1 Month';
  const mentorName = cert.trainer_name || 'Santhosh S';
  const mentorDesignation = cert.trainer_designation || 'Program Lead';
  const signatoryName = cert.signatory_name || 'S.B. Sachin';
  const signatoryDesignation = cert.signatory_designation || 'Founder & CEO';
  const issueDateRaw = cert.issue_date || '';
  const issueDateFormatted = formatDate(issueDateRaw);
  const completionDateRaw = cert.completion_date || issueDateRaw;
  const completionDateFormatted = formatDate(completionDateRaw);
  const token = cert.verification_token || '';
  const url = cert.verification_url || `${window.location.origin}/verify/?id=${encodeURIComponent(id)}`;
  const notes = cert.private_notes || '';
  const status = String(cert.status || 'valid').toUpperCase();
  const statusColor = status === 'VALID' ? '#22c55e' : (status === 'REVOKED' ? '#ef4444' : '#f59e0b');

  // Text summary ready to paste into Word template / Canva
  const allFormattedText = [
    `=== VYOMANTRA TECHNOLOGIES - CERTIFICATE DATA ===`,
    `Template Match     : assets/1month_python course.docx`,
    `-------------------------------------------------`,
    `[RECIPIENT NAME]   : ${recipientName}`,
    `[PROGRAM / EVENT]  : ${courseName}`,
    `OF [TYPE]          : ${certTitleHeader}`,
    `[PROGRAM TYPE]     : ${programType}`,
    `RECOGNITION: [ROLE]: ${recognition}`,
    `DURATION           : ${duration}`,
    `DATE OF ISSUE      : ${issueDateFormatted} (${issueDateRaw})`,
    `[MENTOR / LEAD]    : ${mentorName} (${mentorDesignation})`,
    `[FOUNDER NAME]     : ${signatoryName} (${signatoryDesignation})`,
    `CERTIFICATE ID     : ${id}`,
    `SCAN TO VERIFY     : ${url}`,
    `SECURITY TOKEN     : ${token}`,
    recipientEmail ? `Candidate Email    : ${recipientEmail}` : '',
    notes ? `Internal Notes     : ${notes}` : '',
    `Record Status      : ${status}`,
    `=================================================`
  ].filter(Boolean).join('\n');

  container.innerHTML = `
    <!-- Top Hero Card with Recipient and Quick Actions -->
    <div style="background: linear-gradient(135deg, rgba(0,240,255,0.08) 0%, rgba(139,92,246,0.06) 100%); border: 1px solid rgba(0,240,255,0.25); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
        <div>
          <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--cyan); font-weight:700; margin-bottom:0.25rem;">
            <i class="fas fa-user-graduate" style="margin-right:4px;"></i> Certificate Recipient <span class="cert-template-tag">[RECIPIENT NAME]</span>
          </div>
          <div style="font-size:1.4rem; font-weight:800; color:#fff; font-family:var(--font-heading); display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
            <span>${escapeHtml(recipientName)}</span>
            <button type="button" class="btn-copy-field" data-copy-val="${escapeHtml(recipientName)}" data-copy-name="Recipient Name" style="padding:3px 10px; font-size:0.75rem; border-radius:20px; border:1px solid rgba(0,240,255,0.4); color:var(--cyan); background:rgba(0,240,255,0.08); cursor:pointer;">
              <i class="fas fa-copy"></i> Copy Name
            </button>
            <span style="font-size:0.72rem; padding:2px 8px; border-radius:12px; background:rgba(34,197,94,0.12); color:${statusColor}; border:1px solid ${statusColor}; font-weight:700;">
              ${escapeHtml(status)}
            </span>
          </div>
          <div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.35rem;">
            ID: <strong style="color:var(--cyan); font-family:var(--font-mono);">${escapeHtml(id)}</strong>
            ${recipientEmail ? ` &bull; <span style="color:var(--text-dim);">${escapeHtml(recipientEmail)}</span>` : ''}
          </div>
        </div>

        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
          <button type="button" class="btn btn-primary btn-sm" id="btnModalCopyAll" style="font-size:0.8rem; padding:0.45rem 0.85rem;">
            <i class="fas fa-copy"></i> Copy All for Word / Canva
          </button>
          <button type="button" class="btn btn-outline btn-sm" id="btnModalDownloadCertQr" style="font-size:0.8rem; padding:0.45rem 0.85rem;">
            <i class="fas fa-qrcode"></i> Download QR PNG
          </button>
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="font-size:0.8rem; padding:0.45rem 0.85rem; text-decoration:none;">
            <i class="fas fa-external-link-alt"></i> Verify Page
          </a>
        </div>
      </div>
    </div>

    <!-- Section 1: Exact Text Needed on Certificate Template -->
    <div style="margin-bottom:1.5rem;">
      <h4 style="margin:0 0 0.75rem; font-size:0.92rem; text-transform:uppercase; letter-spacing:0.06em; color:#fff; display:flex; align-items:center; gap:0.45rem;">
        <i class="fas fa-pen-fancy" style="color:var(--cyan);"></i> Certificate Template Fields (Matches 1month_python course.docx)
      </h4>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:0.85rem;">

        <!-- Recipient Name -->
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-admin); border-radius:8px; padding:0.85rem 1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:600;">Candidate Name <span class="cert-template-tag">[RECIPIENT NAME]</span></span>
            <button type="button" class="btn-copy-field" data-copy-val="${escapeHtml(recipientName)}" data-copy-name="Recipient Name" style="background:rgba(0,240,255,0.08); border:1px solid rgba(0,240,255,0.25); color:var(--cyan); border-radius:4px; font-size:0.72rem; padding:2px 7px; cursor:pointer;">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
          <div style="font-size:1.05rem; font-weight:700; color:#fff;">${escapeHtml(recipientName)}</div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Under &ldquo;PROUDLY PRESENTED TO&rdquo;</div>
        </div>

        <!-- Course / Program Name -->
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-admin); border-radius:8px; padding:0.85rem 1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:600;">Course Title <span class="cert-template-tag">[PROGRAM / EVENT NAME]</span></span>
            <button type="button" class="btn-copy-field" data-copy-val="${escapeHtml(courseName)}" data-copy-name="Program Title" style="background:rgba(0,240,255,0.08); border:1px solid rgba(0,240,255,0.25); color:var(--cyan); border-radius:4px; font-size:0.72rem; padding:2px 7px; cursor:pointer;">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
          <div style="font-size:1rem; font-weight:700; color:var(--cyan);">${escapeHtml(courseName)}</div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Under &ldquo;in recognition of&rdquo;</div>
        </div>

        <!-- Certificate Type Header -->
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-admin); border-radius:8px; padding:0.85rem 1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:600;">Title Header <span class="cert-template-tag">OF [TYPE]</span></span>
            <button type="button" class="btn-copy-field" data-copy-val="${escapeHtml(certTitleHeader)}" data-copy-name="Certificate Header" style="background:rgba(0,240,255,0.08); border:1px solid rgba(0,240,255,0.25); color:var(--cyan); border-radius:4px; font-size:0.72rem; padding:2px 7px; cursor:pointer;">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
          <div style="font-size:0.95rem; font-weight:700; color:#fff;">${escapeHtml(certTitleHeader)}</div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Top main header line</div>
        </div>

        <!-- Program Type & Recognition -->
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-admin); border-radius:8px; padding:0.85rem 1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:600;">Role &amp; Category <span class="cert-template-tag">RECOGNITION: [RESULT]</span></span>
            <button type="button" class="btn-copy-field" data-copy-val="${escapeHtml(programType + ' - ' + recognition)}" data-copy-name="Program Type & Recognition" style="background:rgba(0,240,255,0.08); border:1px solid rgba(0,240,255,0.25); color:var(--cyan); border-radius:4px; font-size:0.72rem; padding:2px 7px; cursor:pointer;">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
          <div style="font-size:0.95rem; font-weight:700; color:#fff;">${escapeHtml(programType)} &bull; ${escapeHtml(recognition)}</div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Under course title in metadata row</div>
        </div>

        <!-- Duration -->
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-admin); border-radius:8px; padding:0.85rem 1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:600;">Duration <span class="cert-template-tag">DURATION: [DURATION]</span></span>
            <button type="button" class="btn-copy-field" data-copy-val="${escapeHtml(duration)}" data-copy-name="Duration" style="background:rgba(0,240,255,0.08); border:1px solid rgba(0,240,255,0.25); color:var(--cyan); border-radius:4px; font-size:0.72rem; padding:2px 7px; cursor:pointer;">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
          <div style="font-size:0.95rem; font-weight:700; color:#fff;">${escapeHtml(duration)}</div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Middle metadata badge</div>
        </div>

        <!-- Issue Date -->
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-admin); border-radius:8px; padding:0.85rem 1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:600;">Date of Issue <span class="cert-template-tag">DATE OF ISSUE: [DD MMM YYYY]</span></span>
            <div style="display:flex; gap:0.25rem;">
              <button type="button" class="btn-copy-field" data-copy-val="${escapeHtml(issueDateFormatted)}" data-copy-name="Formatted Date" title="Copy formatted (e.g. 04 Oct 2026)" style="background:rgba(0,240,255,0.08); border:1px solid rgba(0,240,255,0.25); color:var(--cyan); border-radius:4px; font-size:0.72rem; padding:2px 7px; cursor:pointer;">
                <i class="fas fa-copy"></i> Formatted
              </button>
              <button type="button" class="btn-copy-field" data-copy-val="${escapeHtml(issueDateRaw)}" data-copy-name="Raw Date" title="Copy ISO date (YYYY-MM-DD)" style="background:rgba(255,255,255,0.05); border:1px solid var(--border-admin); color:var(--text-muted); border-radius:4px; font-size:0.72rem; padding:2px 7px; cursor:pointer;">
                Raw
              </button>
            </div>
          </div>
          <div style="font-size:0.95rem; font-weight:700; color:#fff;">${escapeHtml(issueDateFormatted)} <span style="font-size:0.78rem; font-weight:400; color:var(--text-dim);">(${escapeHtml(issueDateRaw)})</span></div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Issued date pill on template</div>
        </div>

        <!-- Mentor / Program Lead -->
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-admin); border-radius:8px; padding:0.85rem 1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:600;">Left Signatory <span class="cert-template-tag">[MENTOR / LEAD NAME]</span></span>
            <button type="button" class="btn-copy-field" data-copy-val="${escapeHtml(mentorName)}" data-copy-name="Mentor Name" style="background:rgba(0,240,255,0.08); border:1px solid rgba(0,240,255,0.25); color:var(--cyan); border-radius:4px; font-size:0.72rem; padding:2px 7px; cursor:pointer;">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
          <div style="font-size:0.95rem; font-weight:700; color:#fff;">${escapeHtml(mentorName)}</div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Above <strong>${escapeHtml(mentorDesignation).toUpperCase()}</strong> &bull; VYOMANTRA</div>
        </div>

        <!-- Authorized Signatory / Founder & CEO -->
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-admin); border-radius:8px; padding:0.85rem 1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:600;">Right Signatory <span class="cert-template-tag">[FOUNDER NAME]</span></span>
            <button type="button" class="btn-copy-field" data-copy-val="${escapeHtml(signatoryName)}" data-copy-name="Signatory Name" style="background:rgba(0,240,255,0.08); border:1px solid rgba(0,240,255,0.25); color:var(--cyan); border-radius:4px; font-size:0.72rem; padding:2px 7px; cursor:pointer;">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
          <div style="font-size:0.95rem; font-weight:700; color:#fff;">${escapeHtml(signatoryName)}</div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Above <strong>${escapeHtml(signatoryDesignation).toUpperCase()}</strong> &bull; VYOMANTRA</div>
        </div>

      </div>
    </div>

    <!-- Section 2: Verification, QR & Security Metadata -->
    <div style="display:grid; grid-template-columns:minmax(280px, 1.3fr) minmax(220px, 0.7fr); gap:1.25rem; align-items:start;">
      
      <!-- Security Credential Fields -->
      <div>
        <h4 style="margin:0 0 0.75rem; font-size:0.92rem; text-transform:uppercase; letter-spacing:0.06em; color:#fff; display:flex; align-items:center; gap:0.45rem;">
          <i class="fas fa-shield-alt" style="color:var(--cyan);"></i> Verification &amp; Security Credentials
        </h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem;">

          <!-- Certificate ID -->
          <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-admin); border-radius:8px; padding:0.75rem 0.9rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
              <span style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase; font-weight:600;">Certificate ID (Serial No.)</span>
              <button type="button" class="btn-copy-field" data-copy-val="${escapeHtml(id)}" data-copy-name="Certificate ID" style="background:rgba(0,240,255,0.08); border:1px solid rgba(0,240,255,0.25); color:var(--cyan); border-radius:4px; font-size:0.72rem; padding:2px 7px; cursor:pointer;">
                <i class="fas fa-copy"></i> Copy ID
              </button>
            </div>
            <div style="font-family:var(--font-mono); font-size:0.95rem; font-weight:700; color:var(--cyan);">${escapeHtml(id)}</div>
            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Printed near QR code on certificate</div>
          </div>

          <!-- Public Verification URL -->
          <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-admin); border-radius:8px; padding:0.75rem 0.9rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
              <span style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase; font-weight:600;">Verification URL</span>
              <button type="button" class="btn-copy-field" data-copy-val="${escapeHtml(url)}" data-copy-name="Verification URL" style="background:rgba(0,240,255,0.08); border:1px solid rgba(0,240,255,0.25); color:var(--cyan); border-radius:4px; font-size:0.72rem; padding:2px 7px; cursor:pointer;">
                <i class="fas fa-copy"></i> Copy Link
              </button>
            </div>
            <div style="font-family:var(--font-mono); font-size:0.8rem; color:#fff; word-break:break-all;">${escapeHtml(url)}</div>
            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">URL opened when student scans the QR code</div>
          </div>

          <!-- Verification Token -->
          <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-admin); border-radius:8px; padding:0.75rem 0.9rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
              <span style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase; font-weight:600;">Security Token</span>
              <button type="button" class="btn-copy-field" data-copy-val="${escapeHtml(token)}" data-copy-name="Security Token" style="background:rgba(0,240,255,0.08); border:1px solid rgba(0,240,255,0.25); color:var(--cyan); border-radius:4px; font-size:0.72rem; padding:2px 7px; cursor:pointer;">
                <i class="fas fa-copy"></i> Copy Token
              </button>
            </div>
            <div style="font-family:var(--font-mono); font-size:0.78rem; color:var(--text-muted); word-break:break-all;">${escapeHtml(token || 'N/A')}</div>
          </div>

          <!-- Private Notes (if any) -->
          ${notes ? `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-admin); border-radius:8px; padding:0.75rem 0.9rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                <span style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase; font-weight:600;">Internal Admin Notes</span>
                <button type="button" class="btn-copy-field" data-copy-val="${escapeHtml(notes)}" data-copy-name="Admin Notes" style="background:rgba(0,240,255,0.08); border:1px solid rgba(0,240,255,0.25); color:var(--cyan); border-radius:4px; font-size:0.72rem; padding:2px 7px; cursor:pointer;">
                  <i class="fas fa-copy"></i> Copy
                </button>
              </div>
              <div style="font-size:0.85rem; color:#fff;">${escapeHtml(notes)}</div>
            </div>
          ` : ''}

        </div>
      </div>

      <!-- Live QR Code Widget & Download -->
      <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-admin); border-radius:10px; padding:1.25rem; text-align:center;">
        <h4 style="margin:0 0 0.5rem; font-size:0.88rem; text-transform:uppercase; letter-spacing:0.06em; color:#fff;">
          <i class="fas fa-qrcode" style="color:var(--cyan);"></i> Certificate QR Code
        </h4>
        <p style="margin:0 0 0.85rem; font-size:0.75rem; color:var(--text-muted);">
          Insert this QR image onto your certificate template for 1-click verification.
        </p>

        <div id="modalCertQrPreviewBox" style="display:flex; justify-content:center; align-items:center; background:#ffffff; border-radius:8px; padding:10px; width:max-content; margin:0 auto 1rem; box-shadow:0 4px 15px rgba(0,0,0,0.4);">
          <!-- QR Canvas / Img renders here -->
        </div>

        <button type="button" class="btn btn-primary btn-sm" id="btnModalDownloadQrInWidget" style="width:100%; margin-bottom:0.5rem; font-size:0.82rem; padding:0.45rem;">
          <i class="fas fa-download"></i> Download QR PNG (600x600)
        </button>
        <button type="button" class="btn btn-outline btn-sm btn-copy-field" data-copy-val="${escapeHtml(url)}" data-copy-name="QR Verification Link" style="width:100%; font-size:0.8rem; padding:0.4rem;">
          <i class="fas fa-link"></i> Copy QR Link
        </button>
      </div>

    </div>
  `;

  // Render QR Code in modal widget
  const qrBox = document.getElementById('modalCertQrPreviewBox');
  if (qrBox && typeof QRCode !== 'undefined') {
    qrBox.replaceChildren();
    new QRCode(qrBox, {
      text: url,
      width: 160,
      height: 160,
      colorDark: '#07111d',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  // Bind single field copy buttons inside modal
  container.querySelectorAll('.btn-copy-field').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const val = btn.dataset.copyVal || '';
      const name = btn.dataset.copyName || 'Value';
      await copyCertificateText(val, `${name} copied to clipboard`);
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `<i class="fas fa-check" style="color:#22c55e;"></i> Copied!`;
      setTimeout(() => { btn.innerHTML = originalHtml; }, 1500);
    });
  });

  // Bind "Copy All" button
  const copyAllBtn = document.getElementById('btnModalCopyAll');
  if (copyAllBtn) {
    copyAllBtn.addEventListener('click', async () => {
      await copyCertificateText(allFormattedText, 'All certificate fields copied for Canva/Word!');
      const orig = copyAllBtn.innerHTML;
      copyAllBtn.innerHTML = `<i class="fas fa-check" style="color:#22c55e;"></i> All Copied!`;
      setTimeout(() => { copyAllBtn.innerHTML = orig; }, 1800);
    });
  }

  // Bind QR Download buttons
  const triggerQrDownload = async () => {
    try {
      await downloadCertificateQr(safeName, id, url);
      showToast('High-resolution QR code downloaded.');
    } catch (err) {
      showToast(err.message || 'QR download failed', true);
    }
  };

  document.getElementById('btnModalDownloadCertQr')?.addEventListener('click', triggerQrDownload);
  document.getElementById('btnModalDownloadQrInWidget')?.addEventListener('click', triggerQrDownload);
}

// Explicit Window Method Bindings for Inline HTML Event Compatibility
window.openCourseModal = openCourseModal;
window.deleteCourse = deleteCourse;
window.updateCourseStatus = updateCourseStatus;
window.handleSaveCourse = handleSaveCourse;
window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.deleteCertificate = deleteCertificate;
window.openCertFillDetailsModal = openCertFillDetailsModal;

// Install the click router as soon as this body-end script loads. It must not
// depend on the async authentication/setup path finishing first.
document.addEventListener('click', handleCertificateAction);

window.fetchCourses = fetchCourseRegistrations;
window.fetchCourseRegistrations = fetchCourseRegistrations;
