import frappe
import subprocess
import os
from frappe.utils import now
from frappe.utils import getdate
import frappe
from frappe import publish_progress
from frappe import _
import random, string
import requests
from frappe import msgprint
import json
from collections import OrderedDict

def run_site_provisioning(subscription_name):
    subscription_doc = frappe.get_doc("Subscription", subscription_name)
    _provision_site(subscription_doc)
    frappe.logger().info(f"[Provisioning] Queued provisioning for: {subscription_name}")

def _generate_password(length=8):
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

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
        initial_pwd = _generate_password()
        publish_progress(25, "Creating site…")
        subprocess.run([
            BENCH_CMD, "new-site", site_name,
            "--mariadb-root-password", "frappe",
            "--admin-password", initial_pwd
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
        config = json.load(f)

        # Add central API credentials first
        config["central_api_key"] = "44abcc441fb9c51"
        config["central_api_secret"] = "4df562751154543"
        config["central_api_user"] = "Administrator"

        # Add updated quota block
        config["quota"] = {
            "active_users": 1,
            "backup_files_size": plan.custom_backup_files,
            "company": plan.custom_max_company,
            "count_administrator_user": plan.custom_count_administrator_user,
            "count_website_users": plan.custom_count_website_user,
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

    # Write updated config back to file
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
    subscription_doc.custom_first_password = initial_pwd
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

def handle_first_login(login_manager):
    if login_manager.user != "Administrator":
        return

    # 1) Generate and set a new local password
    new_pwd = _generate_password()
    admin = frappe.get_doc("User", "Administrator")
    admin.new_password = new_pwd
    admin.logout_all_sessions = 0
    admin.save(ignore_permissions=True)

    # 2) Load central API credentials from site_config.json
    site_config = frappe.get_site_config()
    api_key    = site_config.get("central_api_key")
    api_secret = site_config.get("central_api_secret")

    if not api_key or not api_secret:
        frappe.log_error("Missing API key or secret in site config", "handle_first_login")
        return

    # 3) Prepare API call to update password in central site
    url = "https://cl1.intraerp.com/api/method/erp_saas.erp_saas.api.update_pass.update_password_for_site"
    headers = {
        "Authorization": f"token {api_key}:{api_secret}"
    }
    payload = {
        "custom_site_name": frappe.local.site,
        "new_password": new_pwd
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=10, verify=False)
        if not resp.ok:
            error_details = f"Central update failed ({resp.status_code}): {resp.text}"
            frappe.log_error(title="Central update failed", message=error_details)
            frappe.msgprint(error_details, raise_exception=False)
    except Exception as e:
        frappe.log_error(title="Central API Error", message=str(e))
        frappe.msgprint(f"Central API Error: {e}", raise_exception=False)
