frappe.ready(() => {
  console.log("🚀 customer_signup.js loaded");

  function showStep(n) {
    document.querySelectorAll('.wizard-step').forEach(s => s.style.display = 'none');
    document.getElementById(`step-${n}`).style.display = 'block';
    const bar = document.getElementById('wizard-progress');
    if (bar) bar.style.width = (n === 1 ? 50 : 100) + '%';
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
              <span class="old-price">Rs.${plan.old_price.toLocaleString()}</span>
              <span class="save-tag">SAVE ${savePct}%</span>
              <div class="current-price">Rs.${plan.cost.toLocaleString()}<span class="per-mo">/mo</span></div>
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
      });

    } catch (err) {
      console.error('Error loading plans:', err);
      frappe.msgprint('Could not load plans. Please try again later.');
    }
  }

  // ... your existing step-2 code here (unchanged) ...

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
