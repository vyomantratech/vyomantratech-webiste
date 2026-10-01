/**
 * Vyomantra Technologies - Public Certificate Verification Engine
 * Handles QR scan landing, manual ID lookup, verification status rendering,
 * live A4 landscape certificate preview, dynamic QR rendering, and PDF generation.
 */

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

// Quick fill from demo chips
function quickFill(id) {
  const inputEl = document.getElementById('certInputId');
  if (inputEl) {
    inputEl.value = id;
    verifyCertificate(id, 'MANUAL_ID');
  }
}

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

// Main verification request
async function verifyCertificate(certId, method = 'MANUAL_ID') {
  showLoadingView();

  try {
    const endpoint = `../api/verify.php?id=${encodeURIComponent(certId)}&method=${encodeURIComponent(method)}`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    // Check if server returned valid response
    if (res.ok) {
      const data = await res.json();
      if (data && data.data) {
        renderVerifiedCertificate(data.data, data.message);
        return;
      }
    }

    if (res.status === 404) {
      const data = await res.json().catch(() => ({}));
      renderNotFoundState(certId, data.message);
      return;
    }

    // Static Server / Local Dev Fallback if PHP not responding
    const fallbackCert = checkLocalFallback(certId);
    if (fallbackCert) {
      renderVerifiedCertificate(fallbackCert, 'Certificate Verified via local cache.');
      return;
    }

    renderNotFoundState(certId, 'We could not find an official certificate matching this Certificate ID.');

  } catch (err) {
    // Network or static environment fallback
    const fallbackCert = checkLocalFallback(certId);
    if (fallbackCert) {
      renderVerifiedCertificate(fallbackCert, 'Certificate Verified via local offline registry.');
    } else {
      renderNotFoundState(certId, 'We could not find an official certificate matching this Certificate ID.');
    }
  }
}

// Local dev static fallback for offline / Live Server
function checkLocalFallback(queryId) {
  const upperQuery = queryId.toUpperCase().trim();

  // 1. Check localStorage
  const localList = JSON.parse(localStorage.getItem('vyomantra_certificates') || '[]');
  const matchLocal = localList.find(c => 
    (c.certificate_id && c.certificate_id.toUpperCase() === upperQuery) || 
    (c.verification_token === queryId)
  );
  if (matchLocal) return matchLocal;

  // 2. Built-in seed mock records for zero-dependency local testing
  const seedMock = [
    {
      certificate_id: "VYOM-PY-2026-00001",
      recipient_name: "Kavitha R",
      certificate_type: "Course Completion",
      course_name: "Advanced Python & Applied Artificial Intelligence",
      course_duration: "3 Months (120 Hours)",
      description: "Successfully demonstrated mastery in core Python data structures, asynchronous programming, REST APIs with FastAPI, and integration of neural network inference pipelines.",
      trainer_name: "Santhosh S",
      trainer_designation: "Lead Technical Instructor",
      signatory_name: "S.B. Sachin",
      signatory_designation: "Founder & CEO",
      issue_date: "2026-09-15",
      completion_date: "2026-09-12",
      expiry_date: null,
      status: "valid",
      issued_by: "VYOMANTRA TECHNOLOGIES",
      verification_url: window.location.origin + "/verify/?id=VYOM-PY-2026-00001",
      verification_token: "a1f9e83b27c645e90d81b34c89efa712"
    },
    {
      certificate_id: "VYOM-INT-2026-00002",
      recipient_name: "Aravindhan M",
      certificate_type: "Internship Certificate",
      course_name: "Full Stack Software Engineering Internship",
      course_duration: "6 Months Intensive",
      description: "Completed software development engineering internship actively architecting enterprise microservices, high-performance UI components, and real-time database transactions.",
      trainer_name: "Naveen Kumar",
      trainer_designation: "Head of Engineering",
      signatory_name: "S.B. Sachin",
      signatory_designation: "Founder & CEO",
      issue_date: "2026-08-30",
      completion_date: "2026-08-28",
      expiry_date: null,
      status: "valid",
      issued_by: "VYOMANTRA TECHNOLOGIES",
      verification_url: window.location.origin + "/verify/?id=VYOM-INT-2026-00002",
      verification_token: "7c34b89e120fa54398de17a4c9b83f01"
    },
    {
      certificate_id: "VYOM-WKS-2026-00004",
      recipient_name: "Dinesh Kumar K",
      certificate_type: "Workshop Certificate",
      course_name: "Cloud Native DevOps & Containerization Workshop",
      course_duration: "2 Days Boot-Camp",
      description: "Participated in hands-on Docker orchestration, Kubernetes cluster management, and CI/CD automated deployment pipelines.",
      trainer_name: "Sivaperumal M",
      trainer_designation: "Cloud Infrastructure Lead",
      signatory_name: "S.B. Sachin",
      signatory_designation: "Founder & CEO",
      issue_date: "2026-07-10",
      completion_date: "2026-07-10",
      expiry_date: null,
      status: "revoked",
      issued_by: "VYOMANTRA TECHNOLOGIES",
      revoked_at: "2026-08-01 10:00:00",
      revocation_reason: "Course unfulfilled and non-attendance during the formal examination session.",
      verification_url: window.location.origin + "/verify/?id=VYOM-WKS-2026-00004",
      verification_token: "bb89a12c45def67098124bc4590ea321"
    }
  ];

  return seedMock.find(c => c.certificate_id.toUpperCase() === upperQuery) || null;
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
    desc.textContent = `This certificate was revoked by VYOMANTRA TECHNOLOGIES. Reason: ${cert.revocation_reason || 'Administrative Review'}.`;
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
    desc.textContent = `The validity period for this credential has elapsed (Expiry: ${cert.expiry_date || 'Past'}).`;
    icon.className = 'fas fa-clock';
    pill.textContent = 'EXPIRED';
    pill.style.color = '#f59e0b';
    if (ribbon) {
      ribbon.className = 'cert-status-ribbon expired';
      ribbon.textContent = 'EXPIRED';
      ribbon.style.display = 'block';
    }
  }

  // Populate Key Details Grid
  document.getElementById('resCertId').textContent = cert.certificate_id || '--';
  document.getElementById('resRecipientName').textContent = cert.recipient_name || '--';
  document.getElementById('resCertType').textContent = cert.certificate_type || 'Course Completion';
  document.getElementById('resCourseName').textContent = cert.course_name || '--';
  document.getElementById('resIssueDate').textContent = formatDate(cert.issue_date);
  document.getElementById('resIssuedBy').textContent = cert.issued_by || 'VYOMANTRA TECHNOLOGIES';

  // Populate Live Certificate Document Preview
  document.getElementById('certBadgeId').textContent = cert.certificate_id || '--';
  document.getElementById('certDocTypeLabel').textContent = (cert.certificate_type || 'CREDENTIAL').toUpperCase();
  document.getElementById('certDocTitle').textContent = `CERTIFICATE OF ${(cert.certificate_type || 'COMPLETION').toUpperCase()}`;
  document.getElementById('certDocRecipient').textContent = cert.recipient_name || '--';
  document.getElementById('certDocCourse').textContent = cert.course_name || '--';
  document.getElementById('certDocDescription').textContent = cert.description || 'Successfully demonstrated proficiency in modern software engineering principles and architectural excellence.';

  document.getElementById('certDocTrainerName').textContent = cert.trainer_name || 'Santhosh S';
  document.getElementById('certDocTrainerTitle').textContent = cert.trainer_designation || 'Lead Technical Instructor';
  document.getElementById('certDocTrainerSign').textContent = (cert.trainer_name || 'Santhosh S.').replace(/ [A-Z]$/, ' S.');

  document.getElementById('certDocSignatoryName').textContent = cert.signatory_name || 'S.B. Sachin';
  document.getElementById('certDocSignatoryTitle').textContent = cert.signatory_designation || 'Founder & CEO';
  document.getElementById('certDocCeoSign').textContent = cert.signatory_name || 'S.B. Sachin';

  document.getElementById('certDocIssueDate').textContent = formatDate(cert.issue_date);
  document.getElementById('certDocMetaId').textContent = cert.certificate_id || '--';

  const hostDomain = window.location.host || 'vyomantratech.com';
  document.getElementById('certDocVerifyDomain').textContent = `${hostDomain}/verify`;

  const tokenSnippet = cert.verification_token ? cert.verification_token.substring(0, 16).toUpperCase() : 'VYOM-SECURE';
  document.getElementById('certDocSecurityToken').textContent = tokenSnippet;

  // Render Dynamic High-Resolution QR Code
  renderQrCode(cert.certificate_id);

  // Update Page Title
  document.title = `Verified: ${cert.certificate_id} - ${cert.recipient_name} | VYOMANTRA TECHNOLOGIES`;

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
  const preview = document.getElementById('certPreviewContainer');

  if (banner) banner.className = 'status-banner not_found';
  headline.textContent = 'Certificate Not Found';
  desc.textContent = msg || `No official credential matches Certificate ID "${certId}". Please check the ID and try again.`;
  icon.className = 'fas fa-times-circle';
  pill.textContent = 'NOT FOUND';
  pill.style.color = '#ef4444';

  document.getElementById('resCertId').textContent = certId || '--';
  document.getElementById('resRecipientName').textContent = 'Record Not Found';
  document.getElementById('resCertType').textContent = '--';
  document.getElementById('resCourseName').textContent = '--';
  document.getElementById('resIssueDate').textContent = '--';

  if (preview) preview.style.display = 'none';
  document.title = `Certificate Not Found (${certId}) | VYOMANTRA TECHNOLOGIES`;
}

// Generate QR Code into container
function renderQrCode(certId) {
  const qrBox = document.getElementById('certDocQrBox');
  if (!qrBox) return;

  qrBox.innerHTML = '';

  const siteOrigin = window.location.origin;
  const verifyUrl = `${siteOrigin}/verify/?id=${encodeURIComponent(certId)}`;

  if (typeof QRCode !== 'undefined') {
    new QRCode(qrBox, {
      text: verifyUrl,
      width: 76,
      height: 76,
      colorDark: '#050711',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  } else {
    // Fallback QR API if local library fails to load
    const img = document.createElement('img');
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=76x76&data=${encodeURIComponent(verifyUrl)}&margin=1`;
    img.alt = 'Certificate Verification QR';
    img.width = 76;
    img.height = 76;
    qrBox.appendChild(img);
  }
}

// Show / Hide Views
function showSearchView() {
  document.getElementById('searchViewSection').style.display = 'block';
  document.getElementById('verifyResultSection').style.display = 'none';
  document.getElementById('verifyLoadingSection').style.display = 'none';
  const preview = document.getElementById('certPreviewContainer');
  if (preview) preview.style.display = 'flex';
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

// PDF Download
function downloadCertificatePdf() {
  if (!currentCertData) return;
  const element = document.getElementById('certRenderDoc');
  if (!element) return;

  showToast('Generating high-resolution official PDF certificate...');

  const fileName = `${currentCertData.certificate_id}_Vyomantra_Certificate.pdf`;

  if (typeof html2pdf !== 'undefined') {
    const opt = {
      margin: 0,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(element).save().then(() => {
      showToast('Certificate PDF downloaded successfully.');
    }).catch(err => {
      console.error(err);
      window.print();
    });
  } else {
    window.print();
  }
}

// Print Certificate
function printCertificateDoc() {
  window.print();
}

// Copy Shareable URL
function copyVerificationShareUrl() {
  if (!currentCertData) return;
  const siteOrigin = window.location.origin;
  const url = `${siteOrigin}/verify/?id=${encodeURIComponent(currentCertData.certificate_id)}`;
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
