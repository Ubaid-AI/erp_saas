import frappe
import subprocess
import os
from frappe.utils import now
from frappe.utils import getdate
# from frappe.utils import get_site_path

def get_site_config_path(site_name):
    return f"/home/frappe/frappe-bench/sites/{site_name}/site_config.json"

def provision_site(subscription_doc, method=None):
    if subscription_doc.custom_is_provisioned:
        return

    # Get first plan from the child table
    if not subscription_doc.plans or not subscription_doc.plans[0].plan:
        frappe.throw("No Subscription Plan found in the subscription.")

    plan_name = subscription_doc.plans[0].plan
    plan = frappe.get_doc("Subscription Plan", plan_name)

    # Get an available domain
    domain_doc = frappe.get_all("Saas Domain", filters={"active": 1, "in_use": 0}, limit=1)
    if not domain_doc:
        frappe.throw("No available domains to provision the site.")

    domain_doc = frappe.get_doc("Saas Domain", domain_doc[0].name)
    site_name = domain_doc.domain.replace(".", "_")

    # Provision Frappe site
    subprocess.run([
        "bench", "new-site", site_name,
        "--mariadb-root-password", "frappe",
        "--admin-password", "admin"
    ], check=True)

    subprocess.run(["bench", "--site", site_name, "install-app", "erpnext"], check=True)
    subprocess.run(["bench", "--site", site_name, "install-app", "erp_saas"], check=True)

    # Apply quota to site_config
    site_config_path = get_site_config_path(site_name)
    

    with open(site_config_path, "r+") as f:
        import json
        config = json.load(f)
        config["quota"] = {
            "active_users": plan.custom_max_users,
            "storage_limit_mb": plan.custom_max_storage_mb,
            "valid_till": getdate(subscription_doc.end_date).strftime("%Y-%m-%d")

        }
        f.seek(0)
        f.write(json.dumps(config, indent=2))
        f.truncate()

    # Mark domain as in use
    domain_doc.in_use = 1
    domain_doc.save(ignore_permissions=True)

    # Create Customer Site record
    frappe.get_doc({
        "doctype": "Customer Site",
        "site_name": site_name,
        "subscription": subscription_doc.name,
        "plan": plan.name,
        "domain": domain_doc.name,
        "status": "Active",
        "notes": "Auto-provisioned on " + now()
    }).insert()

    # Mark provisioned
    subscription_doc.custom_is_provisioned = 1
    subscription_doc.custom_site_name = site_name
    subscription_doc.custom_provisioning_log = f"Provisioned site: {site_name} with domain: {domain_doc.domain}"
    subscription_doc.save()
