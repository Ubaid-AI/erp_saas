import json
import frappe
from frappe.utils import add_days, today, getdate

def _get_site_config(site_name):
    path = f"/home/frappe/frappe-bench/sites/{site_name}/site_config.json"
    with open(path, "r") as f:
        return json.load(f), path

@frappe.whitelist()
def get_quota_for_site(site_name):
    """
    Whitelisted method to fetch the 'quota' block from a tenant's site_config.json.
    """
    config, _ = _get_site_config(site_name)
    return config.get("quota", {})

def update_site_config_on_update(doc, method=None):
    """
    DocEvent hook on Customer Site: 
    merge the doctype fields + child table into tenant's site_config.json quota block.
    """
    # 1) load existing config + path
    config, path = _get_site_config(doc.site_name)

    # 2) prepare quota dict
    quota = config.get("quota", {})

    # map simple fields
    quota.update({
        "users":                    doc.max_users,
        "company":                  doc.max_company,
        "db_space":                 doc.max_db_storage_mb,
        "space":                    doc.max_storage_mb,
        "backup_files_size":        doc.backup_files,
        "private_files_size":       doc.private_files_size_mb,
        "public_files_size":        doc.public_files_size_mb,
        "count_administrator_user": 1 if doc.count_administrator_user else 0,
        "count_website_users":       1 if doc.count_website_user      else 0,
        "valid_till": getdate(doc.end_date).strftime("%Y-%m-%d")
    })

    # # validity_days → valid_till
    # if doc.validity_days is not None:
    #     new_valid = add_days(today(), doc.validity_days)
    #     quota["valid_till"] = getdate(new_valid).strftime("%Y-%m-%d")

        

    # document limits child table
    quota["document_limit"] = {
        row.document_type: {
            "limit": row.limit,
            "period": row.period
        } for row in doc.document_limits
    }

    # 3) write back only the quota block
    config["quota"] = quota
    with open(path, "w") as f:
        json.dump(config, f, indent=2)

@frappe.whitelist()
def upgrade_plan_quota(subscription_name):
    """
    Called when a Subscription is updated.  It reads the new plan,
    builds a full quota block from the plan's fields, and writes it
    into the tenant's site_config.json.
    """
    sub = frappe.get_doc("Subscription", subscription_name)
    site_name = sub.custom_site_name
    if not site_name:
        frappe.throw("Subscription has no site_name to match.")

    # 1) Load plan
    plan = frappe.get_doc("Subscription Plan", sub.plans[0].plan)

    # 2) Load existing site_config
    config, path = _get_site_config(site_name)
    quota = {}

    # 3) Build full quota block from plan fields
    quota["users"]                    = plan.custom_max_users
    quota["company"]                  = plan.custom_max_company
    quota["db_space"]                 = plan.custom_max_db_storage_mb
    quota["space"]                    = plan.custom_max_storage_mb
    quota["backup_files_size"]        = plan.custom_backup_files
    quota["private_files_size"]       = plan.custom_private_files_size_mb
    quota["public_files_size"]        = plan.custom_public_files_size_mb
    quota["count_administrator_user"] = 1 if plan.custom_count_administrator_user else 0
    quota["count_website_users"]      = 1 if plan.custom_count_website_user      else 0

    # copy document limits from plan child table
    quota["document_limit"] = {
        row.document_type: {"limit": row.limit, "period": row.period}
        for row in plan.custom_document_limit
    }

    # keep existing “used_*” counts
    for key in ("active_users","used_company","used_db_space","used_space"):
        if key in config.get("quota", {}):
            quota[key] = config["quota"][key]

    # Valid till from Subscription end_date
    quota["valid_till"] = getdate(sub.end_date).strftime("%Y-%m-%d")

    # 4) Merge back into config and write file
    config["quota"] = quota
    with open(path, "w") as f:
        json.dump(config, f, indent=2)

    frappe.logger().info(f"[QuotaSync] Upgraded quota for {site_name} from plan {plan.name}")