/**
 * Vyomantra Technologies - Public Certificate Verification Engine
 * Handles QR scan landing, manual ID lookup, verification status rendering,
 * certificate record verification and download of the uploaded certificate PDF.
 */

// Clean Extensionless URLs: Strip .html immediately from browser address bar
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

let currentCertData = null;

document.addEventListener('DOMContentLoaded', () => {
  // Check URL parameters for direct lookup (?id=VYOM-...)
  const urlParams = new URLSearchParams(window.location.search);
  let certId = urlParams.get('id');

  // Also check pathname for clean routing /verify/VYOM-PY-2026-00001
  if (!certId) {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && lastPart.toUpperCase().startsWith('VYOM-')) {
      certId = lastPart;
    }
  }

  if (certId) {
    // Auto-fill input and verify
    const inputEl = document.getElementById('certInputId');
    if (inputEl) inputEl.value = certId;
    verifyCertificate(certId, 'QR_SCAN');
  } else {
    showSearchView();
  }
});

// Manual search form submit
function handleManualSearch() {
  const inputEl = document.getElementById('certInputId');
  const certId = inputEl ? inputEl.value.trim() : '';
  if (!certId) return;

  // Update URL without page reload
  const newUrl = window.location.protocol + '//' + window.location.host + window.location.pathname + '?id=' + encodeURIComponent(certId);
  window.history.pushState({ path: newUrl }, '', newUrl);

  verifyCertificate(certId, 'MANUAL_ID');
}

// Main verification request (server is the only source of truth)
async function verifyCertificate(certId, method = 'MANUAL_ID') {
  showLoadingView();

  try {
    const endpoint = `../api/verify.php?id=${encodeURIComponent(certId)}&method=${encodeURIComponent(method)}`;
    const res = await fetch(endpoint, { method: 'GET', headers: { 'Accept': 'application/json' } });
    const data = await res.json().catch(() => null);

    if (res.status === 429) {
      renderNotFoundState(certId, 'Too many attempts. Please wait a minute and try again.');
      return;
    }
    if (res.ok && data && data.data && data.data.status) {
      renderVerifiedCertificate(data.data, data.message);
      return;
    }
    renderNotFoundState(certId, 'No certificate found with this ID. It may be invalid.');
  } catch (err) {
    renderNotFoundState(certId, 'We could not reach the verification service. Please try again.');
  }
}

// Render verified certificate
function renderVerifiedCertificate(cert, customMsg) {
  currentCertData = cert;
  hideLoadingView();

  const searchSec = document.getElementById('searchViewSection');
  const resultSec = document.getElementById('verifyResultSection');
  if (searchSec) searchSec.style.display = 'none';
  if (resultSec) resultSec.style.display = 'block';

  const status = (cert.status || 'valid').toLowerCase();
  const gridEl = document.getElementById('detailsGrid');
  if (gridEl) gridEl.style.display = '';

  // Status Banner
  const banner = document.getElementById('statusBanner');
  const headline = document.getElementById('statusHeadline');
  const desc = document.getElementById('statusDescription');
  const icon = document.getElementById('statusIcon');
  const pill = document.getElementById('statusPill');
  const ribbon = document.getElementById('certRibbon');

  if (banner) {
    banner.className = `status-banner ${status}`;
  }

  if (status === 'valid') {
    headline.textContent = 'Certificate Verified';
    desc.textContent = 'This certificate was officially issued by VYOMANTRA TECHNOLOGIES and is authentic & active in our official credential registry.';
    icon.className = 'fas fa-check-circle';
    pill.textContent = 'VALID';
    pill.style.color = '#10b981';
    if (ribbon) ribbon.style.display = 'none';
  } else if (status === 'revoked') {
    headline.textContent = 'Certificate Revoked';
    desc.textContent = 'This certificate has been revoked by VYOMANTRA TECHNOLOGIES and is no longer valid.';
    icon.className = 'fas fa-exclamation-triangle';
    pill.textContent = 'REVOKED';
    pill.style.color = '#ef4444';
    if (ribbon) {
      ribbon.className = 'cert-status-ribbon revoked';
      ribbon.textContent = 'REVOKED';
      ribbon.style.display = 'block';
    }
  } else if (status === 'expired') {
    headline.textContent = 'Certificate Expired';
    desc.textContent = 'The validity period for this credential has elapsed.';
    icon.className = 'fas fa-clock';
    pill.textContent = 'EXPIRED';
    pill.style.color = '#f59e0b';
    if (ribbon) {
      ribbon.className = 'cert-status-ribbon expired';
      ribbon.textContent = 'EXPIRED';
      ribbon.style.display = 'block';
    }
  }

  // Populate Key Details Grid (revoked certificates show status only)
  const showDetails = status !== 'revoked';
  document.querySelectorAll('#detailsGrid [data-detail]').forEach(el => { el.style.display = showDetails ? '' : 'none'; });
  setText('resCertId', cert.certificate_id);
  setText('resIssuedBy', cert.issued_by || 'VYOMANTRA TECHNOLOGIES');
  if (showDetails) {
    setText('resRecipientName', cert.recipient_name);
    setText('resCertType', cert.certificate_type);
    setText('resCourseName', cert.program_name);
    setText('resProgramType', cert.program_type);
    setText('resRecognition', cert.recognition);
    setText('resDuration', cert.duration);
    setText('resIssueDate', formatDate(cert.issue_date));
  }

  // Digital copy download button: works for both PDF and DOCX uploads
  const pdfLink = document.getElementById('downloadUploadedCertificatePdf');
  const pdfNote = document.getElementById('certificatePdfPendingNote');
  const hasFile = Boolean(cert.pdf_available && cert.download_url && status === 'valid');
  if (pdfLink) {
    if (hasFile) {
      const isDocx = (cert.file_type === 'docx');
      const icon   = isDocx ? 'fa-file-word' : 'fa-file-pdf';
      const label  = isDocx ? 'Download Certificate (DOCX)' : 'Download Certificate (PDF)';
      pdfLink.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
      pdfLink.href = cert.download_url;
      pdfLink.setAttribute('download', '');
      pdfLink.style.display = 'inline-flex';
    } else {
      pdfLink.style.display = 'none';
    }
  }
  if (pdfNote) pdfNote.style.display = status === 'valid' && !hasFile ? 'inline' : 'none';
  // Update Page Title
  document.title = `Certificate ${cert.certificate_id} | VYOMANTRA TECHNOLOGIES`;

  // Scroll smoothly to results
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Render Not Found state
function renderNotFoundState(certId, msg) {
  hideLoadingView();

  const searchSec = document.getElementById('searchViewSection');
  const resultSec = document.getElementById('verifyResultSection');
  if (searchSec) searchSec.style.display = 'none';
  if (resultSec) resultSec.style.display = 'block';

  // Banner
  const banner = document.getElementById('statusBanner');
  const headline = document.getElementById('statusHeadline');
  const desc = document.getElementById('statusDescription');
  const icon = document.getElementById('statusIcon');
  const pill = document.getElementById('statusPill');

  if (banner) banner.className = 'status-banner not_found';
  headline.textContent = 'Certificate Not Found';
  desc.textContent = msg || `No official credential matches Certificate ID "${certId}". Please check the ID and try again.`;
  icon.className = 'fas fa-times-circle';
  pill.textContent = 'NOT FOUND';
  pill.style.color = '#ef4444';

  const grid = document.getElementById('detailsGrid');
  if (grid) grid.style.display = 'none';
  const pdfLink = document.getElementById('downloadUploadedCertificatePdf');
  const pdfNote = document.getElementById('certificatePdfPendingNote');
  if (pdfLink) pdfLink.style.display = 'none';
  if (pdfNote) pdfNote.style.display = 'none';

  document.title = `Certificate Not Found (${certId}) | VYOMANTRA TECHNOLOGIES`;
}

// Show / Hide Views
function showSearchView() {
  document.getElementById('searchViewSection').style.display = 'block';
  document.getElementById('verifyResultSection').style.display = 'none';
  document.getElementById('verifyLoadingSection').style.display = 'none';
  document.title = 'Official Certificate Verification | VYOMANTRA TECHNOLOGIES';
  const inputEl = document.getElementById('certInputId');
  if (inputEl) {
    inputEl.value = '';
    inputEl.focus();
  }
}

function showLoadingView() {
  document.getElementById('searchViewSection').style.display = 'none';
  document.getElementById('verifyResultSection').style.display = 'none';
  document.getElementById('verifyLoadingSection').style.display = 'block';
}

function hideLoadingView() {
  document.getElementById('verifyLoadingSection').style.display = 'none';
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = (value === undefined || value === null || value === '') ? '--' : value;
}

// Date Formatter
function formatDate(dateStr) {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

// Copy Shareable URL
function copyVerificationShareUrl() {
  if (!currentCertData) return;
  const siteOrigin = window.location.origin;
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Verification URL copied to clipboard.');
  }).catch(() => {
    prompt('Copy Certificate Verification URL:', url);
  });
}

// Toast notification helper
function showToast(msg) {
  const toast = document.getElementById('verifyToast');
  const toastText = document.getElementById('verifyToastText');
  if (toast && toastText) {
    toastText.textContent = msg;
    toast.style.display = 'flex';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3500);
  }
}
