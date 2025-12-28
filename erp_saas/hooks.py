# -*- coding: utf-8 -*-
from __future__ import unicode_literals

app_name = "erp_saas"
app_title = "ERP SaaS"
app_publisher = "Havenir Solutions Private Limited"
app_description = "App to manage ERPNext User and Space limitations"
app_icon = "octicon octicon-file-directory"
app_color = "grey"
app_email = "info@havenir.com"
app_license = "MIT"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
app_include_css = [
    "/assets/erp_saas/css/erp_saas.css",
    "/assets/erp_saas/css/admin_dashboard.css",
    "/assets/erp_saas/css/site_detail_dashboard.css",
    "/assets/erp_saas/css/server_health.css"
]
app_include_js = [
    "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"
]

# include js, css files in header of web template
# web_include_css = "/assets/erp_saas/css/erp_saas.css"
# web_include_js = "/assets/erp_saas/js/erp_saas.js"

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# "Role": "home_page"
# }


website_route_rules = [
    {
        "from_route": "/customer-signup",
        "to_route": "customer_signup"
    }
]

# Website user home page (by function)
# get_website_user_home_page = "erp_saas.utils.get_home_page"

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Installation
# ------------

before_install = "erp_saas.install.before_install"
# after_install = "erp_saas.install.after_install"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "erp_saas.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# }
# }

on_login = 'erp_saas.events.auth.successful_login'
after_login = 'erp_saas.erp_saas.api.provisioning.handle_first_login'

doc_events = {
    'User': {
        'validate': 'erp_saas.erp_saas.quota.user_limit',
        'on_update': 'erp_saas.erp_saas.quota.user_limit'
    },
    'Company': {
        'validate': 'erp_saas.erp_saas.quota.company_limit',
        'on_update': 'erp_saas.erp_saas.quota.company_limit'
    },
    '*': {
        'on_submit': 'erp_saas.erp_saas.quota.db_space_limit',
        'before_insert': 'erp_saas.erp_saas.quota.document_limit'
    },
    'File': {
        'validate': 'erp_saas.erp_saas.quota.files_space_limit'
    }
}

# ,
#     "Customer Site": {
#         "on_update": "erp_saas.erp_saas.api.site_config_update.update_site_config_on_update"
#     }


# Scheduled Tasks
# ---------------

#    "Subscription": {
#         "after_insert": "erp_saas.erp_saas.api.provisioning.queue_site_provisioning"
#     }


fixtures = [
    {
        "doctype": "Client Script",
        "filters": {
            "module": ["=", "Erp SaaS"]
        }
    }
]

scheduler_events = {
    "daily": [
        "erp_saas.tasks.daily"
    ]
}

# Testing
# -------

# before_tests = "erp_saas.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "erp_saas.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "erp_saas.task.get_dashboard_data"
# }
