/**
 * ===================================================================
 * VYOMANTRA TECHNOLOGIES - MAIN INTERACTIVITY & UI CONTROLLER
 * ===================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Sticky Header
  const header = document.querySelector('.site-header');
  const dockTop = document.querySelector('.dock-top');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (header) {
      if (scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }

    if (dockTop) {
      if (scrollY > 400) {
        dockTop.classList.add('visible');
      } else {
        dockTop.classList.remove('visible');
      }
    }
  }, { passive: true });

  if (dockTop) {
    dockTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 2. Mobile Drawer Navigation
  const mobileToggle = document.getElementById('mobileToggle');
  const closeMenu = document.getElementById('closeMenu');
  const mobileDrawer = document.getElementById('mobileDrawer');

  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      mobileDrawer.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  }

  if (closeMenu && mobileDrawer) {
    closeMenu.addEventListener('click', () => {
      mobileDrawer.classList.remove('active');
      document.body.style.overflow = '';
    });
  }

  // Close drawer on link click
  const drawerLinks = document.querySelectorAll('.mobile-nav-link');
  drawerLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (mobileDrawer) {
        mobileDrawer.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });

  // 3. Project Showcase Tabs (Home Bakers vs AI-CRM)
  const tabBtns = document.querySelectorAll('.portfolio-tabs .tab-btn');
  const projectDisplays = document.querySelectorAll('.project-display');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-project');
      
      tabBtns.forEach(b => b.classList.remove('active'));
      projectDisplays.forEach(d => d.classList.remove('active'));

      btn.classList.add('active');
      const targetDisplay = document.getElementById(targetId);
      if (targetDisplay) {
        targetDisplay.classList.add('active');
      }
    });
  });

  // 4. Project Image Carousels (Slide switching)
  const carousels = document.querySelectorAll('.project-gallery-carousel');
  carousels.forEach(carousel => {
    const slides = carousel.querySelectorAll('.project-slide');
    const prevBtn = carousel.querySelector('.carousel-btn.prev');
    const nextBtn = carousel.querySelector('.carousel-btn.next');
    let currentIndex = 0;

    function showSlide(index) {
      if (slides.length === 0) return;
      if (index < 0) index = slides.length - 1;
      if (index >= slides.length) index = 0;
      currentIndex = index;

      slides.forEach((s, idx) => {
        if (idx === currentIndex) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showSlide(currentIndex - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showSlide(currentIndex + 1);
      });
    }
  });

  // 5. Payment Modal (GooglePay QR)
  const paymentModal = document.getElementById('paymentModal');
  const paymentTriggers = document.querySelectorAll('[data-open-payment]');
  const modalCloses = document.querySelectorAll('.modal-close, [data-close-modal]');

  paymentTriggers.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (paymentModal) {
        paymentModal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  modalCloses.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.classList.remove('active');
      });
      document.body.style.overflow = '';
    });
  });

  // Close modals on clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });
  // 6. Testimonials Autoscroll Slider (Desktop: 3 reviews in a row then scroll; Mobile: 1 review then scroll)
  const testiTrack = document.getElementById('testimonialsTrack');
  const testiWrapper = document.getElementById('testimonialsSliderWrapper');
  const testiPrevBtn = document.getElementById('testiPrevBtn');
  const testiNextBtn = document.getElementById('testiNextBtn');
  const testiDotsContainer = document.getElementById('testimonialsDots');

  if (testiTrack) {
    const cards = testiTrack.querySelectorAll('.testimonial-card-v2');
    const totalCards = cards.length;
    let currentIndex = 0;
    let autoScrollTimer = null;
    let isInteracting = false;
    let resumeTimer = null;

    function getVisibleCount() {
      if (window.innerWidth <= 768) return 1;
      if (window.innerWidth <= 1024) return 2;
      return 3;
    }

    function getMaxIndex() {
      const visible = getVisibleCount();
      return Math.max(0, totalCards - visible);
    }

    function renderDots() {
      if (!testiDotsContainer) return;
      testiDotsContainer.innerHTML = '';
      const maxIndex = getMaxIndex();
      const count = maxIndex + 1;

      for (let i = 0; i < count; i++) {
        const dot = document.createElement('button');
        dot.className = `testimonials-dot ${i === currentIndex ? 'active' : ''}`;
        dot.setAttribute('aria-label', `Testimonial slide ${i + 1}`);
        dot.addEventListener('click', () => {
          scrollToIndex(i);
          pauseAndResume();
        });
        testiDotsContainer.appendChild(dot);
      }
    }

    function updateActiveDot(index) {
      if (!testiDotsContainer) return;
      const dots = testiDotsContainer.querySelectorAll('.testimonials-dot');
      dots.forEach((dot, idx) => {
        if (idx === index) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    }

    function scrollToIndex(index, smooth = true) {
      const maxIndex = getMaxIndex();
      if (index > maxIndex) index = 0;
      if (index < 0) index = maxIndex;

      currentIndex = index;
      const targetCard = cards[currentIndex];
      if (targetCard) {
        testiTrack.style.scrollSnapType = 'none';
        const scrollOffset = targetCard.offsetLeft - testiTrack.offsetLeft;
        testiTrack.scrollTo({
          left: scrollOffset,
          behavior: smooth ? 'smooth' : 'auto'
        });
        setTimeout(() => {
          testiTrack.style.scrollSnapType = 'x mandatory';
        }, 400);
      }
      updateActiveDot(currentIndex);
    }

    function startAutoScroll() {
      stopAutoScroll();
      autoScrollTimer = setInterval(() => {
        if (!isInteracting) {
          const maxIndex = getMaxIndex();
          if (currentIndex >= maxIndex) {
            scrollToIndex(0);
          } else {
            scrollToIndex(currentIndex + 1);
          }
        }
      }, 3500);
    }

    function stopAutoScroll() {
      if (autoScrollTimer) {
        clearInterval(autoScrollTimer);
        autoScrollTimer = null;
      }
    }

    function pauseAndResume(delay = 4000) {
      isInteracting = true;
      stopAutoScroll();
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        isInteracting = false;
        startAutoScroll();
      }, delay);
    }

    // Previous / Next buttons
    if (testiPrevBtn) {
      testiPrevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        scrollToIndex(currentIndex - 1);
        pauseAndResume();
      });
    }

    if (testiNextBtn) {
      testiNextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        scrollToIndex(currentIndex + 1);
        pauseAndResume();
      });
    }

    // Pause on hover
    if (testiWrapper) {
      testiWrapper.addEventListener('mouseenter', () => {
        isInteracting = true;
        stopAutoScroll();
      });

      testiWrapper.addEventListener('mouseleave', () => {
        isInteracting = false;
        startAutoScroll();
      });
    }

    // Touch support (pause during touch, resume after)
    testiTrack.addEventListener('touchstart', () => {
      isInteracting = true;
      stopAutoScroll();
    }, { passive: true });

    testiTrack.addEventListener('touchend', () => {
      pauseAndResume(3000);
    }, { passive: true });

    // Sync active dot on manual scroll / swipe
    let scrollSyncTimer = null;
    testiTrack.addEventListener('scroll', () => {
      if (scrollSyncTimer) clearTimeout(scrollSyncTimer);
      scrollSyncTimer = setTimeout(() => {
        const currentScroll = testiTrack.scrollLeft;
        let bestIndex = 0;
        let minDistance = Infinity;

        cards.forEach((card, idx) => {
          const distance = Math.abs((card.offsetLeft - testiTrack.offsetLeft) - currentScroll);
          if (distance < minDistance) {
            minDistance = distance;
            bestIndex = idx;
          }
        });

        const maxIndex = getMaxIndex();
        currentIndex = Math.min(bestIndex, maxIndex);
        updateActiveDot(currentIndex);
      }, 60);
    }, { passive: true });

    // Mouse drag scrolling on desktop
    let isDragging = false;
    let startX = 0;
    let initialScrollLeft = 0;

    testiTrack.addEventListener('mousedown', (e) => {
      isDragging = true;
      isInteracting = true;
      stopAutoScroll();
      startX = e.pageX - testiTrack.offsetLeft;
      initialScrollLeft = testiTrack.scrollLeft;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        pauseAndResume();
      }
    });

    testiTrack.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const x = e.pageX - testiTrack.offsetLeft;
      const walk = (x - startX) * 1.5;
      testiTrack.scrollLeft = initialScrollLeft - walk;
    });

    // Handle viewport resize
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderDots();
        scrollToIndex(currentIndex, false);
      }, 100);
    });

    // Initialize
    renderDots();
    startAutoScroll();
  }

});
