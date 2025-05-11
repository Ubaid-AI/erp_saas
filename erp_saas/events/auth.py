import frappe
from frappe import _
from frappe.utils.data import date_diff, today
from erp_saas.erp_saas.api.provisioning import handle_first_login


def successful_login(login_manager):
    """
    on_login verify if site is not expired
    """
    quota = frappe.get_site_config()['quota']
    valid_till = quota['valid_till']
    diff = date_diff(valid_till, today())
    if diff < 0:
        frappe.throw(_("You site is suspended. Please <a href=""https://intraerp.com/"" target=""_blank"">contact sales</a>."), frappe.AuthenticationError)
    handle_first_login(login_manager)
