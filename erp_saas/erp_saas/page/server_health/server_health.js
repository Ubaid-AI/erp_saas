frappe.pages['server-health'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Server health',
		single_column: true
	});
}