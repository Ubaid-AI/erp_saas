frappe.ready(() => {
  console.log("🚀 customer_signup.js loaded");

  function showStep(n) {
    document.querySelectorAll('.wizard-step').forEach(s => s.style.display = 'none');
    document.getElementById(`step-${n}`).style.display = 'block';

    // Progress bar
    const bar = document.getElementById('wizard-progress');
    if (bar) bar.style.width = (n === 1 ? 50 : 100) + '%';

    // On step 2, inject plan name
    if (n === 2 && window._selectedPlan) {
      const el = document.getElementById('selected-plan-name');
      if (el) el.textContent = `You’ve chosen: ${window._selectedPlan.plan_name}`;
    }
  }
  async function loadPlans() {
    try {
      let res = await fetch('/api/method/erp_saas.erp_saas.api.self_service.get_published_plans', { credentials: 'same-origin' });
      let data = await res.json();
      let plans = (data.message || []);

      const container = document.getElementById('plans-container');
      container.innerHTML = '';

      plans.forEach(plan => {
        // compute save %
        let savePct = plan.old_price > 0
          ? Math.round((plan.old_price - plan.cost) / plan.old_price * 100)
          : 0;

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
            <!-- NEW: renew info + separator -->
            <div class="renew-text">
              Renews at ${plan.currency}${plan.cost.toLocaleString()}/mo for 2 years. <br>Cancel anytime.
            </div>
            <hr class="renew-separator"/>

            <ul class="list-unstyled mb-4">
              <li><strong>Users:</strong> ${plan.max_users}</li>
              <li><strong>Companies:</strong> ${plan.max_companies}</li>
              <li><strong>DB MB:</strong> ${plan.db_storage_mb}</li>
              <li><strong>Storage MB:</strong> ${plan.storage_mb}</li>
              <li><strong>Private MB:</strong> ${plan.private_files_mb}</li>
              <li><strong>Public MB:</strong> ${plan.public_files_mb}</li>
              <li><strong>${plan.doc_type}:</strong> ${plan.doc_limit} / ${plan.doc_period}</li>
            </ul>

            <button class="btn-started choose-plan">Choose plan</button>
          </div>`;
        
        // wire up the button
        col.querySelector('.choose-plan').onclick = () => {
          window._selectedPlan = plan;
          showStep(2);
        };

        container.appendChild(col);

        // ── Insert TERM selector and pricing update ──

// 1. Define your term options, including trial_days from the plan
const terms = [
  { label:'Trial',      type:'trial',      months:0,  discount:0, days: plan.trial_days },
  { label:'Monthly',    type:'monthly',    months:1,  discount:0 },
  { label:'Annually',   type:'annually',   months:12, discount: 0.10 },    // adjust discount % as needed
  { label:'Biannually', type:'biannually', months:24, discount: 0.15 }
];

// 2. Inject a small <select> at the top of each card
const selectHtml = `
  <div class="term-select mb-3">
    <select class="form-control form-control-lg">
      ${terms.map(t=>`<option value="${t.type}">${t.label}</option>`).join('')}
    </select>
  </div>
`;

const card = col.querySelector('.plan-card');
card.insertAdjacentHTML('afterbegin', selectHtml);

// 3. Helper to recalculate prices
function updatePricing(term) {
  const oldEl   = card.querySelector('.old-price');
  const saveEl  = card.querySelector('.save-tag');
  const curEl   = card.querySelector('.current-price');
  const totalEl = card.querySelector('.total-price');

  if (term.type === 'trial') {
    // always show trial_days
    oldEl.textContent   = '';
    saveEl.style.display = 'none';
    curEl.textContent   = `${term.days} days Trial!`;
    totalEl.textContent = '';

  } else {
    // per-month pricing always stays the same
    const monthlyOld  = plan.old_price;
    const monthlyCost = plan.cost;
    oldEl.textContent = `${plan.currency}${monthlyOld.toLocaleString()}/mo`;

    // compute discount % on per-month basis
    const discount = term.months === 1
      ? ((plan.old_price - plan.cost) / plan.old_price)
      : (term.discount || 0);

    if (discount > 0) {
      saveEl.textContent   = `SAVE ${Math.round(discount * 100)}%`;
      saveEl.style.display = 'inline-block';
    } else {
      saveEl.style.display = 'none';
    }

    curEl.textContent = `${plan.currency}${monthlyCost.toLocaleString()}/mo`;

    // only show total line for multi-month terms
    if (term.months > 1) {
      const totalCost = monthlyCost * term.months;
      totalEl.textContent = `${plan.currency}${totalCost.toLocaleString()} total`;
    } else {
      totalEl.textContent = '';
    }
  }
}



// 4. Wire up the <select> change
const sel = card.querySelector('select');
sel.addEventListener('change', () => {
  const term = terms.find(t=>t.type === sel.value);
  updatePricing(term);
  col._term = term;    // store for later
});
// Initialize to Monthly
selectEl.value = 'biannually';
updatePricing(terms.find(t => t.type === 'biannually'));
col._term = terms.find(t => t.type === 'biannually');

      });

    } catch (err) {
      console.error('Error loading plans:', err);
      frappe.msgprint('Could not load plans. Please try again later.');
    }
  }

  // ... your existing step-2 code here (unchanged) ...

  document.getElementById('btn-next').onclick = async () => {
    // collect your new fields...
    const site  = document.getElementById('site-name').value.trim();
    const first = document.getElementById('first-name').value.trim();
    const last  = document.getElementById('last-name').value.trim();
    const country = document.getElementById('country').value;
    const email   = document.getElementById('email').value.trim();
    const agreed  = document.getElementById('agree-terms').checked;

    if (!site || !first || !last || !country || !email || !agreed) {
      return frappe.msgprint('All fields are required and you must agree to the terms.');
    }
  };

  document.getElementById('btn-prev').onclick = () => showStep(1);

  // country loader (unchanged)
  async function loadCountries() {
    try {
      const r = await frappe.call('erp_saas.erp_saas.api.self_service.get_country_list');
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

  // initialize
  showStep(1);
  loadPlans();
  loadCountries();
  AOS.init({ duration: 600, once: true });
});
