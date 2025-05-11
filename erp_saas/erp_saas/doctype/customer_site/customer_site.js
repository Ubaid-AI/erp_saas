// Copyright (c) 2025, Havenir Solutions Private Limited and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Customer Site", {
// 	refresh(frm) {

// 	},
// });


frappe.ui.form.on('Customer Site', {
    onload(frm) {
      if (!frm.is_new()) {
        frm.call({
          method: 'erp_saas.erp_saas.api.site_config_update.get_quota_for_site',
          args: { site_name: frm.doc.site_name },
          callback: (r) => {
            const q = r.message || {};
            // simple fields
            frm.set_value('max_users', q.users);
            frm.set_value('max_company', q.company);
            frm.set_value('max_db_storage_mb', q.db_space);
            frm.set_value('max_storage_mb', q.space);
            frm.set_value('backup_files', q.backup_files_size);
            frm.set_value('private_files_size_mb', q.private_files_size);
            frm.set_value('public_files_size_mb', q.public_files_size);
            frm.set_value('count_administrator_user', q.count_administrator_user);
            frm.set_value('count_website_user', q.count_website_users);
            frm.set_value('end_date', q.valid_till);
            // compute validity_days if you like:
            if (q.valid_till) {
              const days = frappe.datetime.get_diff(q.valid_till, frappe.datetime.nowdate());
              frm.set_value('validity_days', days);
            }
            // child table
            frm.clear_table('document_limits');
            Object.keys(q.document_limit || {}).forEach(dt => {
              frm.add_child('document_limits', {
                document_type: dt,
                limit: q.document_limit[dt].limit,
                period: q.document_limit[dt].period
              });
            });
            frm.refresh_fields();
          }
        });
      }
    }
  });
  