frappe.ready(() => {
  console.log("🚀 customer_signup.js loaded");

  // ────────────────────────────────────────────
  // Step helper: show/hide wizard steps & progress
  // ────────────────────────────────────────────
  function showStep(n) {
    document.querySelectorAll('.wizard-step').forEach(s => s.style.display = 'none');
    const stepEl = document.getElementById(`step-${n}`);
    if (stepEl) {
      stepEl.style.display = 'block';
    }
    
    // Update progress indicator if exists
    const progressSteps = document.querySelectorAll('.progress-step');
    progressSteps.forEach((step, idx) => {
      if (idx < n) {
        step.classList.add('completed');
        step.classList.remove('active');
      } else if (idx === n - 1) {
        step.classList.add('active');
        step.classList.remove('completed');
      } else {
        step.classList.remove('completed', 'active');
      }
    });
  }

  // ────────────────────────────────────────────
  // STEP 1: Load & Render Plans with Term Selector
  // ────────────────────────────────────────────
  async function loadPlans() {
    try {
      const res  = await fetch(
        '/api/method/erp_saas.erp_saas.api.self_service.get_published_plans',
        { credentials: 'same-origin' }
      );
      const data = await res.json();
      const plans = data.message || [];
      console.log('Plans loaded:', plans.length);

      const container = document.getElementById('plans-container');
      if (!container) {
        console.error('plans-container not found!');
        return;
      }
      container.innerHTML = '';

      plans.forEach(plan => {
        // 1) Define term options (using trial_days from API)
        const monthlyDiscount = plan.old_price > plan.cost
          ? (plan.old_price - plan.cost) / plan.old_price
          : 0;
        const terms = [
          { label:'Trial',      type:'trial',      months:0,  discount:0,               days: plan.trial_days },
          { label:'Monthly',    type:'monthly',    months:1,  discount: monthlyDiscount},
          { label:'Annually',   type:'annually',   months:12, discount: monthlyDiscount },
          { label:'Biannually', type:'biannually', months:24, discount: monthlyDiscount }
        ];

        // 2) Create card column - RESPONSIVE
        const col = document.createElement('div');
        col.className = 'col-12 col-sm-6 col-lg-3 mb-3';
        
        // Escape HTML to prevent XSS
        const escapePlanName = plan.plan_name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const escapeDocType = (plan.doc_type || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        col.innerHTML = `
          <div class="plan-card ${plan.hot ? 'hot' : ''}">
            ${plan.hot ? `<div class="hot-badge">⭐ Most Popular</div>` : ''}
            
            <div class="term-select mb-3">
              <label class="term-label">Select Billing Term:</label>
              <select class="form-control">
                ${terms.map(t => `<option value="${t.type}">${t.label}</option>`).join('')}
              </select>
            </div>
            
            <h5 class="plan-title">${escapePlanName}</h5>

            <div class="price-block mb-3">
              <span class="old-price"></span>
              <span class="save-tag"></span>
              <div class="current-price"></div>
              <div class="total-price"></div>
            </div>

            <ul class="features-list list-unstyled mb-4">
              <li class="feature-item">👥 <strong>Users:</strong> ${plan.max_users} <span class="checkmark">✓</span></li>
              <li class="feature-item">🏢 <strong>Companies:</strong> ${plan.max_companies} <span class="checkmark">✓</span></li>
              <li class="feature-item">💾 <strong>DB Storage:</strong> ${plan.db_storage_mb} MB ${plan.db_storage_mb > 0 ? '<span class="checkmark">✓</span>' : '<span class="crossmark">✗</span>'}</li>
              <li class="feature-item">📦 <strong>Storage:</strong> ${plan.storage_mb} MB ${plan.storage_mb > 0 ? '<span class="checkmark">✓</span>' : '<span class="crossmark">✗</span>'}</li>
              <li class="feature-item">🔒 <strong>Private Files:</strong> ${plan.private_files_mb} MB ${plan.private_files_mb > 0 ? '<span class="checkmark">✓</span>' : '<span class="crossmark">✗</span>'}</li>
              <li class="feature-item">🌐 <strong>Public Files:</strong> ${plan.public_files_mb} MB ${plan.public_files_mb > 0 ? '<span class="checkmark">✓</span>' : '<span class="crossmark">✗</span>'}</li>
              ${plan.doc_type ? `<li class="feature-item">📄 <strong>${escapeDocType}:</strong> ${plan.doc_limit}/${plan.doc_period} <span class="checkmark">✓</span></li>` : ''}
            </ul>

            <button class="btn-started choose-plan mt-auto">Choose Plan</button>
          </div>`;

        // 3) Get references
        const card = col.querySelector('.plan-card');
        const sel = card.querySelector('select');

        // 4) Pricing update helper
        function updatePricing(term) {
          const oldEl   = card.querySelector('.old-price');
          const saveEl  = card.querySelector('.save-tag');
          const curEl   = card.querySelector('.current-price');
          const totEl   = card.querySelector('.total-price');

          if (term.type === 'trial') {
            oldEl.textContent    = '';
            saveEl.style.display = 'none';
            curEl.innerHTML    = `<span class="trial-badge">🎉 ${term.days} Days Free Trial!</span>`;
            totEl.textContent    = '';
          } else {
            oldEl.textContent = plan.old_price > plan.cost ? `${plan.currency}${plan.old_price.toLocaleString()}/mo` : '';
            if (term.discount > 0) {
              saveEl.textContent   = `SAVE ${Math.round(term.discount * 100)}%`;
              saveEl.style.display = 'inline-block';
            } else {
              saveEl.style.display = 'none';
            }
            curEl.textContent = `${plan.currency}${plan.cost.toLocaleString()}/mo`;

            if (term.months > 1) {
              totEl.textContent = `${plan.currency}${(plan.cost * term.months).toLocaleString()} total`;
            } else {
              totEl.textContent = '';
            }
          }
        }

        // 5) Default to Monthly
        const defaultTerm = terms.find(t => t.type === 'monthly') || terms[1];
        sel.value = defaultTerm.type;
        updatePricing(defaultTerm);
        card._term = defaultTerm;
        card._plan = plan;

        sel.addEventListener('change', () => {
          const chosen = terms.find(t => t.type === sel.value);
          card._term = chosen;
          updatePricing(chosen);
        });

        // 6) "Choose plan" click → capture plan + term + dates (ORIGINAL METHOD)
        card.querySelector('.choose-plan').onclick = () => {
          window._selectedPlan      = card._plan;
          window._selectedTerm      = card._term;
          
          // Use original frappe datetime methods
          const today               = frappe.datetime.nowdate();
          window._selectedStartDate = today;
          if (card._term.type === 'trial') {
            window._selectedEndDate = frappe.datetime.add_days(today, card._term.days);
          } else {
            window._selectedEndDate = frappe.datetime.add_months(today, card._term.months);
          }
          showStep(2);
        };

        container.appendChild(col);
      });
    } catch (err) {
      console.error('Error loading plans:', err);
      frappe.msgprint({
        title: 'Error Loading Plans',
        message: 'Could not load plans. Please try again later.',
        indicator: 'red'
      });
    }
  }

  // ────────────────────────────────────────────
  // SUBDOMAIN VALIDATION
  // ────────────────────────────────────────────
  let subdomainAvailable = false;
  let currentSubdomain = '';
  let subdomainCheckTimeout = null;
  
  const subdomainInput = document.getElementById('subdomain-input');
  const subdomainGroup = document.querySelector('.subdomain-input-group');
  const subdomainStatus = document.getElementById('subdomain-status');
  const statusIcon = subdomainStatus?.querySelector('.status-icon');
  const statusMessage = subdomainStatus?.querySelector('.status-message');
  
  async function checkSubdomain(subdomain) {
    if (!subdomain || subdomain.length < 3) {
      hideSubdomainStatus();
      subdomainAvailable = false;
      return;
    }
    
    // Show checking state
    showSubdomainStatus('checking', 'Checking availability...');
    
    try {
      const response = await frappe.call({
        method: 'erp_saas.erp_saas.api.self_service.check_subdomain_availability',
        args: { subdomain: subdomain },
        freeze: false
      });
      
      console.log('Subdomain check response:', response.message);
      
      if (response.message && response.message.available) {
        subdomainAvailable = true;
        currentSubdomain = response.message.full_domain;
        showSubdomainStatus('available', response.message.message || 'Available!');
      } else {
        subdomainAvailable = false;
        currentSubdomain = '';
        showSubdomainStatus('unavailable', response.message.message || 'Not available');
      }
      
      // Trigger step validation
      validateStep2();
      
    } catch (error) {
      console.error('Subdomain check error:', error);
      subdomainAvailable = false;
      showSubdomainStatus('unavailable', 'Error checking availability');
    }
  }
  
  function showSubdomainStatus(status, message) {
    if (!subdomainStatus) return;
    
    subdomainStatus.style.display = 'flex';
    subdomainStatus.className = `subdomain-status ${status}`;
    
    if (statusMessage) statusMessage.textContent = message;
    
    // Update input group border
    if (subdomainGroup) {
      subdomainGroup.classList.remove('available', 'unavailable', 'checking');
      subdomainGroup.classList.add(status);
    }
  }
  
  function hideSubdomainStatus() {
    if (subdomainStatus) {
      subdomainStatus.style.display = 'none';
    }
    if (subdomainGroup) {
      subdomainGroup.classList.remove('available', 'unavailable', 'checking');
    }
  }
  
  // Subdomain input event listeners
  if (subdomainInput) {
    subdomainInput.addEventListener('input', (e) => {
      // Convert to lowercase and remove invalid characters
      let value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
      e.target.value = value;
      
      // Clear previous timeout
      if (subdomainCheckTimeout) {
        clearTimeout(subdomainCheckTimeout);
      }
      
      // Debounce check (wait 500ms after user stops typing)
      if (value.length >= 3) {
        subdomainCheckTimeout = setTimeout(() => {
          checkSubdomain(value);
        }, 500);
      } else {
        hideSubdomainStatus();
        subdomainAvailable = false;
        validateStep2();
      }
    });
    
    subdomainInput.addEventListener('blur', () => {
      const value = subdomainInput.value.trim();
      if (value && value.length >= 3) {
        checkSubdomain(value);
      }
    });
  }

  // ────────────────────────────────────────────
  // STEP 2: Form Validation Function (defined early for OTP callback)
  // ────────────────────────────────────────────
  let otpVerified = false;
  
  function validateStep2() {
    const subdomain = document.getElementById('subdomain-input')?.value.trim() || '';
    const first     = document.getElementById('first-name')?.value.trim() || '';
    const last      = document.getElementById('last-name')?.value.trim() || '';
    const email     = document.getElementById('cust-email')?.value.trim() || '';
    const phone     = document.getElementById('cust-phone')?.value.trim() || '';
    const street    = document.getElementById('addr-street')?.value.trim() || '';
    const city      = document.getElementById('addr-city')?.value.trim() || '';
    const state     = document.getElementById('addr-state')?.value.trim() || '';
    const postal    = document.getElementById('addr-postal')?.value.trim() || '';
    const country   = document.getElementById('addr-country')?.value.trim() || '';
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailValid = emailRegex.test(email);
    
    const allFieldsFilled = subdomain && first && last && email && phone && street && city && state && postal && country;
    const isValid = allFieldsFilled && isEmailValid && otpVerified && subdomainAvailable;
    
    const btnToReview = document.getElementById('btn-to-review');
    if (btnToReview) {
      btnToReview.disabled = !isValid;
      
      // Update button appearance
      if (!isValid) {
        btnToReview.classList.remove('btn-primary');
        btnToReview.classList.add('btn-secondary');
        
        // Show what's missing in button tooltip
        let missing = [];
        if (!subdomain) missing.push('choose subdomain');
        else if (!subdomainAvailable) missing.push('subdomain unavailable');
        if (!allFieldsFilled) missing.push('fill all fields');
        if (!isEmailValid && email) missing.push('enter valid email');
        if (!otpVerified && isEmailValid) missing.push('verify email with code');
        
        if (missing.length > 0) {
          btnToReview.innerHTML = `Continue to Review <i class="fas fa-lock"></i>`;
          btnToReview.title = 'Please ' + missing.join(', ');
        }
      } else {
        btnToReview.classList.remove('btn-secondary');
        btnToReview.classList.add('btn-primary');
        btnToReview.innerHTML = 'Continue to Review <i class="fas fa-arrow-right"></i>';
        btnToReview.title = 'All set! Click to review and submit';
      }
    }
    
    return isValid;
  }

  // ────────────────────────────────────────────
  // OTP VERIFICATION
  // ────────────────────────────────────────────
  let resendTimer = null;
  
  // Send OTP
  const btnSendOTP = document.getElementById('btn-send-otp');
  if (btnSendOTP) {
    btnSendOTP.onclick = async () => {
      const emailInput = document.getElementById('cust-email');
      const email = emailInput.value.trim();
      
      if (!email) {
        frappe.msgprint('Please enter your email address first.');
        emailInput.focus();
        return;
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        frappe.msgprint('Please enter a valid email address.');
        emailInput.focus();
        return;
      }
      
      // Disable button and show loading
      btnSendOTP.disabled = true;
      btnSendOTP.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
      
      try {
        const response = await frappe.call({
          method: 'erp_saas.erp_saas.api.self_service.send_email_otp',
          args: { email: email }
        });
        
        console.log('Send OTP Response:', response.message);
        
        if (response.message && response.message.success) {
          // Show OTP input section
          document.getElementById('otp-input-section').style.display = 'block';
          const otpInput = document.getElementById('email-otp');
          otpInput.disabled = false;
          otpInput.focus();
          
          // Show success notification
          frappe.show_alert({
            message: '✓ Verification code sent! Check your email.',
            indicator: 'green'
          }, 5);
          
          // Update button
          btnSendOTP.innerHTML = '<i class="fas fa-redo"></i> Resend Code';
          
          // Store the sent OTP for comparison (for testing in console)
          if (response.message.otp) {
            console.log('OTP sent to email:', response.message.otp);
            window._testOTP = response.message.otp;
          }
          
          // Start countdown timer
          let countdown = 60;
          const timerEl = document.getElementById('otp-timer');
          resendTimer = setInterval(() => {
            countdown--;
            timerEl.textContent = `You can resend code in ${countdown} seconds`;
            if (countdown <= 0) {
              clearInterval(resendTimer);
              timerEl.textContent = '';
              btnSendOTP.disabled = false;
            }
          }, 1000);
          
        } else {
          frappe.msgprint({
            title: 'Error',
            message: response.message && response.message.message ? response.message.message : 'Failed to send verification code.',
            indicator: 'red'
          });
          btnSendOTP.disabled = false;
          btnSendOTP.innerHTML = '<i class="fas fa-paper-plane"></i> Send Verification Code';
        }
      } catch (error) {
        console.error('OTP send error:', error);
        frappe.msgprint({
          title: 'Error',
          message: 'Failed to send verification code. Please try again.',
          indicator: 'red'
        });
        btnSendOTP.disabled = false;
        btnSendOTP.innerHTML = '<i class="fas fa-paper-plane"></i> Send Verification Code';
      }
    };
  }
  
  // Auto-verify OTP when 6 digits entered
  const otpInput = document.getElementById('email-otp');
  if (otpInput) {
    otpInput.oninput = async (e) => {
      const statusEl = document.getElementById('otp-status');
      
      // Only allow numbers
      const cleaned = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = cleaned;
      
      console.log('OTP Input:', cleaned, 'Length:', cleaned.length);
      
      if (cleaned.length === 6) {
        // Auto-verify
        console.log('Auto-verifying OTP:', cleaned);
        statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
        statusEl.className = 'mt-2 text-center text-primary';
        
        try {
          const email = document.getElementById('cust-email').value.trim();
          console.log('Verifying for email:', email);
          
          const response = await frappe.call({
            method: 'erp_saas.erp_saas.api.self_service.verify_email_otp',
            args: { email: email, otp: cleaned }
          });
          
          console.log('=== Full Verify OTP Response ===');
          console.log('Full response:', response);
          console.log('response.message:', response.message);
          console.log('response.message.verified:', response.message?.verified);
          console.log('response.message.message:', response.message?.message);
          console.log('==============================');
          
          if (response.message && response.message.verified) {
            otpVerified = true;
            statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Email verified successfully!';
            statusEl.className = 'mt-2 text-center text-success fw-bold';
            otpInput.disabled = true;
            otpInput.classList.add('border-success');
            
            // Show success alert
            frappe.show_alert({
              message: '✓ Email verified! You can now continue.',
              indicator: 'green'
            }, 5);
            
            // Clear timer
            if (resendTimer) {
              clearInterval(resendTimer);
              document.getElementById('otp-timer').textContent = '';
            }
            
            console.log('OTP Verified Successfully!');
            
            // Trigger validation to enable the Continue button
            setTimeout(validateStep2, 100);
          } else {
            otpVerified = false;
            const errorMsg = response.message && response.message.message ? response.message.message : 'Invalid code';
            statusEl.innerHTML = '<i class="fas fa-times-circle"></i> ' + errorMsg;
            statusEl.className = 'mt-2 text-center text-danger';
            console.log('OTP Verification Failed:', errorMsg);
            
            // Clear input for retry
            setTimeout(() => {
              otpInput.value = '';
              otpInput.focus();
            }, 1500);
          }
        } catch (error) {
          console.error('OTP verification error:', error);
          statusEl.innerHTML = '<i class="fas fa-times-circle"></i> Verification failed';
          statusEl.className = 'mt-2 text-center text-danger';
          
          // Clear input for retry
          setTimeout(() => {
            otpInput.value = '';
            otpInput.focus();
          }, 1500);
        }
      } else if (cleaned.length === 0) {
        statusEl.innerHTML = '';
      }
    };
    
    // Also handle paste event
    otpInput.onpaste = (e) => {
      e.preventDefault();
      const pastedText = (e.clipboardData || window.clipboardData).getData('text');
      const cleaned = pastedText.replace(/[^0-9]/g, '').substring(0, 6);
      otpInput.value = cleaned;
      // Trigger input event to auto-verify
      otpInput.dispatchEvent(new Event('input'));
    };
  }

  // ────────────────────────────────────────────
  // STEP 2: Real-time Validation Setup
  // ────────────────────────────────────────────
  
  // Attach validation to all form fields
  const formFields = [
    'first-name', 'last-name', 'cust-email', 'cust-phone',
    'addr-street', 'addr-city', 'addr-state', 'addr-postal', 'addr-country'
  ];
  
  formFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', validateStep2);
      field.addEventListener('blur', validateStep2);
    }
  });
  
  // Initial validation check
  setTimeout(validateStep2, 500);
  
  // ────────────────────────────────────────────
  // Button: Continue to Review (Step 2 → Step 3)
  // ────────────────────────────────────────────
  const btnToReview = document.getElementById('btn-to-review');
  if (btnToReview) {
    btnToReview.onclick = () => {
      // Re-validate before going to review
      if (!validateStep2()) {
        frappe.show_alert({
          message: 'Please complete all required fields and verify your email',
          indicator: 'orange'
        }, 5);
        return;
      }
      
      // Gather all form values and store globally for review
      window._formData = {
        subdomain: document.getElementById('subdomain-input').value.trim(),
        first:     document.getElementById('first-name').value.trim(),
        last:      document.getElementById('last-name').value.trim(),
        email:     document.getElementById('cust-email').value.trim(),
        phone:     document.getElementById('cust-phone').value.trim(),
        street:    document.getElementById('addr-street').value.trim(),
        city:      document.getElementById('addr-city').value.trim(),
        state:     document.getElementById('addr-state').value.trim(),
        postal:    document.getElementById('addr-postal').value.trim(),
        country:   document.getElementById('addr-country').value.trim()
      };
      
      // Populate review section
      populateReview();
      
      // Show Step 3 (Review)
      showStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }

  // ────────────────────────────────────────────
  // Function: Populate Review Section
  // ────────────────────────────────────────────
  function populateReview() {
    const data = window._formData;
    const plan = window._selectedPlan;
    const term = window._selectedTerm;
    
    // Plan Information
    document.getElementById('review-plan-name').textContent = plan.plan_name;
    document.getElementById('review-term').textContent = term.label + ' (' + 
      (term.months === 0 ? term.days + ' days trial' : term.months + ' months') + ')';
    
    const totalPrice = term.months === 0 ? 'Free Trial' : 
      plan.currency + ' ' + (plan.cost * term.months).toFixed(2);
    document.getElementById('review-price').textContent = totalPrice;
    
    // Subdomain Information
    const fullSubdomain = `${data.subdomain}.riyalsystem.com.sa`;
    const subdomainUrl = `https://${fullSubdomain}`;
    
    const reviewSubdomainLink = document.getElementById('review-subdomain-link');
    if (reviewSubdomainLink) {
      reviewSubdomainLink.textContent = subdomainUrl;
      reviewSubdomainLink.href = subdomainUrl;
    }
    
    // Customer Information
    document.getElementById('review-name').textContent = data.first + ' ' + data.last;
    document.getElementById('review-email').textContent = data.email;
    document.getElementById('review-phone').textContent = data.phone || '-';
    
    const address = [data.street, data.city, data.state, data.postal, data.country]
      .filter(x => x).join(', ');
    document.getElementById('review-address').textContent = address;
  }

  // ────────────────────────────────────────────
  // Button: Edit Plan (Back to Step 1)
  // ────────────────────────────────────────────
  const btnEditPlan = document.getElementById('btn-edit-plan');
  if (btnEditPlan) {
    btnEditPlan.onclick = () => showStep(1);
  }

  // ────────────────────────────────────────────
  // Button: Edit Subdomain (Back to Step 2)
  // ────────────────────────────────────────────
  const btnEditSubdomain = document.getElementById('btn-edit-subdomain');
  if (btnEditSubdomain) {
    btnEditSubdomain.onclick = () => {
      showStep(2);
      // Focus on subdomain input
      setTimeout(() => {
        const subdomainInput = document.getElementById('subdomain-input');
        if (subdomainInput) {
          subdomainInput.focus();
          subdomainInput.select();
        }
      }, 300);
    };
  }

  // ────────────────────────────────────────────
  // Button: Back to Information (Back to Step 2)
  // ────────────────────────────────────────────
  const btnBackToInfo = document.getElementById('btn-back-to-info');
  if (btnBackToInfo) {
    btnBackToInfo.onclick = () => showStep(2);
  }
  
  const btnBackToInfo2 = document.getElementById('btn-back-to-info-2');
  if (btnBackToInfo2) {
    btnBackToInfo2.onclick = () => showStep(2);
  }

  // ────────────────────────────────────────────
  // Button: Create My Account (Final Submit)
  // ────────────────────────────────────────────
  const btnFinalSubmit = document.getElementById('btn-final-submit');
  if (btnFinalSubmit) {
    btnFinalSubmit.onclick = async () => {
      // Check terms agreement
      const termsAgree = document.getElementById('terms-agree');
      if (!termsAgree.checked) {
        frappe.show_alert({
          message: 'Please agree to the Terms of Service and Privacy Policy',
          indicator: 'orange'
        }, 5);
        return;
      }
      
      // Get form data
      const data = window._formData;
    const plan_name = window._selectedPlan.name;
    const start     = window._selectedStartDate;
    const end       = window._selectedEndDate;
  
      // Disable button to prevent double submission
      btnFinalSubmit.disabled = true;
      btnFinalSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    const provCtr  = document.getElementById('provision-container');
      const reviewContent = document.getElementById('review-content');
  const provBar  = document.getElementById('provision-bar');
  const provMsg  = document.getElementById('provision-message');
      const provBarText = provBar.querySelector('.progress-text');
      
      // Hide review and show progress immediately
      if (reviewContent) reviewContent.style.display = 'none';
      if (provCtr) {
  provCtr.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      // Define progress steps with timing
  const steps = [
        { msg: "🚀 Creating your customer account...",        pct: 15, duration: 3 },
        { msg: "📦 Preparing your RiyalERP environment...",   pct: 25, duration: 5 },
        { msg: "🔧 Installing core RiyalERP modules...",       pct: 45, duration: 15 },
        { msg: "🏢 Installing Hotel Management system...",    pct: 65, duration: 10 },
        { msg: "⚙️ Configuring your workspace settings...",   pct: 80, duration: 8 },
        { msg: "🔒 Setting up security and permissions...",   pct: 90, duration: 5 },
        { msg: "✨ Finalizing your account...",               pct: 95, duration: 3 }
      ];
    
      // Function to update progress bar
      function updateProgress(pct, msg) {
        if (provBar) {
          provBar.style.width = pct + '%';
          if (provBarText) provBarText.textContent = pct + '%';
        }
        if (provMsg) provMsg.textContent = msg;
      }
      
      // Start progress animation
      let currentStep = 0;
      updateProgress(5, '⏳ Initializing your account creation...');
      
      // Animate through steps during provisioning
      const progressInterval = setInterval(() => {
        if (currentStep < steps.length) {
          const step = steps[currentStep];
          updateProgress(step.pct, step.msg);
          currentStep++;
        }
      }, 4000); // Update every 4 seconds
    
      try {
        // Create customer and subscription
        updateProgress(10, '👤 Creating customer profile...');
        
    let res = await frappe.call({
      method: 'erp_saas.erp_saas.api.self_service.register_and_subscribe',
      args: {
            first_name:  data.first,
            last_name:   data.last,
            email:       data.email,
            phone:       data.phone,
            street:      data.street,
            city:        data.city,
            state:       data.state,
            postal:      data.postal,
            country:     data.country,
        plan_name:   plan_name,
        start_date:  start,
        end_date:    end,
        subdomain:   data.subdomain
      }
    });
  
    const subscriptionName = res.message;
        console.log('Subscription created:', subscriptionName);
        
        updateProgress(20, '🌐 Provisioning your dedicated site...');
  
        // Start provisioning (this takes the longest time)
    await frappe.call({
      method: 'erp_saas.erp_saas.api.provisioning.provision_site_remote',
          args: { subscription_name: subscriptionName }
        });
        
        // Clear interval and show completion
        clearInterval(progressInterval);
        updateProgress(100, '✅ Account created successfully!');

        // Show success message
        setTimeout(() => {
    frappe.msgprint({
            title: __('🎉 Success!'),
            message: __(`
              <div style="text-align: center; padding: 20px;">
                <div style="font-size: 64px; margin-bottom: 20px;">✅</div>
                <h4>Your RiyalERP Account is Ready!</h4>
                <p>We've sent your login credentials to <strong>${data.email}</strong></p>
                <p class="text-muted">Please check your email inbox (and spam folder) for:</p>
                <ul style="text-align: left; display: inline-block; margin-top: 15px;">
                  <li>Your site URL</li>
                  <li>Login username</li>
                  <li>Temporary password</li>
                </ul>
                <hr style="margin: 20px 0;">
                <p class="small text-muted">You can close this page now.</p>
              </div>
            `),
      indicator: 'green',
      primary_action: {
              label: __('OK, Got it!'),
        action: () => { window.location.reload(); }
      }
    });
        }, 1000);
        
      } catch(error) {
        console.error('Signup error:', error);
        clearInterval(progressInterval); // Clear the progress interval on error
        
        if (reviewContent) reviewContent.style.display = 'block';
        if (provCtr) provCtr.style.display = 'none';
        if (btnFinalSubmit) {
          btnFinalSubmit.disabled = false;
          btnFinalSubmit.innerHTML = '<i class="fas fa-rocket"></i> Create My Account';
        }
        
        const errorMsg = error.message || error.exc || 'An error occurred during signup';
        frappe.msgprint({
          title: '❌ Signup Error',
          message: `
            <div style="padding: 10px;">
              <p>We encountered an issue creating your account:</p>
              <p class="text-muted small">${errorMsg}</p>
              <hr>
              <p>Please try again or contact our support team if the problem persists.</p>
            </div>
          `,
          indicator: 'red'
        });
      }
    };
  }

  // Back to Step 1
  const btnPrev = document.getElementById('btn-prev');
  if (btnPrev) {
    btnPrev.onclick = () => showStep(1);
  }

  // ────────────────────────────────────────────
  // Country loader (Step 2 datalist)
  // ────────────────────────────────────────────
  async function loadCountries() {
    try {
      const r  = await frappe.call('erp_saas.erp_saas.api.self_service.get_country_list');
      const dl = document.getElementById('country-list');
      if (!dl) return;
      
      dl.innerHTML = '';
      (r.message || []).forEach(c => {
        dl.appendChild(Object.assign(
          document.createElement('option'),
          { value: c.name }
        ));
      });
    } catch (err) {
      console.error('Error loading countries:', err);
    }
  }

  // ────────────────────────────────────────────
  // Initialize
  // ────────────────────────────────────────────
  console.log('Initializing signup page...');
  showStep(1);
  loadPlans();
  loadCountries();
  
  // Initialize AOS if available
  if (typeof AOS !== 'undefined') {
  AOS.init({ duration: 600, once: true });
  }
  
  console.log('✅ Signup page initialized');
});
