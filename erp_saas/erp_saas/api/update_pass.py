import frappe
from frappe import _

@frappe.whitelist(allow_guest=False)
def update_password_for_site(custom_site_name: str, new_password: str):
    """
    Update 'custom_changed_password' for the Subscription matching 'custom_site_name'.
    Requires API key-based authentication.
    """

    if not frappe.session.user or frappe.session.user == "Guest":
        frappe.throw(_("Authentication required."), frappe.AuthenticationError)

    # Optional: Restrict to specific user
    if frappe.session.user != "Administrator":
        frappe.throw(_("Only Administrator can access this API."), frappe.PermissionError)

    # Validate inputs
    if not custom_site_name or not new_password:
        frappe.throw(_("Both 'custom_site_name' and 'new_password' are required."))

    # Try fetching the matching subscription
    sub_name = frappe.db.get_value("Subscription", {"custom_site_name": custom_site_name}, "name")
    if not sub_name:
        frappe.throw(_("No Subscription found for site: {0}").format(custom_site_name))

    # Update the field
    sub = frappe.get_doc("Subscription", sub_name)
    sub.custom_changed_password = new_password
    sub.custom_password_changed_on = frappe.utils.now()
    sub.save(ignore_permissions=True)

    return {
        "status": "success",
        "message": f"Password updated for {custom_site_name}"
    }
