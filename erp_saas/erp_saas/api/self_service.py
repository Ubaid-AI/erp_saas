import frappe
import random
import string
from frappe.utils import nowdate, now_datetime, add_to_date, get_datetime

@frappe.whitelist(allow_guest=True)
def send_email_otp(email):
    """
    Generate and send a 6-digit OTP to the provided email.
    Stores OTP in database (tabSingles) for reliable cross-worker access.
    """
    if not email:
        return {'success': False, 'message': 'Email is required'}
    
    # Normalize email: lowercase and trim
    email = email.strip().lower()
    
    # Validate email format
    import re
    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        return {'success': False, 'message': 'Invalid email format'}
    
    # Generate 6-digit OTP
    otp = ''.join(random.choices(string.digits, k=6))
    
    # Calculate expiry time (10 minutes from now)
    expiry = add_to_date(now_datetime(), minutes=10)
    
    # Delete any existing OTP for this email
    frappe.db.sql("""
        DELETE FROM `tabSingles` 
        WHERE doctype = 'EmailOTP' 
        AND field = %s
    """, (email,))
    
    # Store new OTP in database using tabSingles
    frappe.db.sql("""
        INSERT INTO `tabSingles` (doctype, field, value) 
        VALUES ('EmailOTP', %s, %s)
    """, (email, f"{otp}|{expiry}|0"))
    
    frappe.db.commit()
    
    frappe.logger().info(f"OTP stored in DB for email: {email}, OTP: {otp}, Expiry: {expiry}")
    
    # Send email using the same method as provisioning
    try:
        frappe.sendmail(
            recipients=[email],
            subject="Your Email Verification Code - RiyalERP",
            message=f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #1F1F1F; text-align: center;">Email Verification</h2>
                    <p style="font-size: 16px;">Thank you for signing up with RiyalERP!</p>
                    <p style="font-size: 16px;">Your verification code is:</p>
                    <div style="background: linear-gradient(135deg, #1F1F1F, #2f2f2f); padding: 30px; text-align: center; border-radius: 10px; margin: 30px 0;">
                        <h1 style="color: #ffffff; font-size: 48px; letter-spacing: 10px; margin: 0; font-weight: bold;">{otp}</h1>
                    </div>
                    <p style="font-size: 14px; color: #666;">This code will expire in <strong>10 minutes</strong>.</p>
                    <p style="font-size: 14px; color: #666;">Please enter this code in the signup form to verify your email address.</p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">If you didn't request this code, please ignore this email.</p>
                    <p style="color: #999; font-size: 12px; text-align: center;">© RiyalERP - All rights reserved</p>
                </div>
            """,
            now=True
        )
        
        frappe.logger().info(f"OTP sent to {email}: {otp}")  # Log for debugging
        
        return {
            'success': True,
            'message': 'Verification code sent successfully! Please check your email.',
            'otp': otp  # For testing - REMOVE IN PRODUCTION
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "OTP Email Send Failed")
        frappe.logger().error(f"Failed to send OTP to {email}: {str(e)}")
        return {
            'success': False,
            'message': f'Failed to send email. Please check your email address or try again later.'
        }


@frappe.whitelist(allow_guest=True)
def verify_email_otp(email, otp):
    """
    Verify the OTP for the provided email.
    Retrieves OTP from database (tabSingles) for reliable verification.
    """
    try:
        if not email or not otp:
            return {'verified': False, 'message': 'Email and OTP are required'}
        
        # Normalize email: lowercase and trim (same as send_email_otp)
        email = email.strip().lower()
        otp = otp.strip()
        
        frappe.logger().info(f"Verifying OTP for email: {email}, OTP: {otp}")
        
        # Get OTP data from database using direct SQL
        result = frappe.db.sql("""
            SELECT value 
            FROM `tabSingles` 
            WHERE doctype = 'EmailOTP' 
            AND field = %s
            LIMIT 1
        """, (email,), as_dict=False)
        
        if not result or not result[0][0]:
            frappe.logger().error(f"No OTP found in DB for email: {email}")
            return {'verified': False, 'message': 'No verification code found. Please request a new code.'}
        
        stored_value = result[0][0]
        frappe.logger().info(f"Retrieved from DB: {stored_value}")
        
        # Parse stored value: format is "otp|expiry|attempts"
        try:
            parts = stored_value.split('|')
            stored_otp = parts[0]
            expiry_str = parts[1]
            attempts = int(parts[2]) if len(parts) > 2 else 0
        except Exception as e:
            frappe.logger().error(f"Error parsing OTP data: {e}, stored_value: {stored_value}")
            return {'verified': False, 'message': 'Invalid OTP data. Please request a new code.'}
        
        frappe.logger().info(f"Stored OTP: '{stored_otp}', Entered OTP: '{otp}', Attempts: {attempts}")
        
        # Check expiry
        expiry = get_datetime(expiry_str)
        if now_datetime() > expiry:
            # Delete expired OTP
            frappe.db.sql("""
                DELETE FROM `tabSingles` 
                WHERE doctype = 'EmailOTP' 
                AND field = %s
            """, (email,))
            frappe.db.commit()
            frappe.logger().warning(f"OTP expired for email: {email}")
            return {'verified': False, 'message': 'Verification code has expired. Please request a new code.'}
        
        # Check attempts
        if attempts >= 3:
            # Delete OTP after too many attempts
            frappe.db.sql("""
                DELETE FROM `tabSingles` 
                WHERE doctype = 'EmailOTP' 
                AND field = %s
            """, (email,))
            frappe.db.commit()
            frappe.logger().warning(f"Too many attempts for email: {email}")
            return {'verified': False, 'message': 'Too many failed attempts. Please request a new code.'}
        
        # Verify OTP
        if stored_otp == otp:
            # Delete OTP after successful verification
            frappe.db.sql("""
                DELETE FROM `tabSingles` 
                WHERE doctype = 'EmailOTP' 
                AND field = %s
            """, (email,))
            frappe.db.commit()
            frappe.logger().info(f"✓ OTP verified successfully for {email}")
            return {
                'verified': True,
                'message': 'Email verified successfully!'
            }
        else:
            # Increment attempts and update database
            attempts += 1
            frappe.db.sql("""
                UPDATE `tabSingles` 
                SET value = %s 
                WHERE doctype = 'EmailOTP' 
                AND field = %s
            """, (f"{stored_otp}|{expiry_str}|{attempts}", email))
            frappe.db.commit()
            
            remaining = 3 - attempts
            frappe.logger().warning(f"✗ Invalid OTP for email: {email}. Stored: '{stored_otp}' vs Entered: '{otp}'. Attempts remaining: {remaining}")
            return {
                'verified': False,
                'message': f'Invalid code. {remaining} attempt{"s" if remaining != 1 else ""} remaining.'
            }
    except Exception as e:
        frappe.logger().error(f"Exception in verify_email_otp: {str(e)}")
        frappe.log_error(frappe.get_traceback(), "OTP Verification Error")
        return {
            'verified': False,
            'message': 'Verification failed. Please try again or request a new code.'
        }


@frappe.whitelist(allow_guest=True)
def debug_check_otp(email):
    """
    Debug function to check what OTP is stored for an email.
    """
    email = email.strip().lower()
    
    result = frappe.db.sql("""
        SELECT field, value, doctype 
        FROM `tabSingles` 
        WHERE doctype = 'EmailOTP' 
        AND field = %s
    """, (email,), as_dict=True)
    
    all_otps = frappe.db.sql("""
        SELECT field, value, doctype 
        FROM `tabSingles` 
        WHERE doctype = 'EmailOTP'
    """, as_dict=True)
    
    return {
        'email': email,
        'found': bool(result),
        'data': result[0] if result else None,
        'all_otps': all_otps
    }


@frappe.whitelist(allow_guest=True)
def get_published_plans():
    """
    Returns all Subscription Plan docs with custom_publish=1,
    sorted by custom_card_sequence ascending, and including
    hot, old_price, cost, and currency symbol from Global Defaults.
    """
    # Fetch default currency code from Global Defaults
    default_currency = frappe.get_single('Global Defaults').default_currency
    # Look up its symbol in the Currency doctype
    currency_symbol = frappe.db.get_value("Currency", default_currency, "symbol") or default_currency

    plans = frappe.get_all(
        "Subscription Plan",
        filters={"custom_publish": 1},
        fields=[
            "name", "plan_name", "custom_card_sequence",
            "custom_hot", "custom_old_price", "cost",
            "custom_max_users", "custom_max_company",
            "custom_max_db_storage_mb", "custom_max_storage_mb",
            "custom_private_files_size_mb", "custom_public_files_size_mb", "custom_trial_in_days"
        ]
    )

    out = []
    for p in plans:
        doc = frappe.get_doc("Subscription Plan", p.name)
        first_limit = doc.custom_document_limit and doc.custom_document_limit[0]
        out.append({
            "name":             p.name,
            "plan_name":        p.plan_name,
            "sequence":         p.custom_card_sequence or 0,
            "hot":              bool(p.custom_hot),
            "old_price":        p.custom_old_price or 0,
            "cost":             p.cost or 0,
            "currency":         currency_symbol,
            "max_users":        p.custom_max_users,
            "trial_days":       p.custom_trial_in_days,
            "max_companies":    p.custom_max_company,
            "db_storage_mb":    p.custom_max_db_storage_mb,
            "storage_mb":       p.custom_max_storage_mb,
            "private_files_mb": p.custom_private_files_size_mb,
            "public_files_mb":  p.custom_public_files_size_mb,
            "doc_type":         first_limit.document_type if first_limit else "",
            "doc_limit":        first_limit.limit         if first_limit else 0,
            "doc_period":       first_limit.period        if first_limit else ""
        })

    # sort by sequence ascending
    out.sort(key=lambda x: x["sequence"])
    return out


@frappe.whitelist(allow_guest=True)
def get_country_list():
    """
    Return a list of all Country names for the signup form.
    """
    return frappe.get_all("Country", fields=["name"])


@frappe.whitelist(allow_guest=True)
def check_subdomain_availability(subdomain):
    """
    Check if a subdomain is available for registration.
    Returns availability status and sanitized subdomain.
    """
    import re
    
    if not subdomain:
        return {
            'available': False,
            'message': 'Please enter a subdomain',
            'subdomain': ''
        }
    
    # Sanitize subdomain: lowercase, alphanumeric and hyphens only
    subdomain = subdomain.lower().strip()
    subdomain = re.sub(r'[^a-z0-9-]', '', subdomain)
    
    # Validation rules
    if len(subdomain) < 3:
        return {
            'available': False,
            'message': 'Subdomain must be at least 3 characters',
            'subdomain': subdomain
        }
    
    if len(subdomain) > 63:
        return {
            'available': False,
            'message': 'Subdomain must be less than 63 characters',
            'subdomain': subdomain
        }
    
    if subdomain.startswith('-') or subdomain.endswith('-'):
        return {
            'available': False,
            'message': 'Subdomain cannot start or end with a hyphen',
            'subdomain': subdomain
        }
    
    # Reserved subdomains
    reserved = ['www', 'mail', 'ftp', 'admin', 'root', 'test', 'demo', 'api', 
                'app', 'staging', 'dev', 'prod', 'cpanel', 'webmail', 'smtp', 
                'pop', 'imap', 'ns1', 'ns2', 'localhost']
    
    if subdomain in reserved:
        return {
            'available': False,
            'message': 'This subdomain is reserved and cannot be used',
            'subdomain': subdomain
        }
    
    # Build full domain
    base_domain = "riyalsystem.com.sa"
    full_domain = f"{subdomain}.{base_domain}"
    
    # Check if domain exists in Saas Domain doctype
    existing = frappe.db.exists("Saas Domain", {"domain": full_domain})
    
    if existing:
        return {
            'available': False,
            'message': 'This subdomain is already taken',
            'subdomain': subdomain,
            'full_domain': full_domain
        }
    
    return {
        'available': True,
        'message': 'Subdomain is available!',
        'subdomain': subdomain,
        'full_domain': full_domain
    }


@frappe.whitelist(allow_guest=True)
def register_and_subscribe(first_name, last_name, email, phone,
                           street, city, state, postal, country,
                           plan_name, start_date, end_date, subdomain):
    """
    Create Customer + Address + Subscription in one go.
    Validates subdomain and stores it for provisioning.
    Returns the new Subscription name.
    """
    # Validate subdomain availability one more time before proceeding
    subdomain_check = check_subdomain_availability(subdomain)
    if not subdomain_check.get('available'):
        frappe.throw(subdomain_check.get('message', 'Invalid subdomain'))
    
    full_domain = subdomain_check.get('full_domain')
    
    # 1) Customer
    cust = frappe.get_doc({
        "doctype": "Customer",
        "customer_name": f"{first_name} {last_name}",
        "email_id": email,
        "phone": phone
    }).insert(ignore_permissions=True)

    # 2) Address
    frappe.get_doc({
        "doctype": "Address",
        "address_title": f"{first_name} {last_name} Address",
        "address_line1": street,
        "city": city,
        "state": state,
        "country": country,
        "pincode": postal,
        "links": [{"link_doctype":"Customer", "link_name": cust.name}]
    }).insert(ignore_permissions=True)

    # 3) Subscription with custom_site_name (chosen subdomain)
    sub = frappe.get_doc({
        "doctype": "Subscription",
        "party_type": "Customer",
        "party": cust.name,
        "start_date": start_date or nowdate(),
        "end_date": end_date,
        "plans": [{"plan": plan_name, "qty": 1}],
        "custom_site_name": full_domain  # Store chosen domain for provisioning
    })
    sub.flags.ignore_validate = True
    sub.insert(ignore_permissions=True)

    return sub.name