import frappe
import subprocess
import os
from frappe.utils import now
from frappe.utils import getdate
import frappe
from frappe import publish_progress
from frappe import _


def run_site_provisioning(subscription_name):
    subscription_doc = frappe.get_doc("Subscription", subscription_name)
    _provision_site(subscription_doc)
    frappe.logger().info(f"[Provisioning] Queued provisioning for: {subscription_name}")

def get_site_config_path(site_name):
    return f"/home/frappe/frappe-bench/sites/{site_name}/site_config.json"

def _provision_site(subscription_doc):
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
    site_name = domain_doc.domain

    # Provision Frappe site
    BENCH_PATH = "/home/frappe/frappe-bench"
    BENCH_CMD = "/usr/local/bin/bench"
    try:
        publish_progress(25, "Creating site…")
        subprocess.run([
            BENCH_CMD, "new-site", site_name,
            "--mariadb-root-password", "frappe",
            "--admin-password", "admin"
        ], check=True, cwd=BENCH_PATH)

        publish_progress(50, "Configuring IntraEREP…")
        
        subprocess.run([BENCH_CMD, "--site", site_name, "install-app", "erpnext"], check=True, cwd=BENCH_PATH)
        subprocess.run([BENCH_CMD, "--site", site_name, "install-app", "erp_saas"], check=True, cwd=BENCH_PATH)
    except subprocess.CalledProcessError as e:
        frappe.log_error(title="Provisioning Error", message=f"App install failed for site {site_name}: {e}")
        frappe.throw("Provisioning failed while installing apps. Please check bench logs.")
        

    # Apply quota to site_config
    site_config_path = get_site_config_path(site_name)
    

    with open(site_config_path, "r+") as f:
        import json
        config = json.load(f)
        config["quota"] = {
            "active_users": 1,
            "backup_files_size": plan.custom_backup_files,
            "company": plan.custom_max_company,
            "count_administrator_user": 0,
            "count_website_users": 0,
            "db_space": plan.custom_max_db_storage_mb,
            "document_limit": {
                doc.document_type: {"limit": doc.limit, "period": doc.period}
                for doc in plan.custom_document_limit
            },
            "private_files_size": plan.custom_private_files_size_mb,
            "public_files_size": plan.custom_public_files_size_mb,
            "space": plan.custom_max_storage_mb,
            "used_company": 1,
            "used_db_space": 0,
            "used_space": 5,
            "users": plan.custom_max_users,
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
    }).insert(ignore_permissions=True)

    # Mark provisioned
    subscription_doc.custom_is_provisioned = 1
    subscription_doc.custom_site_name = site_name
    subscription_doc.custom_provisioning_log = f"Provisioned site: {site_name} with domain: {domain_doc.domain}"
    subscription_doc.save()

@frappe.whitelist()
def provision_site_remote(subscription_name):
    """
    Remote‐callable wrapper. Called via frappe.call from the client script.
    """
    # Load the Subscription
    sub = frappe.get_doc("Subscription", subscription_name)
    if sub.custom_is_provisioned:
        return _("Already provisioned")

    # Run your core provisioning logic
    _provision_site(sub)
    publish_progress(100, "Provisioning complete. Credentials emailed!")

    return _("Provisioning started for {0}").format(subscription_name)

# def queue_site_provisioning(subscription_doc, method=None):
#     """
#     Hook on Subscription.after_insert.
#     Enqueues the provisioning job with a 5s delay to allow the
#     Subscription record to commit in the DB.
#     """
#     frappe.enqueue(
#         method="erp_saas.erp_saas.api.provisioning.run_site_provisioning",
#         queue="default",
#         timeout=1200,     # 20 minutes max
#         delay=5,          # wait 5 seconds
#         subscription_name=subscription_doc.name
#     )

