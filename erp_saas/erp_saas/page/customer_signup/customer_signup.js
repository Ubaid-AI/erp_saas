// frappe.pages['customer-signup'].on_page_load = function(wrapper) {
// 	var page = frappe.ui.make_app_page({
// 		parent: wrapper,
// 		title: 'Customer Signup',
// 		single_column: true
// 	});
// }


// apps/erp_saas/erp_saas/erp_saas/desk/page/customer_wizard/customer_wizard.js

frappe.provide("erp_saas.wizard");

frappe.pages['customer-signup'].on_page_load = function(wrapper) {
  // create a standard Desk page shell
  let page = frappe.ui.make_app_page({
    parent: wrapper,
    title: __("Customer Signup"),
    single_column: true
  });
  // hand off to our class
  new erp_saas.wizard.CustomerWizard(page);
};

erp_saas.wizard.CustomerWizard = class {
  constructor(page) {
    this.page = page;
    this.body = $(page.main).append('<div class="customer-wizard"></div>').find('.customer-wizard');
    this.bind_events();
  }

  bind_events() {
    // Next button on Step 1
    this.body.on('click', '#btn-next', () => this.create_customer());

    // Back button on Step 2
    this.body.on('click', '#btn-prev', () => this.show_step(1));
  }

  show_step(n) {
    this.body.find('.wizard-step').hide();
    this.body.find(`#step-${n}`).show();
  }

  create_customer() {
    const name  = this.body.find('#cust-name').val().trim();
    const email = this.body.find('#cust-email').val().trim();

    if (!name || !email) {
      frappe.msgprint(__('Name & Email are required'));
      return;
    }

    frappe.call({
      method: 'frappe.client.insert',
      args: {
        doc: {
          doctype: 'Customer',
          customer_name: name,
          email_id: email,
          phone: this.body.find('#cust-phone').val().trim()
        }
      },
      freeze: true,
      freeze_message: __('Creating your account…'),
      callback: (r) => {
        if (r.exc) return;
        this.customer = r.message;
        this.show_step(2);
        this.load_plans();
      }
    });
  }

  load_plans() {
    frappe.call({
      method: 'frappe.client.get_list',
      args: {
        doctype: 'Subscription Plan',
        filters: { disabled: 0 },
        fields: ['name', 'plan_name', 'custom_max_users', 'custom_max_storage_mb']
      },
      callback: (r) => {
        const $ct = this.body.find('#plans-container').empty();
        r.message.forEach(plan => {
          const $card = $(`
            <div class="plan-card" data-plan="${plan.name}">
              <h3>${plan.plan_name}</h3>
              <p>Users: ${plan.custom_max_users}</p>
              <p>Storage: ${plan.custom_max_storage_mb} MB</p>
              <button class="btn btn-success choose-plan">Select</button>
            </div>
          `);
          $card.find('.choose-plan').click(() => this.choose_plan(plan));
          $ct.append($card);
        });
      }
    });
  }

  choose_plan(plan) {
    const today = frappe.datetime.nowdate();
    const end   = frappe.datetime.add_days(today, 30);
    frappe.call({
      method: 'frappe.client.insert',
      args: {
        doc: {
          doctype: 'Subscription',
          party_type: 'Customer',
          party: this.customer.name,
          start_date: today,
          end_date: end,
          plans: [{ plan: plan.name, qty: 1 }]
        }
      },
      freeze: true,
      freeze_message: __('Setting up your subscription…'),
      callback: () => {
        frappe.msgprint(__('All done! Check your email for credentials.'));
      }
    });
  }
};
