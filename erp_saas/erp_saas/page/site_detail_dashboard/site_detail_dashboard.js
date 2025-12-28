frappe.pages['site-detail-dashboard'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Site Details',
		single_column: true
	});

	// Add custom styles
	frappe.require('/assets/erp_saas/css/site_detail_dashboard.css');

	// Ensure Font Awesome is loaded
	if (!$('link[href*="font-awesome"]').length) {
		$('<link>')
			.attr('rel', 'stylesheet')
			.attr('href', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css')
			.attr('crossorigin', 'anonymous')
			.appendTo('head');
	}

	// Store page reference
	page.site_detail_dashboard = null;
}

frappe.pages['site-detail-dashboard'].on_page_show = function(wrapper) {
	// Get the page object
	var page = wrapper.page;
	
	// Get current site name from route
	const current_site = frappe.get_route()[1];
	
	// Check if we need to create a new instance or reload existing one
	if (!page.site_detail_dashboard || page.site_detail_dashboard.site_name !== current_site) {
		// Clear any existing content
		$(page.body).empty();
		
		// Destroy old instance if exists
		if (page.site_detail_dashboard) {
			page.site_detail_dashboard.destroy();
		}
		
		// Create new instance with current site
		page.site_detail_dashboard = new SiteDetailDashboard(page);
	}
}

class SiteDetailDashboard {
	constructor(page) {
		this.page = page;
		this.wrapper = $(this.page.body);
		this.data = null;
		
		// Get site name from route
		this.site_name = frappe.get_route()[1];
		
		// Update page title
		if (this.page && this.site_name) {
			this.page.set_title(`Site: ${this.site_name}`);
		}
		
		// Setup and load data
		this.setup_page();
		this.load_site_data();
	}
	
	destroy() {
		// Clean up event handlers and clear data
		$('#btn-activate').off('click');
		$('#btn-suspend').off('click');
		$('#btn-edit').off('click');
		$('.nav-tabs .nav-link').off('click');
		$('#btn-copy-first-password').off('click');
		$('#btn-copy-current-password').off('click');
		
		this.data = null;
		this.wrapper.empty();
	}

	setup_page() {
		// Add back button
		this.page.add_button('Back to Dashboard', () => {
			frappe.set_route('admin-dashboard');
		}, 'secondary');

		// Add refresh button
		this.page.add_button('Refresh', () => {
			this.load_site_data();
		}, 'primary');

		// Create dashboard container
		this.wrapper.html(`
			<div class="site-detail-container">
				<!-- Loading Spinner -->
				<div id="site-loading" class="site-loading">
					<div class="spinner-border text-primary" role="status">
						<span class="sr-only">Loading...</span>
					</div>
					<p class="mt-3">Loading site details...</p>
				</div>

				<!-- Site Detail Content -->
				<div id="site-content" style="display: none;">
					<!-- Site Header -->
					<div class="site-header mb-4">
						<div class="row align-items-center">
							<div class="col-md-8">
								<h2 class="site-title mb-2">
									<i class="fas fa-server"></i>
									<span id="site-title-name">Loading...</span>
								</h2>
								<div class="site-meta">
									<span class="badge" id="site-status-badge">Status</span>
									<span class="ml-3 text-muted">
										<i class="fas fa-clock"></i> Created: <span id="site-created">-</span>
									</span>
								</div>
							</div>
							<div class="col-md-4 text-right">
								<div class="btn-group" role="group">
									<button class="btn btn-sm btn-success" id="btn-activate">
										<i class="fas fa-play"></i> Activate
									</button>
									<button class="btn btn-sm btn-warning" id="btn-suspend">
										<i class="fas fa-pause"></i> Suspend
									</button>
									<button class="btn btn-sm btn-info" id="btn-edit">
										<i class="fas fa-edit"></i> Edit
									</button>
								</div>
							</div>
						</div>
					</div>

					<!-- Quick Stats -->
					<div class="row mb-4">
						<div class="col-md-3">
							<div class="info-card">
								<div class="info-icon bg-primary">
									<i class="fas fa-users"></i>
								</div>
								<div class="info-content">
									<div class="info-label">Users</div>
									<div class="info-value" id="stat-users">-</div>
									<div class="info-progress">
										<div class="progress" style="height: 6px;">
											<div class="progress-bar bg-primary" id="stat-users-bar" style="width: 0%"></div>
										</div>
										<small class="text-muted" id="stat-users-text">-</small>
									</div>
								</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="info-card">
								<div class="info-icon bg-success">
									<i class="fas fa-database"></i>
								</div>
								<div class="info-content">
									<div class="info-label">DB Storage</div>
									<div class="info-value" id="stat-db-storage">-</div>
									<div class="info-progress">
										<div class="progress" style="height: 6px;">
											<div class="progress-bar bg-success" id="stat-db-bar" style="width: 0%"></div>
										</div>
										<small class="text-muted" id="stat-db-text">-</small>
									</div>
								</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="info-card">
								<div class="info-icon bg-info">
									<i class="fas fa-hdd"></i>
								</div>
								<div class="info-content">
									<div class="info-label">Total Storage</div>
									<div class="info-value" id="stat-total-storage">-</div>
									<div class="info-progress">
										<div class="progress" style="height: 6px;">
											<div class="progress-bar bg-info" id="stat-storage-bar" style="width: 0%"></div>
										</div>
										<small class="text-muted" id="stat-storage-text">-</small>
									</div>
								</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="info-card">
								<div class="info-icon bg-warning">
									<i class="fas fa-building"></i>
								</div>
								<div class="info-content">
									<div class="info-label">Companies</div>
									<div class="info-value" id="stat-companies">-</div>
									<div class="info-progress">
										<div class="progress" style="height: 6px;">
											<div class="progress-bar bg-warning" id="stat-companies-bar" style="width: 0%"></div>
										</div>
										<small class="text-muted" id="stat-companies-text">-</small>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Main Content Tabs -->
					<ul class="nav nav-tabs mb-3" role="tablist">
						<li class="nav-item">
							<a class="nav-link active" data-tab="tab-overview">
								<i class="fas fa-info-circle"></i> Overview
							</a>
						</li>
						<li class="nav-item">
							<a class="nav-link" data-tab="tab-customer">
								<i class="fas fa-user"></i> Customer
							</a>
						</li>
						<li class="nav-item">
							<a class="nav-link" data-tab="tab-subscription">
								<i class="fas fa-file-contract"></i> Subscription
							</a>
						</li>
						<li class="nav-item">
							<a class="nav-link" data-tab="tab-plan">
								<i class="fas fa-box"></i> Plan & Limits
							</a>
						</li>
						<li class="nav-item">
							<a class="nav-link" data-tab="tab-config">
								<i class="fas fa-cog"></i> Configuration
							</a>
						</li>
					</ul>

					<div class="tab-content">
						<!-- Overview Tab -->
						<div id="tab-overview" class="tab-pane fade show active">
							<div class="row">
								<div class="col-md-6">
									<div class="detail-card">
										<h5 class="card-title"><i class="fas fa-server"></i> Site Information</h5>
										<table class="detail-table">
											<tr>
												<td class="detail-label">Site Name:</td>
												<td class="detail-value" id="detail-site-name">-</td>
											</tr>
											<tr>
												<td class="detail-label">Domain:</td>
												<td class="detail-value">
													<a href="#" id="detail-domain-link" target="_blank">-</a>
												</td>
											</tr>
											<tr>
												<td class="detail-label">Status:</td>
												<td class="detail-value" id="detail-status">-</td>
											</tr>
											<tr>
												<td class="detail-label">Created On:</td>
												<td class="detail-value" id="detail-created">-</td>
											</tr>
											<tr>
												<td class="detail-label">Modified On:</td>
												<td class="detail-value" id="detail-modified">-</td>
											</tr>
											<tr>
												<td class="detail-label">End Date:</td>
												<td class="detail-value" id="detail-end-date">-</td>
											</tr>
										</table>
									</div>
								</div>
								<div class="col-md-6">
									<div class="detail-card">
										<h5 class="card-title"><i class="fas fa-key"></i> Access Credentials</h5>
										<table class="detail-table">
											<tr>
												<td class="detail-label">Login URL:</td>
												<td class="detail-value">
													<a href="#" id="access-url" target="_blank">-</a>
												</td>
											</tr>
											<tr>
												<td class="detail-label">Username:</td>
												<td class="detail-value">Administrator</td>
											</tr>
											<tr>
												<td class="detail-label">First Password:</td>
												<td class="detail-value">
													<code id="access-first-password">-</code>
													<button class="btn btn-xs btn-secondary ml-2" id="btn-copy-first-password">
														<i class="fas fa-copy"></i> Copy
													</button>
												</td>
											</tr>
											<tr>
												<td class="detail-label">Current Password:</td>
												<td class="detail-value">
													<code id="access-current-password">-</code>
													<button class="btn btn-xs btn-secondary ml-2" id="btn-copy-current-password">
														<i class="fas fa-copy"></i> Copy
													</button>
												</td>
											</tr>
											<tr>
												<td colspan="2">
													<div class="alert alert-info mt-2 mb-0" style="font-size: 12px;">
														<i class="fas fa-info-circle"></i>
														<strong>First Password:</strong> Initial password sent via email<br>
														<strong>Current Password:</strong> Actual password stored in database (if not changed by user)
													</div>
												</td>
											</tr>
										</table>
									</div>
								</div>
							</div>

							<div class="row mt-3">
								<div class="col-12">
									<div class="detail-card">
										<h5 class="card-title"><i class="fas fa-sticky-note"></i> Notes</h5>
										<div id="detail-notes" class="text-muted">No notes available</div>
									</div>
								</div>
							</div>
						</div>

						<!-- Customer Tab -->
						<div id="tab-customer" class="tab-pane fade">
							<div class="row">
								<div class="col-md-6">
									<div class="detail-card">
										<h5 class="card-title"><i class="fas fa-user"></i> Customer Details</h5>
										<table class="detail-table">
											<tr>
												<td class="detail-label">Customer Name:</td>
												<td class="detail-value" id="customer-name">-</td>
											</tr>
											<tr>
												<td class="detail-label">Email:</td>
												<td class="detail-value">
													<a href="#" id="customer-email">-</a>
												</td>
											</tr>
											<tr>
												<td class="detail-label">Phone:</td>
												<td class="detail-value" id="customer-phone">-</td>
											</tr>
											<tr>
												<td class="detail-label">Customer Type:</td>
												<td class="detail-value" id="customer-type">-</td>
											</tr>
											<tr>
												<td class="detail-label">Customer Since:</td>
												<td class="detail-value" id="customer-since">-</td>
											</tr>
										</table>
									</div>
								</div>
								<div class="col-md-6">
									<div class="detail-card">
										<h5 class="card-title"><i class="fas fa-map-marker-alt"></i> Address</h5>
										<div id="customer-address" class="text-muted">No address available</div>
									</div>
								</div>
							</div>
						</div>

						<!-- Subscription Tab -->
						<div id="tab-subscription" class="tab-pane fade">
							<div class="detail-card">
								<h5 class="card-title"><i class="fas fa-file-contract"></i> Subscription Details</h5>
								<table class="detail-table">
									<tr>
										<td class="detail-label">Subscription ID:</td>
										<td class="detail-value" id="sub-id">-</td>
									</tr>
									<tr>
										<td class="detail-label">Status:</td>
										<td class="detail-value" id="sub-status">-</td>
									</tr>
									<tr>
										<td class="detail-label">Start Date:</td>
										<td class="detail-value" id="sub-start">-</td>
									</tr>
									<tr>
										<td class="detail-label">End Date:</td>
										<td class="detail-value" id="sub-end">-</td>
									</tr>
									<tr>
										<td class="detail-label">Current Invoice Period:</td>
										<td class="detail-value">
											<span id="sub-invoice-start">-</span> to <span id="sub-invoice-end">-</span>
										</td>
									</tr>
									<tr>
										<td class="detail-label">Is Provisioned:</td>
										<td class="detail-value" id="sub-provisioned">-</td>
									</tr>
									<tr>
										<td class="detail-label">Provisioning Log:</td>
										<td class="detail-value">
											<pre id="sub-log" style="max-height: 200px; overflow-y: auto;">-</pre>
										</td>
									</tr>
								</table>
							</div>
						</div>

						<!-- Plan Tab -->
						<div id="tab-plan" class="tab-pane fade">
							<div class="row">
								<div class="col-md-6">
									<div class="detail-card">
										<h5 class="card-title"><i class="fas fa-box"></i> Plan Information</h5>
										<table class="detail-table">
											<tr>
												<td class="detail-label">Plan Name:</td>
												<td class="detail-value" id="plan-name">-</td>
											</tr>
											<tr>
												<td class="detail-label">Cost:</td>
												<td class="detail-value" id="plan-cost">-</td>
											</tr>
											<tr>
												<td class="detail-label">Billing Interval:</td>
												<td class="detail-value" id="plan-billing">-</td>
											</tr>
										</table>
									</div>
								</div>
								<div class="col-md-6">
									<div class="detail-card">
										<h5 class="card-title"><i class="fas fa-chart-bar"></i> Resource Limits</h5>
										<table class="detail-table">
											<tr>
												<td class="detail-label">Max Users:</td>
												<td class="detail-value" id="plan-users">-</td>
											</tr>
											<tr>
												<td class="detail-label">Max Companies:</td>
												<td class="detail-value" id="plan-companies">-</td>
											</tr>
											<tr>
												<td class="detail-label">Total Storage:</td>
												<td class="detail-value" id="plan-storage">-</td>
											</tr>
											<tr>
												<td class="detail-label">DB Storage:</td>
												<td class="detail-value" id="plan-db-storage">-</td>
											</tr>
											<tr>
												<td class="detail-label">Private Files:</td>
												<td class="detail-value" id="plan-private">-</td>
											</tr>
											<tr>
												<td class="detail-label">Public Files:</td>
												<td class="detail-value" id="plan-public">-</td>
											</tr>
										</table>
									</div>
								</div>
							</div>

							<div class="row mt-3">
								<div class="col-12">
									<div class="detail-card">
										<h5 class="card-title"><i class="fas fa-file-alt"></i> Document Limits</h5>
										<div id="plan-doc-limits">No document limits set</div>
									</div>
								</div>
							</div>
						</div>

						<!-- Configuration Tab -->
						<div id="tab-config" class="tab-pane fade">
							<div class="detail-card">
								<h5 class="card-title"><i class="fas fa-cog"></i> Site Configuration</h5>
								<pre id="config-content" style="max-height: 500px; overflow-y: auto; background: #f5f5f5; padding: 15px; border-radius: 8px;">Loading configuration...</pre>
							</div>
						</div>
					</div>
				</div>
			</div>
		`);

		this.setup_event_handlers();
	}

	setup_event_handlers() {
		// Activate button
		$('#btn-activate').on('click', () => {
			this.update_site_status('Active');
		});

		// Suspend button
		$('#btn-suspend').on('click', () => {
			this.update_site_status('Suspended');
		});

		// Edit button
		$('#btn-edit').on('click', () => {
			frappe.set_route('Form', 'Customer Site', this.site_name);
		});

		// Tab switching (prevent Frappe routing)
		$('.nav-tabs .nav-link').on('click', function(e) {
			e.preventDefault();
			e.stopPropagation();
			
			const targetTab = $(this).data('tab');
			
			// Remove active class from all tabs and panes
			$('.nav-tabs .nav-link').removeClass('active');
			$('.tab-pane').removeClass('show active');
			
			// Add active class to clicked tab and corresponding pane
			$(this).addClass('active');
			$('#' + targetTab).addClass('show active');
		});

		// Copy first password button
		$('#btn-copy-first-password').on('click', () => {
			const password = $('#access-first-password').text();
			if (password && password !== '-' && password !== 'Not available') {
				navigator.clipboard.writeText(password).then(() => {
					frappe.show_alert({
						message: 'First password copied to clipboard!',
						indicator: 'green'
					});
				});
			}
		});

		// Copy current password button
		$('#btn-copy-current-password').on('click', () => {
			const password = $('#access-current-password').text();
			if (password && password !== '-' && password !== 'Not available') {
				navigator.clipboard.writeText(password).then(() => {
					frappe.show_alert({
						message: 'Current password copied to clipboard!',
						indicator: 'green'
					});
				});
			}
		});
	}

	async load_site_data() {
		$('#site-loading').show();
		$('#site-content').hide();

		try {
			const response = await frappe.call({
				method: 'erp_saas.erp_saas.api.dashboard_api.get_site_complete_details',
				args: { site_name: this.site_name },
				freeze: true,
				freeze_message: 'Loading site details...'
			});

			if (response.message && !response.message.error) {
				this.data = response.message;
				this.render_site_details();
				$('#site-loading').hide();
				$('#site-content').fadeIn();
			} else {
				throw new Error(response.message.error || 'Failed to load site details');
			}
		} catch (error) {
			console.error('Error loading site data:', error);
			frappe.msgprint({
				title: 'Error',
				message: 'Failed to load site details. Please try again.',
				indicator: 'red'
			});
		}
	}

	render_site_details() {
		if (!this.data) return;

		const { site, subscription, customer, plan, domain, site_config, quota_info, days_until_expiry } = this.data;

		// Update page title
		this.page.set_title(`Site: ${site.site_name}`);
		$('#site-title-name').text(site.site_name);

		// Update status badge
		const statusClass = this.get_status_class(site.status);
		$('#site-status-badge').removeClass().addClass(`badge badge-${statusClass}`).text(site.status);

		// Update created date
		$('#site-created').text(frappe.datetime.str_to_user(site.creation));

		// Update quick stats with real usage data
		console.log('Quota info:', quota_info); // Debug log
		if (quota_info) {
			// Users
			const usedUsers = quota_info.used_users || 0;
			const limitUsers = quota_info.users_limit || quota_info.active_users_limit || 0;
			const userPercent = limitUsers > 0 && usedUsers > 0 ? Math.min((usedUsers / limitUsers) * 100, 100) : 0;
			
			if (limitUsers > 0) {
				$('#stat-users').text(`${usedUsers} / ${limitUsers}`);
				if (usedUsers > 0) {
					$('#stat-users-bar').css('width', `${userPercent}%`);
					$('#stat-users-text').text(`${userPercent.toFixed(0)}% used`);
				} else {
					$('#stat-users-bar').css('width', '2%'); // Small bar to indicate zero
					$('#stat-users-text').html('<span style="color: #28a745;">✓ No users yet</span>');
				}
			} else {
				$('#stat-users').text('0 / 0');
				$('#stat-users-bar').css('width', '0%');
				$('#stat-users-text').text('No limit set');
			}
			
			if (userPercent > 90) {
				$('#stat-users-bar').removeClass('bg-primary').addClass('bg-danger');
			} else if (userPercent > 75) {
				$('#stat-users-bar').removeClass('bg-primary').addClass('bg-warning');
			}

			// DB Storage
			const usedDb = quota_info.used_db_space || 0;
			const limitDb = quota_info.db_space_limit || 0;
			const dbPercent = limitDb > 0 && usedDb > 0 ? Math.min((usedDb / limitDb) * 100, 100) : 0;
			
			if (limitDb > 0) {
				$('#stat-db-storage').text(`${usedDb.toFixed(2)} / ${limitDb} MB`);
				if (usedDb > 0) {
					$('#stat-db-bar').css('width', `${Math.max(dbPercent, 1)}%`); // Min 1% to show bar
					$('#stat-db-text').text(`${dbPercent.toFixed(1)}% used`);
				} else {
					$('#stat-db-bar').css('width', '2%'); // Small bar to indicate zero
					$('#stat-db-text').html('<span style="color: #28a745;">✓ Fresh database</span>');
				}
			} else {
				$('#stat-db-storage').text('0 / 0 MB');
				$('#stat-db-bar').css('width', '0%');
				$('#stat-db-text').text('No limit set');
			}
			
			if (dbPercent > 90) {
				$('#stat-db-bar').removeClass('bg-success').addClass('bg-danger');
			} else if (dbPercent > 75) {
				$('#stat-db-bar').removeClass('bg-success').addClass('bg-warning');
			}

			// Total Storage
			const usedStorage = quota_info.used_space || 0;
			const limitStorage = quota_info.space_limit || 0;
			const storagePercent = limitStorage > 0 && usedStorage > 0 ? Math.min((usedStorage / limitStorage) * 100, 100) : 0;
			
			if (limitStorage > 0) {
				$('#stat-total-storage').text(`${usedStorage} / ${limitStorage} MB`);
				$('#stat-storage-bar').css('width', `${Math.max(storagePercent, 0.5)}%`);
				$('#stat-storage-text').text(`${storagePercent.toFixed(1)}% used`);
			} else {
				$('#stat-total-storage').text('0 / 0 MB');
				$('#stat-storage-text').text('No limit set');
			}
			
			if (storagePercent > 90) {
				$('#stat-storage-bar').removeClass('bg-info').addClass('bg-danger');
			} else if (storagePercent > 75) {
				$('#stat-storage-bar').removeClass('bg-info').addClass('bg-warning');
			}

			// Companies
			const usedCompanies = quota_info.used_company || 0;
			const limitCompanies = quota_info.company_limit || 0;
			const companyPercent = limitCompanies > 0 ? Math.min((usedCompanies / limitCompanies) * 100, 100) : 0;
			
			if (limitCompanies > 0) {
				$('#stat-companies').text(`${usedCompanies} / ${limitCompanies}`);
				$('#stat-companies-bar').css('width', `${Math.max(companyPercent, 5)}%`); // Min 5% to show bar
				$('#stat-companies-text').text(`${companyPercent.toFixed(0)}% used`);
			} else {
				$('#stat-companies').text('0 / 0');
				$('#stat-companies-text').text('No limit set');
			}
			
			if (companyPercent > 90) {
				$('#stat-companies-bar').removeClass('bg-warning').addClass('bg-danger');
			}
		} else {
			// Fallback to plan limits if quota_info not available
			$('#stat-users').text(site.max_users || '0');
			$('#stat-db-storage').text(`${site.max_db_storage_mb || 0} MB`);
			$('#stat-total-storage').text(`${site.max_storage_mb || 0} MB`);
			$('#stat-companies').text(site.max_company || '0');
			$('#stat-users-text').text('No usage data');
			$('#stat-db-text').text('No usage data');
			$('#stat-storage-text').text('No usage data');
			$('#stat-companies-text').text('No usage data');
		}

		// Overview Tab
		$('#detail-site-name').text(site.site_name);
		if (domain) {
			$('#detail-domain-link').text(domain.domain).attr('href', `https://${domain.domain}`);
		}
		$('#detail-status').html(`<span class="badge badge-${statusClass}">${site.status}</span>`);
		$('#detail-created').text(frappe.datetime.str_to_user(site.creation));
		$('#detail-modified').text(frappe.datetime.str_to_user(site.modified));
		$('#detail-end-date').text(site.end_date ? frappe.datetime.str_to_user(site.end_date) : 'N/A');
		$('#detail-notes').text(site.notes || 'No notes available');

		// Access credentials
		$('#access-url').text(`https://${site.site_name}`).attr('href', `https://${site.site_name}`);
		
		// First password (from subscription)
		if (subscription && subscription.first_password) {
			$('#access-first-password').text(subscription.first_password);
		} else {
			$('#access-first-password').text('Not available');
			$('#btn-copy-first-password').prop('disabled', true);
		}
		
		// Current password (from User document)
		if (this.data.current_password) {
			$('#access-current-password').text(this.data.current_password);
		} else {
			$('#access-current-password').text('Not available');
			$('#btn-copy-current-password').prop('disabled', true);
		}

		// Customer Tab
		console.log('Customer data received:', customer); // Debug log
		console.log('Full data object:', this.data); // Debug full data
		
		if (customer && !customer.error) {
			$('#customer-name').text(customer.customer_name || 'N/A');
			$('#customer-email').text(customer.email || 'N/A').attr('href', customer.email ? `mailto:${customer.email}` : '#');
			$('#customer-phone').text(customer.phone || 'N/A');
			$('#customer-type').text(customer.customer_type || 'Individual');
			$('#customer-since').text(customer.creation ? frappe.datetime.str_to_user(customer.creation) : 'N/A');

			if (customer.address) {
				const addr = customer.address;
				const addressHTML = `
					<p class="mb-0">${addr.address_line1 || ''}</p>
					${addr.address_line2 ? `<p class="mb-0">${addr.address_line2}</p>` : ''}
					<p class="mb-0">${addr.city || ''}, ${addr.state || ''} ${addr.pincode || ''}</p>
					<p class="mb-0">${addr.country || ''}</p>
				`;
				$('#customer-address').html(addressHTML);
			} else {
				$('#customer-address').html('<p class="text-muted">No address on file</p>');
			}
		} else if (customer && customer.error) {
			// Error state - show error details
			console.error('Customer error:', customer.error, 'Party:', customer.party);
			$('#customer-name').text(`Error: ${customer.error}`);
			$('#customer-email').text(`Party: ${customer.party || 'N/A'}`);
			$('#customer-phone').text('N/A');
			$('#customer-type').text('N/A');
			$('#customer-since').text('N/A');
			$('#customer-address').html('<p class="text-danger">Error fetching customer data. Check console for details.</p>');
		} else {
			// No customer data available
			console.log('No customer data available');
			$('#customer-name').text('Not available');
			$('#customer-email').text('Not available');
			$('#customer-phone').text('Not available');
			$('#customer-type').text('Not available');
			$('#customer-since').text('Not available');
			$('#customer-address').html('<p class="text-muted">Customer information not found</p>');
		}

		// Subscription Tab
		if (subscription) {
			$('#sub-id').text(subscription.name);
			$('#sub-status').text(subscription.status);
			$('#sub-start').text(subscription.start_date ? frappe.datetime.str_to_user(subscription.start_date) : 'N/A');
			$('#sub-end').text(subscription.end_date ? frappe.datetime.str_to_user(subscription.end_date) : 'N/A');
			$('#sub-invoice-start').text(subscription.current_invoice_start ? frappe.datetime.str_to_user(subscription.current_invoice_start) : 'N/A');
			$('#sub-invoice-end').text(subscription.current_invoice_end ? frappe.datetime.str_to_user(subscription.current_invoice_end) : 'N/A');
			$('#sub-provisioned').html(subscription.is_provisioned ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-warning">No</span>');
			$('#sub-log').text(subscription.provisioning_log || 'No log available');
		}

		// Plan Tab
		if (plan) {
			$('#plan-name').text(plan.plan_name);
			$('#plan-cost').html(`<span class="sar-symbol">§</span> ${plan.cost}`);
			$('#plan-billing').text(`${plan.billing_interval_count || 1} ${plan.billing_interval || 'Month'}(s)`);
			$('#plan-users').text(plan.max_users || '0');
			$('#plan-companies').text(plan.max_company || '0');
			$('#plan-storage').text(`${plan.max_storage_mb || 0} MB`);
			$('#plan-db-storage').text(`${plan.max_db_storage_mb || 0} MB`);
			$('#plan-private').text(`${plan.private_files_size_mb || 0} MB`);
			$('#plan-public').text(`${plan.public_files_size_mb || 0} MB`);

			if (plan.document_limits && plan.document_limits.length > 0) {
				let docLimitsHTML = '<table class="table table-sm table-bordered"><thead><tr><th>Document Type</th><th>Limit</th><th>Period</th></tr></thead><tbody>';
				plan.document_limits.forEach(limit => {
					docLimitsHTML += `<tr><td>${limit.document_type}</td><td>${limit.limit}</td><td>${limit.period}</td></tr>`;
				});
				docLimitsHTML += '</tbody></table>';
				$('#plan-doc-limits').html(docLimitsHTML);
			}
		}

		// Configuration Tab
		if (site_config) {
			$('#config-content').text(JSON.stringify(site_config, null, 2));
		} else {
			$('#config-content').text('Configuration not accessible');
		}
	}

	get_status_class(status) {
		const statusMap = {
			'Active': 'success',
			'Suspended': 'warning',
			'Provisioning': 'info',
			'Deleted': 'danger'
		};
		return statusMap[status] || 'secondary';
	}

	async update_site_status(new_status) {
		try {
			const response = await frappe.call({
				method: 'erp_saas.erp_saas.api.dashboard_api.update_site_status',
				args: {
					site_name: this.site_name,
					new_status: new_status
				},
				freeze: true,
				freeze_message: `Updating status to ${new_status}...`
			});

			if (response.message && response.message.success) {
				frappe.show_alert({
					message: response.message.message,
					indicator: 'green'
				});
				this.load_site_data(); // Reload data
			} else {
				throw new Error(response.message.error || 'Failed to update status');
			}
		} catch (error) {
			frappe.msgprint({
				title: 'Error',
				message: error.message || 'Failed to update site status',
				indicator: 'red'
			});
		}
	}
}

// Cleanup on page unload
frappe.pages['site-detail-dashboard'].on_page_unload = function(wrapper) {
	var page = wrapper.page;
	if (page.site_detail_dashboard) {
		page.site_detail_dashboard.destroy();
		page.site_detail_dashboard = null;
	}
}

