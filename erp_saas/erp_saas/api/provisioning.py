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

    # Get site_name from subscription (user-chosen subdomain)
    if not subscription_doc.custom_site_name:
        frappe.throw("No site name/subdomain found in subscription.")
    
    site_name = subscription_doc.custom_site_name
    
    # Create Saas Domain record for this subdomain
    domain_doc = frappe.get_doc({
        "doctype": "Saas Domain",
        "domain": site_name,
        "active": 1,
        "in_use": 1
    })
    domain_doc.insert(ignore_permissions=True)

    # Provision Frappe site
    BENCH_PATH = "/home/frappe/frappe-bench"
    BENCH_CMD = "/usr/local/bin/bench"
    try:
        initial_pwd = _generate_password()
        publish_progress(50, "Creating site…")
        subprocess.run([
            BENCH_CMD, "new-site", site_name,
            "--mariadb-root-password", "Intra$234",
            "--admin-password", initial_pwd
        ], check=True, cwd=BENCH_PATH)

        publish_progress(75, "Configuring IntraEREP…")
        
        subprocess.run([BENCH_CMD, "--site", site_name, "install-app", "erpnext"], check=True, cwd=BENCH_PATH)
        subprocess.run([BENCH_CMD, "--site", site_name, "install-app", "erp_saas"], check=True, cwd=BENCH_PATH)
        subprocess.run([BENCH_CMD, "--site", site_name, "install-app", "havenir_hotel_erpnext"], check=True, cwd=BENCH_PATH)
    except subprocess.CalledProcessError as e:
        frappe.log_error(title="Provisioning Error", message=f"App install failed for site {site_name}: {e}")
        frappe.throw("Provisioning failed while installing apps. Please check bench logs.")
        

    # Apply quota to site_config
    site_config_path = get_site_config_path(site_name)
    

    with open(site_config_path, "r+") as f:
        config = json.load(f)

        # Add central API credentials first
        config["central_api_key"] = "83cca29169df526"
        config["central_api_secret"] = "24971f2ded7a0f4"
        config["central_api_user"] = "Administrator"

        # Add updated quota block
        # config["quota"] = {
        #     "active_users": 1,
        #     "backup_files_size": plan.custom_backup_files,
        #     "company": plan.custom_max_company,
        #     "count_administrator_user": plan.custom_count_administrator_user,
        #     "count_website_users": plan.custom_count_website_user,
        #     "db_space": plan.custom_max_db_storage_mb,
        #     "document_limit": {
        #         doc.document_type: {"limit": doc.limit, "period": doc.period}
        #         for doc in plan.custom_document_limit
        #     },
        #     "private_files_size": plan.custom_private_files_size_mb,
        #     "public_files_size": plan.custom_public_files_size_mb,
        #     "space": plan.custom_max_storage_mb,
        #     "used_company": 1,
        #     "used_db_space": 0,
        #     "used_space": 5,
        #     "users": plan.custom_max_users,
        #     "valid_till": getdate(subscription_doc.end_date).strftime("%Y-%m-%d")
        # }

        config["quota"] = {
            # total allowed active users
            "active_users": plan.custom_max_users or 0,

            # if you have a dedicated "backup" field, use it; 
            # otherwise, you could map it to one of your storage fields:
            "backup_files_size": plan.custom_public_files_size_mb or 0,

            # total allowed companies
            "company": plan.custom_max_company or 0,

            # you can default these to the same as max_users or zero
            "count_administrator_user": plan.custom_max_users or 0,
            "count_website_users": plan.custom_max_users or 0,

            # database space in MB
            "db_space": plan.custom_max_db_storage_mb or 0,

            # document limits
            "document_limit": {
                doc.document_type: {"limit": doc.limit, "period": doc.period}
                for doc in plan.custom_document_limit or []
            },

            # file storage quotas
            "private_files_size": plan.custom_private_files_size_mb or 0,
            "public_files_size": plan.custom_public_files_size_mb or 0,

            # total disk space in MB
            "space": plan.custom_max_storage_mb or 0,

            # used metrics
            "used_company":     1,
            "used_db_space":    0,
            "used_space":       5,

            # number of user seats
            "users": plan.custom_max_users or 0,

            # subscription expiry
            "valid_till": getdate(subscription_doc.end_date).strftime("%Y-%m-%d")
        }

    # Write updated config back to file
        f.seek(0)
        f.write(json.dumps(config, indent=2))
        f.truncate()

    # Domain already created with in_use=1, no need to update

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

    frappe.db.set_value("Subscription", subscription_doc.name, {
        "custom_is_provisioned":     1,
        "custom_first_password":     initial_pwd,
        "custom_site_name":          site_name,
        "custom_provisioning_log":   f"Provisioned site: {site_name} (domain {domain_doc.domain})"
    }, update_modified=False)
    frappe.db.commit()

    # ── SEND WELCOME EMAIL ──
    try:
        # Lookup the customer record to get their email
        cust = frappe.get_doc("Customer", subscription_doc.party)
        recipient = cust.email_id   # use the built-in email_id field
        if recipient:
            subject = "Welcome to RiyalERP - Your Account is Ready!"
            body = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to RiyalERP</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;" cellpadding="0" cellspacing="0">
        <tr>
            <td style="padding: 40px 20px;">
                <!-- Main Container -->
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);" cellpadding="0" cellspacing="0">
                    
                    <!-- Header with Gradient -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1F1F1F 0%, #2f2f2f 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                                Welcome to RiyalERP!
                            </h1>
                            <p style="margin: 10px 0 0; color: #e0e0e0; font-size: 16px; font-weight: 400;">
                                Your ERP Account is ready
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px; color: #2f2f2f; font-size: 16px; line-height: 1.6;">
                                Hello <strong>{cust.customer_name}</strong>,
                            </p>
                            <p style="margin: 0 0 30px; color: #555555; font-size: 16px; line-height: 1.6;">
                                Great news! Your RiyalERP account has been successfully created and is ready to use. We're excited to have you on board!
                            </p>
                            
                            <!-- Login Details Card -->
                            <div style="background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 2px solid #e9ecef; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
                                <h2 style="margin: 0 0 20px; color: #1F1F1F; font-size: 20px; font-weight: 700;">
                                    🔑 Your Login Credentials
                                </h2>
                                
                                <table role="presentation" style="width: 100%; border-collapse: collapse;" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                                            <span style="color: #6c757d; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Login URL</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                                            <a href="https://{site_name}" style="color: #1F1F1F; font-size: 16px; font-weight: 600; text-decoration: none; word-break: break-all;">
                                                🌐 https://{site_name}
                                            </a>
                                        </td>
                                    </tr>
                                    
                                    <tr>
                                        <td style="padding: 12px 0; padding-top: 20px; border-bottom: 1px solid #e9ecef;">
                                            <span style="color: #6c757d; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Username</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                                            <span style="color: #1F1F1F; font-size: 16px; font-weight: 600; font-family: 'Courier New', monospace;">
                                                👤 Administrator
                                            </span>
                                        </td>
                                    </tr>
                                    
                                    <tr>
                                        <td style="padding: 12px 0; padding-top: 20px; border-bottom: 1px solid #e9ecef;">
                                            <span style="color: #6c757d; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Temporary Password</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0;">
                                            <span style="color: #1F1F1F; font-size: 18px; font-weight: 700; font-family: 'Courier New', monospace; background: #fff3cd; padding: 8px 16px; border-radius: 6px; display: inline-block;">
                                                🔐 {initial_pwd}
                                            </span>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                            
                            <!-- Important Notice -->
                            <div style="background: linear-gradient(135deg, #fff3cd 0%, #fff9e6 100%); border-left: 4px solid #ffc107; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                                <p style="margin: 0 0 10px; color: #856404; font-size: 14px; font-weight: 700;">
                                    ⚠️ IMPORTANT SECURITY NOTICE
                                </p>
                                <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                                    This is a <strong>temporary password</strong> for your first login only. You will be required to create a new secure password when you log in. Please store your new credentials safely.
                                </p>
                            </div>
                            
                            <!-- CTA Button -->
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="https://{site_name}" style="display: inline-block; background: linear-gradient(90deg, #1F1F1F, #2f2f2f); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 700; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); transition: all 0.3s ease;">
                                    Access Your Account Now
                                </a>
                            </div>
                            
                            <!-- Next Steps -->
                            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                                <h3 style="margin: 0 0 15px; color: #1F1F1F; font-size: 16px; font-weight: 700;">
                                    📋 Next Steps
                                </h3>
                                <ul style="margin: 0; padding-left: 20px; color: #555555; font-size: 14px; line-height: 1.8;">
                                    <li>Click the button above to access your account</li>
                                    <li>Log in using the credentials provided</li>
                                    <li>Set up your new secure password</li>
                                    <li>Complete your company profile</li>
                                    <li>Start exploring RiyalERP features</li>
                                </ul>
                            </div>
                            
                            <!-- Support -->
                            <p style="margin: 30px 0 0; color: #6c757d; font-size: 14px; line-height: 1.6; text-align: center;">
                                Need help getting started? Our support team is here for you!<br>
                                <a href="mailto:support@riyalerp.com" style="color: #1F1F1F; text-decoration: none; font-weight: 600;">📧 support@riyalerp.com</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
                            <p style="margin: 0 0 10px; color: #2f2f2f; font-size: 16px; font-weight: 600;">
                                Welcome to the RiyalERP family!
                            </p>
                            <p style="margin: 0; color: #6c757d; font-size: 13px; line-height: 1.6;">
                                © 2024 RiyalERP. All rights reserved.<br>
                                This is an automated message, please do not reply to this email.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
            """.strip()

            frappe.sendmail(
                recipients=[recipient],
                subject=subject,
                message=body,
                reference_doctype="Subscription",
                reference_name=subscription_doc.name,
                now=True
            )
    except Exception:
        frappe.log_error(frappe.get_traceback(), "Provisioning: Welcome email failed")

@frappe.whitelist(allow_guest=True)
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

    # send_provisioning_email(sub)

    return publish_progress(100, "All Done!")
    
def handle_first_login(login_manager):

    if frappe.local.site == "site1.local":
        return

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
    url = "https://erp.arabapp.com.sa/api/method/erp_saas.erp_saas.api.update_pass.update_password_for_site"
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
