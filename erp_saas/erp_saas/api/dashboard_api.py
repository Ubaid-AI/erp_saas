# Copyright (c) 2025, Havenir Solutions Private Limited and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt, nowdate, add_months, get_first_day, get_last_day
from datetime import datetime, timedelta


@frappe.whitelist()
def get_dashboard_stats():
    """
    Fetch comprehensive dashboard statistics for admin panel
    """
    try:
        # Get all Customer Sites with their details
        sites = frappe.get_all(
            "Customer Site",
            fields=["name", "site_name", "status", "subscription", "plan", "domain", 
                   "max_users", "max_storage_mb", "end_date", "creation", "modified"],
            order_by="creation desc"
        )
        
        # Get all Subscriptions
        subscriptions = frappe.get_all(
            "Subscription",
            fields=["name", "party", "status", "start_date", "end_date", 
                   "custom_is_provisioned", "creation"],
            order_by="creation desc"
        )
        
        # Get all Domains
        domains = frappe.get_all(
            "Saas Domain",
            fields=["name", "domain", "active", "in_use", "creation"],
            order_by="creation desc"
        )
        
        # Get all Subscription Plans with pricing
        plans = frappe.get_all(
            "Subscription Plan",
            fields=["name", "plan_name", "cost", "custom_max_users", 
                   "custom_max_storage_mb", "custom_max_db_storage_mb"],
            order_by="cost desc"
        )
        
        # Calculate summary statistics
        total_sites = len(sites)
        active_sites = len([s for s in sites if s.status == "Active"])
        suspended_sites = len([s for s in sites if s.status == "Suspended"])
        provisioning_sites = len([s for s in sites if s.status == "Provisioning"])
        
        total_subscriptions = len(subscriptions)
        active_subscriptions = len([s for s in subscriptions if s.status == "Active"])
        
        total_domains = len(domains)
        in_use_domains = len([d for d in domains if d.in_use == 1])
        available_domains = total_domains - in_use_domains
        
        # Calculate revenue (sum of plan costs for active subscriptions)
        revenue = 0
        mrr = 0  # Monthly Recurring Revenue
        for sub in subscriptions:
            if sub.status == "Active":
                # Get subscription plans
                sub_doc = frappe.get_doc("Subscription", sub.name)
                for plan_row in sub_doc.plans:
                    plan_doc = frappe.get_doc("Subscription Plan", plan_row.plan)
                    plan_cost = flt(plan_doc.cost)
                    revenue += plan_cost
                    mrr += plan_cost
        
        # Site status distribution for pie chart
        status_distribution = {
            "Active": active_sites,
            "Suspended": suspended_sites,
            "Provisioning": provisioning_sites,
            "Deleted": len([s for s in sites if s.status == "Deleted"])
        }
        
        # Plan distribution
        plan_distribution = {}
        for site in sites:
            if site.plan:
                if site.plan in plan_distribution:
                    plan_distribution[site.plan] += 1
                else:
                    plan_distribution[site.plan] = 1
        
        # Growth trend (last 12 months)
        growth_data = get_growth_trend(12)
        
        # Recent activities (last 10 sites)
        recent_sites = sites[:10] if len(sites) > 10 else sites
        
        # Get customer details for recent sites
        for site in recent_sites:
            if site.subscription:
                sub = frappe.get_doc("Subscription", site.subscription)
                customer = frappe.get_doc("Customer", sub.party)
                site.customer_name = customer.customer_name
                site.customer_email = customer.email_id
            else:
                site.customer_name = "N/A"
                site.customer_email = "N/A"
        
        # Expiring subscriptions (next 30 days)
        expiring_soon = []
        today = datetime.strptime(nowdate(), "%Y-%m-%d")
        thirty_days_later = today + timedelta(days=30)
        
        for site in sites:
            if site.end_date:
                end_date = datetime.strptime(str(site.end_date), "%Y-%m-%d")
                if today < end_date <= thirty_days_later and site.status == "Active":
                    expiring_soon.append({
                        "site_name": site.site_name,
                        "end_date": site.end_date,
                        "days_left": (end_date - today).days
                    })
        
        return {
            "summary": {
                "total_sites": total_sites,
                "active_sites": active_sites,
                "suspended_sites": suspended_sites,
                "provisioning_sites": provisioning_sites,
                "total_subscriptions": total_subscriptions,
                "active_subscriptions": active_subscriptions,
                "total_revenue": revenue,
                "mrr": mrr,
                "total_domains": total_domains,
                "in_use_domains": in_use_domains,
                "available_domains": available_domains
            },
            "charts": {
                "status_distribution": status_distribution,
                "plan_distribution": plan_distribution,
                "growth_trend": growth_data
            },
            "recent_sites": recent_sites,
            "expiring_soon": expiring_soon,
            "plans": plans
        }
    
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Dashboard Stats Error")
        return {
            "error": str(e),
            "summary": {},
            "charts": {},
            "recent_sites": [],
            "expiring_soon": [],
            "plans": []
        }


def get_growth_trend(months=12):
    """
    Calculate site creation growth trend for the last N months
    """
    growth_data = {
        "labels": [],
        "data": []
    }
    
    today = datetime.strptime(nowdate(), "%Y-%m-%d")
    
    for i in range(months - 1, -1, -1):
        month_start = add_months(today, -i)
        month_start_str = get_first_day(month_start).strftime("%Y-%m-%d")
        month_end_str = get_last_day(month_start).strftime("%Y-%m-%d")
        
        # Count sites created in this month
        count = frappe.db.count(
            "Customer Site",
            filters={
                "creation": ["between", [month_start_str, month_end_str]]
            }
        )
        
        # Format label as "Jan 2024"
        label = month_start.strftime("%b %Y")
        
        growth_data["labels"].append(label)
        growth_data["data"].append(count)
    
    return growth_data


@frappe.whitelist()
def get_site_details(site_name):
    """
    Get detailed information for a specific site
    """
    try:
        site = frappe.get_doc("Customer Site", site_name)
        
        # Get subscription details
        if site.subscription:
            subscription = frappe.get_doc("Subscription", site.subscription)
            customer = frappe.get_doc("Customer", subscription.party)
            
            return {
                "site": site.as_dict(),
                "subscription": subscription.as_dict(),
                "customer": customer.as_dict()
            }
        else:
            return {
                "site": site.as_dict(),
                "subscription": None,
                "customer": None
            }
    
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Site Details Error")
        return {"error": str(e)}


@frappe.whitelist()
def update_site_status(site_name, new_status):
    """
    Update the status of a customer site
    """
    try:
        site = frappe.get_doc("Customer Site", site_name)
        site.status = new_status
        site.save(ignore_permissions=True)
        frappe.db.commit()
        
        return {"success": True, "message": f"Site status updated to {new_status}"}
    
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Update Site Status Error")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_site_complete_details(site_name):
    """
    Get comprehensive information about a specific customer site
    """
    try:
        # Get Customer Site document
        site = frappe.get_doc("Customer Site", site_name)
        site_dict = site.as_dict()
        
        # Get Subscription details
        subscription_info = None
        customer_info = None
        if site.subscription:
            try:
                subscription = frappe.get_doc("Subscription", site.subscription)
                subscription_info = {
                    "name": subscription.name,
                    "status": subscription.status,
                    "start_date": subscription.start_date,
                    "end_date": subscription.end_date,
                    "current_invoice_start": subscription.current_invoice_start,
                    "current_invoice_end": subscription.current_invoice_end,
                    "is_provisioned": subscription.custom_is_provisioned,
                    "first_password": subscription.custom_first_password,
                    "changed_password": subscription.custom_changed_password if hasattr(subscription, 'custom_changed_password') else None,
                    "provisioning_log": subscription.custom_provisioning_log
                }
                
                # Get Customer details from subscription party field
                frappe.logger().info(f"[Site Details] Subscription party value: {subscription.party}")
                
                if subscription.party:
                    try:
                        # Check if customer exists
                        if not frappe.db.exists("Customer", subscription.party):
                            frappe.logger().error(f"[Site Details] Customer '{subscription.party}' not found in database")
                            customer_info = {
                                "error": f"Customer '{subscription.party}' not found",
                                "party": subscription.party
                            }
                        else:
                            customer = frappe.get_doc("Customer", subscription.party)
                            customer_info = {
                                "name": customer.name,
                                "customer_name": customer.customer_name or customer.name,
                                "email": customer.email_id or "",
                                "phone": customer.mobile_no or getattr(customer, 'phone', '') or "",
                                "customer_type": customer.customer_type or "Individual",
                                "creation": customer.creation
                            }
                            
                            frappe.logger().info(f"[Site Details] Customer found: {customer.customer_name} (email: {customer.email_id}) for site {site_name}")
                            
                            # Get Address linked to customer
                            addresses = frappe.get_all(
                                "Address",
                                filters={
                                    "link_doctype": "Customer",
                                    "link_name": customer.name
                                },
                                fields=["name", "address_line1", "address_line2", "city", "state", "country", "pincode"],
                                limit=1
                            )
                            
                            if addresses:
                                customer_info["address"] = addresses[0]
                                frappe.logger().info(f"[Site Details] Address found for customer {customer.name}")
                            else:
                                # Try dynamic links
                                address_links = frappe.get_all(
                                    "Dynamic Link",
                                    filters={
                                        "link_doctype": "Customer",
                                        "link_name": customer.name,
                                        "parenttype": "Address"
                                    },
                                    fields=["parent"],
                                    limit=1
                                )
                                
                                if address_links:
                                    addr_doc = frappe.get_doc("Address", address_links[0].parent)
                                    customer_info["address"] = {
                                        "name": addr_doc.name,
                                        "address_line1": addr_doc.address_line1,
                                        "address_line2": addr_doc.address_line2,
                                        "city": addr_doc.city,
                                        "state": addr_doc.state,
                                        "country": addr_doc.country,
                                        "pincode": addr_doc.pincode
                                    }
                                    frappe.logger().info(f"[Site Details] Address found via Dynamic Link for customer {customer.name}")
                                else:
                                    frappe.logger().info(f"[Site Details] No address found for customer {customer.name}")
                    except Exception as e:
                        error_msg = frappe.get_traceback()
                        frappe.log_error(error_msg, f"Get Site Details - Customer Error ({subscription.party})")
                        frappe.logger().error(f"[Site Details] Error fetching customer: {error_msg}")
                        customer_info = {
                            "error": str(e),
                            "party": subscription.party
                        }
                else:
                    frappe.logger().warning(f"[Site Details] No party field in subscription for site {site_name}")
                        
            except Exception as e:
                frappe.log_error(f"Error fetching subscription for site {site_name}: {str(e)}")
        
        # Get Plan details
        plan_info = None
        if site.plan:
            try:
                plan = frappe.get_doc("Subscription Plan", site.plan)
                plan_info = {
                    "name": plan.name,
                    "plan_name": plan.plan_name,
                    "cost": plan.cost,
                    "billing_interval": plan.billing_interval,
                    "billing_interval_count": plan.billing_interval_count,
                    "max_users": plan.custom_max_users,
                    "max_storage_mb": plan.custom_max_storage_mb,
                    "max_db_storage_mb": plan.custom_max_db_storage_mb,
                    "max_company": plan.custom_max_company,
                    "private_files_size_mb": plan.custom_private_files_size_mb,
                    "public_files_size_mb": plan.custom_public_files_size_mb
                }
                
                # Get document limits
                if plan.custom_document_limit:
                    plan_info["document_limits"] = []
                    for doc_limit in plan.custom_document_limit:
                        plan_info["document_limits"].append({
                            "document_type": doc_limit.document_type,
                            "limit": doc_limit.limit,
                            "period": doc_limit.period
                        })
            except Exception as e:
                frappe.log_error(f"Error fetching plan for site {site_name}: {str(e)}")
        
        # Get Domain details
        domain_info = None
        if site.domain:
            try:
                domain = frappe.get_doc("Saas Domain", site.domain)
                domain_info = {
                    "name": domain.name,
                    "domain": domain.domain,
                    "active": domain.active,
                    "in_use": domain.in_use,
                    "creation": domain.creation
                }
            except Exception as e:
                frappe.log_error(f"Error fetching domain for site {site_name}: {str(e)}")
        
        # Get site config (if accessible) - Contains quota information
        site_config = None
        quota_info = None
        try:
            config_path = f"/home/frappe/frappe-bench/sites/{site.site_name}/site_config.json"
            import os
            import json
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    site_config = json.load(f)
                    
                # Extract quota information and get actual usage from remote site
                if 'quota' in site_config:
                    quota = site_config['quota']
                    
                    # Get actual user count and company count using MySQL root connection
                    # Since each site has isolated database permissions, we need root access for cross-database queries
                    actual_user_count = 0
                    actual_company_count = 0
                    actual_db_size = quota.get('used_db_space', 0)
                    
                    try:
                        import pymysql
                        
                        # Get the db_name for this site
                        db_name = site_config.get('db_name')
                        
                        if db_name:
                            # Connect as root to query across databases
                            try:
                                connection = pymysql.connect(
                                    host='localhost',
                                    user='root',
                                    password='Intra$234',
                                    cursorclass=pymysql.cursors.DictCursor
                                )
                                
                                with connection:
                                    with connection.cursor() as cursor:
                                        # Query user count
                                        user_query = f"""
                                            SELECT COUNT(*) as count
                                            FROM `{db_name}`.`tabUser`
                                            WHERE enabled = 1
                                            AND user_type = 'System User'
                                            AND name NOT IN ('Administrator', 'Guest')
                                        """
                                        cursor.execute(user_query)
                                        result = cursor.fetchone()
                                        if result:
                                            actual_user_count = result.get('count', 0)
                                            frappe.logger().info(f"[Site Details] Actual user count for {site_name}: {actual_user_count}")
                                        
                                        # Query company count
                                        company_query = f"""
                                            SELECT COUNT(*) as count
                                            FROM `{db_name}`.`tabCompany`
                                        """
                                        cursor.execute(company_query)
                                        result = cursor.fetchone()
                                        if result:
                                            actual_company_count = result.get('count', 0)
                                            frappe.logger().info(f"[Site Details] Actual company count for {site_name}: {actual_company_count}")
                                        
                                        # Get DB size
                                        db_size_query = """
                                            SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
                                            FROM information_schema.TABLES
                                            WHERE table_schema = %s
                                        """
                                        cursor.execute(db_size_query, (db_name,))
                                        result = cursor.fetchone()
                                        if result:
                                            size_mb = result.get('size_mb')
                                            if size_mb is not None:
                                                actual_db_size = float(size_mb)
                                                frappe.logger().info(f"[Site Details] Actual DB size for {site_name}: {actual_db_size} MB")
                                        
                            except Exception as e:
                                frappe.logger().error(f"MySQL root query error for {site_name}: {str(e)}")
                                frappe.log_error(frappe.get_traceback(), f"MySQL Root Query Error - {site_name}")
                        
                        frappe.logger().info(f"[Site Details] Final counts for {site_name} - Users: {actual_user_count}, Companies: {actual_company_count}, DB Size: {actual_db_size} MB")
                                
                    except Exception as e:
                        frappe.log_error(frappe.get_traceback(), f"Error getting actual usage for {site_name}")
                        frappe.logger().error(f"Error getting actual usage for {site_name}: {str(e)}")
                    
                    quota_info = {
                        # User limits
                        "active_users_limit": quota.get('active_users', 0),
                        "users_limit": quota.get('users', 0),
                        "used_users": actual_user_count,
                        
                        # Storage limits (in MB)
                        "space_limit": quota.get('space', 0),
                        "used_space": quota.get('used_space', 0),
                        
                        "db_space_limit": quota.get('db_space', 0),
                        "used_db_space": actual_db_size,
                        
                        "private_files_limit": quota.get('private_files_size', 0),
                        "public_files_limit": quota.get('public_files_size', 0),
                        "backup_files_limit": quota.get('backup_files_size', 0),
                        
                        # Company limits (use actual count, not static value)
                        "company_limit": quota.get('company', 0),
                        "used_company": actual_company_count,
                        
                        # Validity
                        "valid_till": quota.get('valid_till', None),
                        
                        # Administrator and website user counts
                        "count_administrator": quota.get('count_administrator_user', 0),
                        "count_website_users": quota.get('count_website_users', 0),
                    }
        except Exception as e:
            frappe.log_error(f"Error reading site config for {site_name}: {str(e)}")
        
        # Calculate days until expiration
        days_until_expiry = None
        if site.end_date:
            from datetime import datetime
            today = datetime.strptime(nowdate(), "%Y-%m-%d")
            end_date = datetime.strptime(str(site.end_date), "%Y-%m-%d")
            days_until_expiry = (end_date - today).days
        
        # Get current password from Subscription's custom_changed_password field
        current_password = None
        if subscription_info and subscription_info.get('changed_password'):
            current_password = subscription_info['changed_password']
        else:
            current_password = "Not changed yet (use First Password)"
        
        # Return complete site information
        return {
            "site": site_dict,
            "subscription": subscription_info,
            "customer": customer_info,
            "plan": plan_info,
            "domain": domain_info,
            "site_config": site_config,
            "quota_info": quota_info,
            "days_until_expiry": days_until_expiry,
            "current_password": current_password
        }
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Site Complete Details Error")
        return {"error": str(e)}

