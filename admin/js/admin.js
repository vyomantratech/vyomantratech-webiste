/**
 * Vyomantra Technologies - Admin Control Center Engine
 * Unified Dual-Mode Architecture:
 * - Live Mode: Connects to Hostinger PHP MySQL REST APIs (/api/admin/*.php)
 * - Static Dev Mode: Seamless localStorage persistence for VS Code Live Server (127.0.0.1:5500)
 */

// Global State
let currentAdminUser = null;
let authToken = null;
let activeTab = 'stats';
let monthlyChartInstance = null;
let courseChartInstance = null;
let isDevStaticMode = false;

// =========================================================================
// 1. INITIALIZATION & DUAL-MODE AUTH GUARD
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  authToken = localStorage.getItem('vyomantra_admin_token');

  if (!authToken) {
    window.location.href = 'index.html';
    return;
  }

  // Detect static dev server (e.g. VS Code Live Server 127.0.0.1, localhost, any port, or mock token)
  if (authToken.startsWith('mock_token_') || authToken.startsWith('local_') || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:') {
    isDevStaticMode = true;
    currentAdminUser = JSON.parse(localStorage.getItem('vyomantra_admin_user') || '{"username":"admin","full_name":"Vyomantra Administrator","role":"super_admin"}');
    populateHeaderUser(currentAdminUser);
    initLocalSeedData();
  } else {
    // Verify Token with backend
    try {
      const res = await fetch('../api/admin/auth.php', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Bearer ' + authToken
        },
        body: 'action=verify&token=' + encodeURIComponent(authToken)
      });

      if (res.status === 405 || res.status === 404 || !res.ok) {
        // Static server without PHP runtime
        isDevStaticMode = true;
        currentAdminUser = JSON.parse(localStorage.getItem('vyomantra_admin_user') || '{"username":"admin","full_name":"Vyomantra Administrator","role":"super_admin"}');
        populateHeaderUser(currentAdminUser);
        initLocalSeedData();
      } else {
        const result = await res.json().catch(() => null);
        if (!result || !result.success) {
          localStorage.removeItem('vyomantra_admin_token');
          localStorage.removeItem('vyomantra_admin_user');
          window.location.href = 'index.html';
          return;
        }
        currentAdminUser = result.data.user || {};
        populateHeaderUser(currentAdminUser);
      }
    } catch (err) {
      isDevStaticMode = true;
      currentAdminUser = JSON.parse(localStorage.getItem('vyomantra_admin_user') || '{"username":"admin","full_name":"Vyomantra Administrator","role":"super_admin"}');
      populateHeaderUser(currentAdminUser);
      initLocalSeedData();
    }
  }

  // Setup UI event listeners
  initSidebarTabs();
  initLogout();
  initRefresh();
  initContactsFilters();
  initCoursesFilters();
  initQuotesFilters();
  initApplicantsFilters();
  initJobsCMS();

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
        await fetch('../api/admin/auth.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'action=logout&token=' + encodeURIComponent(authToken)
        });
      }
    } catch (e) {}
    localStorage.removeItem('vyomantra_admin_token');
    localStorage.removeItem('vyomantra_admin_user');
    window.location.href = 'index.html';
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
    'courses': { title: '<i class="fas fa-user-graduate" style="color:var(--cyan);"></i> Course Admissions & Payments', subtitle: 'Verify student UPI/QR payment proofs and manage enrollment access.' },
    'applicants': { title: '<i class="fas fa-users-cog" style="color:var(--cyan);"></i> Job & Internship Applicants', subtitle: 'Review candidate resumes, portfolios, and interview pipelines.' },
    'jobs': { title: '<i class="fas fa-briefcase" style="color:var(--cyan);"></i> Job Postings & CMS', subtitle: 'Publish new roles, update active openings, and generate subpages.' }
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
    case 'courses':
      return fetchCourses();
    case 'applicants':
      return fetchApplicants();
    case 'jobs':
      return fetchJobs();
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
    const res = await fetch('../api/admin/stats.php', {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });
    if (res.status === 405) {
      isDevStaticMode = true;
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
    isDevStaticMode = true;
    renderLocalStats();
  }
}

function updateStatsUI(data) {
  document.getElementById('statContactsTotal').textContent = data.contacts.total || 0;
  document.getElementById('statContactsNew').textContent = (data.contacts.new || 0) + ' New';

  document.getElementById('statQuotesTotal').textContent = data.quotes.total || 0;
  document.getElementById('statQuotesNew').textContent = (data.quotes.new || 0) + ' New';

  document.getElementById('statCoursesTotal').textContent = data.courses.total || 0;
  document.getElementById('statCoursesRevenue').textContent = '₹' + Number(data.courses.total_revenue || 0).toLocaleString('en-IN');

  document.getElementById('statApplicantsTotal').textContent = data.careers.total_applicants || 0;
  document.getElementById('statApplicantsReviewing').textContent = (data.careers.applied || 0) + ' New';

  document.getElementById('statJobsActive').textContent = data.jobs.active || 6;

  document.getElementById('countBadgeContacts').textContent = data.contacts.new || 0;
  document.getElementById('countBadgeQuotes').textContent = data.quotes.new || 0;
  document.getElementById('countBadgeCourses').textContent = data.courses.pending || 0;
  document.getElementById('countBadgeApplicants').textContent = data.careers.applied || 0;
  document.getElementById('countBadgeJobs').textContent = data.jobs.active || 6;

  renderMonthlyChart(data.charts.monthly);
  renderCoursesChart(data.charts.courses_breakdown);
  renderActivityStream(data.activity || []);
}

function renderLocalStats() {
  const contacts = getLocalData('contacts');
  const quotes = getLocalData('quotes');
  const courses = getLocalData('courses');
  const applicants = getLocalData('applicants');
  const jobs = getLocalData('jobs');

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

  const data = {
    contacts: { total: contacts.length, new: contactsNew },
    quotes: { total: quotes.length, new: quotesNew },
    courses: { total: courses.length, pending: coursesPending, total_revenue: revenue },
    careers: { total_applicants: applicants.length, applied: applicantsApplied },
    jobs: { total_postings: jobs.length, active: jobsActive },
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
      const res = await fetch(`../api/admin/contacts.php?action=list&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`, {
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
    const res = await fetch('../api/admin/contacts.php', {
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
    const res = await fetch('../api/admin/contacts.php', {
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
function initCoursesFilters() {
  const statusSelect = document.getElementById('filterCourseStatus');
  const programSelect = document.getElementById('filterCourseProgram');
  const searchInput = document.getElementById('searchCourses');

  if (statusSelect) statusSelect.addEventListener('change', fetchCourses);
  if (programSelect) programSelect.addEventListener('change', fetchCourses);
  if (searchInput) searchInput.addEventListener('input', debounce(fetchCourses, 300));
}

async function fetchCourses() {
  const status = document.getElementById('filterCourseStatus')?.value || 'all';
  const course = document.getElementById('filterCourseProgram')?.value || 'all';
  const search = document.getElementById('searchCourses')?.value || '';
  const tbody = document.getElementById('coursesTableBody');

  let list = [];

  if (!isDevStaticMode) {
    try {
      const res = await fetch(`../api/admin/courses.php?action=list&status=${encodeURIComponent(status)}&course=${encodeURIComponent(course)}&search=${encodeURIComponent(search)}`, {
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
    const res = await fetch('../api/admin/courses.php', {
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
    const res = await fetch('../api/admin/courses.php', {
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
      const res = await fetch(`../api/admin/quotes.php?action=list&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`, {
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
    const res = await fetch('../api/admin/quotes.php', {
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
    const res = await fetch('../api/admin/quotes.php', {
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
      const res = await fetch(`../api/admin/applicants.php?action=list&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`, {
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
    const res = await fetch('../api/admin/applicants.php', {
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
    const res = await fetch('../api/admin/applicants.php', {
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
      const res = await fetch(`../api/admin/jobs.php?action=list&status=${encodeURIComponent(status)}&category=${encodeURIComponent(category)}&search=${encodeURIComponent(search)}`, {
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
    const res = await fetch('../api/admin/jobs.php', {
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
    const res = await fetch('../api/admin/jobs.php', {
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
    const res = await fetch('../api/admin/jobs.php', {
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
  if (!localStorage.getItem('vyomantra_admin_contacts')) {
    saveLocalData('contacts', [
      {
        id: 1,
        name: 'Arun Prakash',
        email: 'arun@prakashind.com',
        phone: '+91 98401 23456',
        service: 'AI & Machine Learning',
        message: 'Looking for an enterprise AI consultation to automate invoice processing and factory defect analysis.',
        status: 'new',
        created_at: '2026-09-29 09:30:00'
      },
      {
        id: 2,
        name: 'Meenakshi Sundaram',
        email: 'meenakshi@gmail.com',
        phone: '+91 94432 98765',
        service: 'ERP & CRM Solutions',
        message: 'Need a customized retail billing and multi-warehouse inventory engine similar to StockMitra.',
        status: 'contacted',
        created_at: '2026-09-28 14:15:00'
      },
      {
        id: 3,
        name: 'Kevin Smith',
        email: 'kevin@techglobal.io',
        phone: '+1 415 555 0192',
        service: 'Web Development',
        message: 'Need high-concurrency Next.js frontend with Tailwind and payment gateway integration.',
        status: 'resolved',
        created_at: '2026-09-27 16:45:00'
      }
    ]);
  }

  if (!localStorage.getItem('vyomantra_admin_quotes')) {
    saveLocalData('quotes', [
      {
        id: 1,
        name: 'Rajesh Kannan',
        company: 'Apex Logistics Ltd',
        email: 'rajesh@apexlogistics.in',
        phone: '+91 98940 11223',
        service: 'Custom Software',
        project_type: 'Logistics ERP & Fleet GPS Telemetry',
        budget: '₹1,50,000 - ₹3,00,000',
        timeline: '2 - 3 Months',
        description: 'Real-time fleet tracking, driver dispatch console, automated waybill generation, and client portal.',
        status: 'proposal_sent',
        created_at: '2026-09-28 11:20:00'
      },
      {
        id: 2,
        name: 'Deepak Verma',
        company: 'Nexus Healthcare',
        email: 'deepak@nexushealth.org',
        phone: '+91 94441 55667',
        service: 'AI Solutions',
        project_type: 'Patient Intake & Triage Bot',
        budget: '₹3,00,000 - ₹5,00,000',
        timeline: '1 - 2 Months',
        description: 'Multi-lingual intake assistant with automated EHR summary generation and appointment scheduling.',
        status: 'new',
        created_at: '2026-09-29 08:45:00'
      }
    ]);
  }

  if (!localStorage.getItem('vyomantra_admin_courses')) {
    saveLocalData('courses', [
      {
        id: 1,
        student_name: 'Vignesh S',
        email: 'vignesh.tech@gmail.com',
        phone: '+91 82481 12345',
        course_name: 'Full-Stack Web Development',
        course_mode: 'Live Online',
        amount_paid: 649.00,
        reference_number: 'UPI-629837190241',
        screenshot_filepath: 'assets/icons/payment_qr.png',
        payment_status: 'pending_verification',
        created_at: '2026-09-29 08:30:00'
      },
      {
        id: 2,
        student_name: 'Kavitha R',
        email: 'kavitha.r@gmail.com',
        phone: '+91 97890 54321',
        course_name: 'Python & Backend Engineering',
        course_mode: 'Live Online',
        amount_paid: 649.00,
        reference_number: 'UPI-829103948123',
        screenshot_filepath: 'assets/icons/payment_qr.png',
        payment_status: 'verified',
        created_at: '2026-09-28 17:40:00'
      }
    ]);
  }

  if (!localStorage.getItem('vyomantra_admin_applicants')) {
    saveLocalData('applicants', [
      {
        id: 1,
        name: 'Suresh Balaji',
        email: 'suresh.b@gmail.com',
        phone: '+91 98412 34567',
        role_applied: 'Full-Stack Software Engineer',
        experience: '2 Years',
        portfolio_url: 'https://github.com',
        resume_filepath: 'uploads/resumes/',
        resume_filename: 'Suresh_CV.pdf',
        message: 'Built high-performance full stack web apps with Next.js, Node, and PostgreSQL. Eager to contribute to StockMitra.',
        status: 'applied',
        created_at: '2026-09-28 15:10:00'
      },
      {
        id: 2,
        name: 'Divya N',
        email: 'divya.n@gmail.com',
        phone: '+91 99401 87654',
        role_applied: 'UI/UX & Product Designer',
        experience: '1 Year',
        portfolio_url: 'https://behance.net',
        resume_filepath: 'uploads/resumes/',
        resume_filename: 'Divya_Portfolio.pdf',
        message: 'Designed Figma design systems, responsive SaaS portals, and mobile app flows.',
        status: 'reviewing',
        created_at: '2026-09-27 18:25:00'
      }
    ]);
  }

  // Pre-load jobs from ../data/jobs.json if not present
  if (!localStorage.getItem('vyomantra_admin_jobs')) {
    fetch('../data/jobs.json')
      .then(res => res.json())
      .then(jobs => {
        if (Array.isArray(jobs) && jobs.length > 0) {
          saveLocalData('jobs', jobs);
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
    case 'active':
    case 'offered': return 'badge-verified';
    case 'pending_verification':
    case 'reviewing': return 'badge-pending';
    case 'rejected':
    case 'closed': return 'badge-rejected';
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
