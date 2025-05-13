# test_email.py
import frappe
from frappe.utils import init_request

# initialize the site so frappe.sendmail knows where to look
frappe.init(site="your-site-name")
init_request()

frappe.sendmail(
  recipients=["you@example.com"],
  subject="Test Email from Frappe Script",
  message="<p>👏 Success! You can send email programmatically.</p>"
)
print("Email sent.")
