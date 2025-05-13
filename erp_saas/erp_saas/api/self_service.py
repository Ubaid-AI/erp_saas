import frappe

from frappe.utils import nowdate

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
def register_and_subscribe(first_name, last_name, email, phone,
                           street, city, state, postal, country,
                           plan_name, start_date, end_date):
    """
    Create Customer + Address + Subscription in one go.
    Returns the new Subscription name.
    """
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

    # 3) Subscription
    sub = frappe.get_doc({
        "doctype": "Subscription",
        "party_type": "Customer",
        "party": cust.name,
        "start_date": start_date or nowdate(),
        "end_date": end_date,
        "plans": [{"plan": plan_name, "qty": 1}]
    })
    sub.flags.ignore_validate = True
    sub.insert(ignore_permissions=True)

    return sub.name