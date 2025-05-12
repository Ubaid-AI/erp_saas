frappe.ready(() => {
  console.log("🚀 customer_signup.js loaded");

  // ────────────────────────────────────────────
  // Step helper: show/hide wizard steps & progress
  // ────────────────────────────────────────────
  function showStep(n) {
    document.querySelectorAll('.wizard-step').forEach(s => s.style.display = 'none');
    document.getElementById(`step-${n}`).style.display = 'block';
    const bar = document.getElementById('wizard-progress');
    if (bar) bar.style.width = (n === 1 ? 50 : 100) + '%';
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

      const container = document.getElementById('plans-container');
      container.innerHTML = '';

      plans.forEach(plan => {
        // 1) Define term options (using trial_days from API)
        const monthlyDiscount = plan.old_price > plan.cost
          ? (plan.old_price - plan.cost) / plan.old_price
          : 0;
        const terms = [
          { label:'Trial',      type:'trial',      months:0,  discount:0,               days: plan.trial_days },
          { label:'Monthly',    type:'monthly',    months:1,  discount:0 },
          { label:'Annually',   type:'annually',   months:12, discount: monthlyDiscount },
          { label:'Biannually', type:'biannually', months:24, discount: monthlyDiscount }
        ];

        // 2) Create card column
        const col = document.createElement('div');
        col.className = 'col-md-3';
        col.innerHTML = `
          <div class="plan-card ${plan.hot ? 'hot' : ''}">
            ${plan.hot ? `<div class="hot-badge">Most Popular</div>` : ''}
            <h5 class="plan-title">${plan.plan_name}</h5>

            <div class="price-block mb-3">
              <span class="old-price"></span>
              <span class="save-tag"></span>
              <div class="current-price"></div>
              <div class="total-price"></div>
            </div>

            <ul class="list-unstyled mb-4">
              <li><strong>Users:</strong> ${plan.max_users}</li>
              <li><strong>Companies:</strong> ${plan.max_companies}</li>
              <li><strong>DB MB:</strong> ${plan.db_storage_mb}</li>
              <li><strong>Storage MB:</strong> ${plan.storage_mb}</li>
              <li><strong>Private MB:</strong> ${plan.private_files_mb}</li>
              <li><strong>Public MB:</strong> ${plan.public_files_mb}</li>
              <li><strong>${plan.doc_type}:</strong> ${plan.doc_limit} / ${plan.doc_period}</li>
            </ul>

            <button class="btn-started choose-plan mt-auto">Choose plan</button>
          </div>`;

        // 3) Inject term selector into the card
        const card = col.querySelector('.plan-card');
        const selectHtml = `
          <div class="term-select mb-3">
            <select class="form-control form-control-lg">
              ${terms.map(t => `<option value="${t.type}">${t.label}</option>`).join('')}
            </select>
          </div>`;
        card.insertAdjacentHTML('afterbegin', selectHtml);

        // 4) Pricing update helper
        function updatePricing(term) {
          const oldEl   = card.querySelector('.old-price');
          const saveEl  = card.querySelector('.save-tag');
          const curEl   = card.querySelector('.current-price');
          const totEl   = card.querySelector('.total-price');

          if (term.type === 'trial') {
            oldEl.textContent    = '';
            saveEl.style.display = 'none';
            curEl.textContent    = `${term.days} days Trial!`;
            totEl.textContent    = '';
          } else {
            // always show per-month figures
            oldEl.textContent = `${plan.currency}${plan.old_price.toLocaleString()}/mo`;
            if (term.discount > 0) {
              saveEl.textContent   = `SAVE ${Math.round(term.discount * 100)}%`;
              saveEl.style.display = 'inline-block';
            } else {
              saveEl.style.display = 'none';
            }
            curEl.textContent = `${plan.currency}${plan.cost.toLocaleString()}/mo`;

            // only multi-month terms show a total line
            if (term.months > 1) {
              totEl.textContent = `${plan.currency}${(plan.cost * term.months).toLocaleString()} total`;
            } else {
              totEl.textContent = '';
            }
          }
        }

        // 5) Wire up <select>
        const sel = card.querySelector('select');
        const defaultTerm = terms.find(t => t.type === 'biannually');
        sel.value = 'biannually';
        updatePricing(defaultTerm);
        card._term = defaultTerm;

        sel.addEventListener('change', () => {
          const chosen = terms.find(t => t.type === sel.value);
          card._term = chosen;
          updatePricing(chosen);
        });

        // 6) “Choose plan” click → capture plan + term + dates
        card.querySelector('.choose-plan').onclick = () => {
          window._selectedPlan      = plan;
          window._selectedTerm      = card._term;
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
      });  // end plans.forEach
    } catch (err) {
      console.error('Error loading plans:', err);
      frappe.msgprint('Could not load plans. Please try again later.');
    }
  }

  // ────────────────────────────────────────────
  // STEP 2: Create Customer → Address → Subscription
  // ────────────────────────────────────────────
  document.getElementById('btn-next').onclick = async () => {
    // Gather all Step 2 fields
    const first  = $('#first-name').val().trim();
    const last   = $('#last-name').val().trim();
    const email  = $('#cust-email').val().trim();
    const phone  = $('#cust-phone').val().trim();
    const street = $('#addr-street').val().trim();
    const city   = $('#addr-city').val().trim();
    const state  = $('#addr-state').val().trim();
    const postal = $('#addr-postal').val().trim();
    const country= $('#addr-country').val().trim();

    if (!first || !last || !email || !street || !city || !state || !postal || !country) {
      return frappe.msgprint('All fields are required.');
    }

    // 1) Insert Customer
    let r = await frappe.call('frappe.client.insert', {
      doc: {
        doctype:      'Customer',
        customer_name:`${first} ${last}`,
        email_id:     email,
        phone:        phone
      }
    });
    const cust = r.message.name;

    // 2) Insert Address
    await frappe.call('frappe.client.insert', {
      doc: {
        doctype:      'Address',
        address_title:`${first} ${last} Address`,
        address_line1:street,
        city, state, country,
        pincode:      postal,
        links:        [{ link_doctype:'Customer', link_name:cust }]
      }
    });

    // 3) Insert Subscription
    const plan = window._selectedPlan;
    await frappe.call('frappe.client.insert', {
      doc: {
        doctype:    'Subscription',
        party_type: 'Customer',
        party:       cust,
        start_date:  window._selectedStartDate,
        end_date:    window._selectedEndDate,
        plans:      [{ plan: plan.name, qty: 1 }]
      }
    });

    frappe.msgprint('🎉 All set! Check your email for login info.');
  };

  // Back to Step 1
  document.getElementById('btn-prev').onclick = () => showStep(1);

  // ────────────────────────────────────────────
  // Country loader (Step 2 datalist)
  // ────────────────────────────────────────────
  async function loadCountries() {
    try {
      const r  = await frappe.call('erp_saas.erp_saas.api.self_service.get_country_list');
      const dl = document.getElementById('country-list');
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
  showStep(1);
  loadPlans();
  loadCountries();
  AOS.init({ duration: 600, once: true });
});
