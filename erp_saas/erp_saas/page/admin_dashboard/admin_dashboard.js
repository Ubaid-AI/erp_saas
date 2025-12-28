frappe.pages['admin-dashboard'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Admin Dashboard',
		single_column: true
	});

	// Add custom styles
	frappe.require('/assets/erp_saas/css/admin_dashboard.css');

	// Ensure Font Awesome is loaded
	if (!$('link[href*="font-awesome"]').length) {
		$('<link>')
			.attr('rel', 'stylesheet')
			.attr('href', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css')
			.attr('crossorigin', 'anonymous')
			.appendTo('head');
	}

	// Initialize dashboard
	new AdminDashboard(page);
}

class AdminDashboard {
	constructor(page) {
		this.page = page;
		this.wrapper = $(this.page.body);
		this.data = null;
		
		this.setup_page();
		this.load_dashboard_data();
		
		// Auto-refresh every 60 seconds
		this.refresh_interval = setInterval(() => {
			this.load_dashboard_data(true);
		}, 60000);
	}

	setup_page() {
		// Add refresh button
		this.page.add_button('Refresh', () => {
			this.load_dashboard_data();
		}, 'primary');

		// Add export button
		this.page.add_button('Export Data', () => {
			this.export_dashboard_data();
		});

		// Create dashboard container
		this.wrapper.html(`
			<div class="admin-dashboard-container">
				<!-- Loading Spinner -->
				<div id="dashboard-loading" class="dashboard-loading">
					<div class="spinner-border text-primary" role="status">
						<span class="sr-only">Loading...</span>
					</div>
					<p class="mt-3">Loading dashboard data...</p>
				</div>

				<!-- Dashboard Content -->
				<div id="dashboard-content" style="display: none;">
					<!-- Header -->
					<div class="dashboard-header mb-4">
						<h3 class="dashboard-title">
							<i class="fas fa-chart-line"></i> RiyalERP SaaS Admin Dashboard
						</h3>
						<p class="text-muted">Real-time overview of your SaaS infrastructure</p>
					</div>

					<!-- Summary Cards -->
					<div class="summary-cards-container mb-4">
						<div class="row">
							<div class="col-md-3 col-sm-6 mb-3">
								<div class="stat-card stat-card-primary">
									<div class="stat-icon">
										<i class="fas fa-server"></i>
									</div>
									<div class="stat-content">
										<div class="stat-label">Total Sites</div>
										<div class="stat-value" id="stat-total-sites">0</div>
										<div class="stat-change" id="stat-total-sites-change"></div>
									</div>
								</div>
							</div>

							<div class="col-md-3 col-sm-6 mb-3">
								<div class="stat-card stat-card-success">
									<div class="stat-icon">
										<i class="fas fa-check-circle"></i>
									</div>
									<div class="stat-content">
										<div class="stat-label">Active Sites</div>
										<div class="stat-value" id="stat-active-sites">0</div>
										<div class="stat-change" id="stat-active-sites-change"></div>
									</div>
								</div>
							</div>

							<div class="col-md-3 col-sm-6 mb-3">
								<div class="stat-card stat-card-warning">
									<div class="stat-icon">
										<i class="fas fa-hourglass-half"></i>
									</div>
									<div class="stat-content">
										<div class="stat-label">Provisioning</div>
										<div class="stat-value" id="stat-provisioning-sites">0</div>
										<div class="stat-change" id="stat-provisioning-sites-change"></div>
									</div>
								</div>
							</div>

							<div class="col-md-3 col-sm-6 mb-3">
								<div class="stat-card stat-card-danger">
									<div class="stat-icon">
										<i class="fas fa-pause-circle"></i>
									</div>
									<div class="stat-content">
										<div class="stat-label">Suspended</div>
										<div class="stat-value" id="stat-suspended-sites">0</div>
										<div class="stat-change" id="stat-suspended-sites-change"></div>
									</div>
								</div>
							</div>
						</div>

						<div class="row">
							<div class="col-md-3 col-sm-6 mb-3">
								<div class="stat-card stat-card-info">
									<div class="stat-icon">
										<i class="fas fa-file-invoice"></i>
									</div>
									<div class="stat-content">
										<div class="stat-label">Subscriptions</div>
										<div class="stat-value" id="stat-subscriptions">0</div>
										<div class="stat-sub-label">
											<span id="stat-active-subscriptions">0</span> active
										</div>
									</div>
								</div>
							</div>

							<div class="col-md-3 col-sm-6 mb-3">
								<div class="stat-card stat-card-revenue">
									<div class="stat-icon">
										<i class="fas fa-coins"></i>
									</div>
									<div class="stat-content">
										<div class="stat-label">Monthly Revenue</div>
										<div class="stat-value" id="stat-revenue">$0</div>
										<div class="stat-sub-label">MRR</div>
									</div>
								</div>
							</div>

							<div class="col-md-3 col-sm-6 mb-3">
								<div class="stat-card stat-card-secondary">
									<div class="stat-icon">
										<i class="fas fa-network-wired"></i>
									</div>
									<div class="stat-content">
										<div class="stat-label">Domains</div>
										<div class="stat-value" id="stat-domains">0</div>
										<div class="stat-sub-label">
											<span id="stat-available-domains">0</span> available
										</div>
									</div>
								</div>
							</div>

							<div class="col-md-3 col-sm-6 mb-3">
								<div class="stat-card stat-card-purple">
									<div class="stat-icon">
										<i class="fas fa-clock"></i>
									</div>
									<div class="stat-content">
										<div class="stat-label">Expiring Soon</div>
										<div class="stat-value" id="stat-expiring">0</div>
										<div class="stat-sub-label">Next 30 days</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Charts Row -->
					<div class="row mb-4">
						<div class="col-md-4 mb-3">
							<div class="dashboard-card">
								<div class="card-header">
									<h5 class="card-title">
										<i class="fas fa-chart-pie"></i> Site Status Distribution
									</h5>
								</div>
								<div class="card-body">
									<canvas id="status-chart"></canvas>
								</div>
							</div>
						</div>

						<div class="col-md-4 mb-3">
							<div class="dashboard-card">
								<div class="card-header">
									<h5 class="card-title">
										<i class="fas fa-chart-bar"></i> Plan Distribution
									</h5>
								</div>
								<div class="card-body">
									<canvas id="plan-chart"></canvas>
								</div>
							</div>
						</div>

						<div class="col-md-4 mb-3">
							<div class="dashboard-card">
								<div class="card-header">
									<h5 class="card-title">
										<i class="fas fa-chart-line"></i> Growth Trend
									</h5>
								</div>
								<div class="card-body">
									<canvas id="growth-chart"></canvas>
								</div>
							</div>
						</div>
					</div>

					<!-- Recent Sites & Expiring Subscriptions -->
					<div class="row">
						<div class="col-md-8 mb-3">
							<div class="dashboard-card">
								<div class="card-header">
									<h5 class="card-title">
										<i class="fas fa-list"></i> Recent Customer Sites
									</h5>
								</div>
								<div class="card-body">
									<div class="table-responsive">
										<table class="table table-hover" id="recent-sites-table">
											<thead>
												<tr>
													<th>Site Name</th>
													<th>Customer</th>
													<th>Plan</th>
													<th>Status</th>
													<th>Created</th>
													<th>Actions</th>
												</tr>
											</thead>
											<tbody id="recent-sites-body">
												<!-- Populated by JS -->
											</tbody>
										</table>
									</div>
								</div>
							</div>
						</div>

						<div class="col-md-4 mb-3">
							<div class="dashboard-card">
								<div class="card-header">
									<h5 class="card-title">
										<i class="fas fa-clock"></i> Expiring Subscriptions
									</h5>
								</div>
								<div class="card-body">
									<div id="expiring-list">
										<!-- Populated by JS -->
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		`);
	}

	async load_dashboard_data(silent = false) {
		if (!silent) {
			$('#dashboard-loading').show();
			$('#dashboard-content').hide();
		}

		try {
			const response = await frappe.call({
				method: 'erp_saas.erp_saas.api.dashboard_api.get_dashboard_stats',
				freeze: !silent,
				freeze_message: 'Loading dashboard data...'
			});

			if (response.message) {
				this.data = response.message;
				this.render_dashboard();
				
				if (!silent) {
					$('#dashboard-loading').hide();
					$('#dashboard-content').fadeIn();
				}
			}
		} catch (error) {
			console.error('Error loading dashboard data:', error);
			frappe.msgprint({
				title: 'Error',
				message: 'Failed to load dashboard data. Please refresh the page.',
				indicator: 'red'
			});
		}
	}

	render_dashboard() {
		if (!this.data) return;

		// Update summary cards
		this.update_summary_cards();

		// Render charts
		this.render_status_chart();
		this.render_plan_chart();
		this.render_growth_chart();

		// Render tables
		this.render_recent_sites();
		this.render_expiring_list();
	}

	update_summary_cards() {
		const summary = this.data.summary;

		$('#stat-total-sites').text(summary.total_sites || 0);
		$('#stat-active-sites').text(summary.active_sites || 0);
		$('#stat-provisioning-sites').text(summary.provisioning_sites || 0);
		$('#stat-suspended-sites').text(summary.suspended_sites || 0);
		$('#stat-subscriptions').text(summary.total_subscriptions || 0);
		$('#stat-active-subscriptions').text(summary.active_subscriptions || 0);
		$('#stat-revenue').html(`<span class="sar-symbol">§</span> ${(summary.mrr || 0).toLocaleString()}`);
		$('#stat-domains').text(summary.total_domains || 0);
		$('#stat-available-domains').text(summary.available_domains || 0);
		$('#stat-expiring').text((this.data.expiring_soon || []).length);
	}

	render_status_chart() {
		const ctx = document.getElementById('status-chart');
		if (!ctx) return;

		const distribution = this.data.charts.status_distribution || {};
		
		// Destroy existing chart if it exists
		if (this.statusChart) {
			this.statusChart.destroy();
		}

		this.statusChart = new Chart(ctx, {
			type: 'doughnut',
			data: {
				labels: Object.keys(distribution),
				datasets: [{
					data: Object.values(distribution),
					backgroundColor: [
						'#28a745', // Active - Green
						'#ffc107', // Suspended - Yellow
						'#17a2b8', // Provisioning - Cyan
						'#dc3545'  // Deleted - Red
					],
					borderWidth: 2,
					borderColor: '#ffffff'
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				plugins: {
					legend: {
						position: 'bottom',
						labels: {
							padding: 15,
							font: {
								size: 12
							}
						}
					},
					tooltip: {
						callbacks: {
							label: function(context) {
								const label = context.label || '';
								const value = context.parsed || 0;
								const total = context.dataset.data.reduce((a, b) => a + b, 0);
								const percentage = ((value / total) * 100).toFixed(1);
								return `${label}: ${value} (${percentage}%)`;
							}
						}
					}
				}
			}
		});
	}

	render_plan_chart() {
		const ctx = document.getElementById('plan-chart');
		if (!ctx) return;

		const distribution = this.data.charts.plan_distribution || {};
		
		// Destroy existing chart if it exists
		if (this.planChart) {
			this.planChart.destroy();
		}

		// Generate random colors for plans
		const colors = this.generate_colors(Object.keys(distribution).length);

		this.planChart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: Object.keys(distribution),
				datasets: [{
					label: 'Sites',
					data: Object.values(distribution),
					backgroundColor: colors,
					borderWidth: 0
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						callbacks: {
							label: function(context) {
								return `Sites: ${context.parsed.y}`;
							}
						}
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							stepSize: 1
						}
					}
				}
			}
		});
	}

	render_growth_chart() {
		const ctx = document.getElementById('growth-chart');
		if (!ctx) return;

		const growth = this.data.charts.growth_trend || { labels: [], data: [] };
		
		// Destroy existing chart if it exists
		if (this.growthChart) {
			this.growthChart.destroy();
		}

		this.growthChart = new Chart(ctx, {
			type: 'line',
			data: {
				labels: growth.labels,
				datasets: [{
					label: 'New Sites',
					data: growth.data,
					borderColor: '#1F1F1F',
					backgroundColor: 'rgba(31, 31, 31, 0.1)',
					borderWidth: 3,
					fill: true,
					tension: 0.4
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				plugins: {
					legend: {
						display: false
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							stepSize: 1
						}
					}
				}
			}
		});
	}

	render_recent_sites() {
		const tbody = $('#recent-sites-body');
		tbody.empty();

		const sites = this.data.recent_sites || [];

		if (sites.length === 0) {
			tbody.append(`
				<tr>
					<td colspan="6" class="text-center text-muted py-4">
						<i class="fas fa-inbox fa-2x mb-2"></i>
						<p>No customer sites found</p>
					</td>
				</tr>
			`);
			return;
		}

		sites.forEach(site => {
			const statusClass = this.get_status_class(site.status);
			const statusIcon = this.get_status_icon(site.status);
			
			const row = $(`
				<tr>
					<td>
						<strong>${site.site_name || 'N/A'}</strong>
						<br>
						<small class="text-muted">${site.domain || 'No domain'}</small>
					</td>
					<td>
						<div>${site.customer_name || 'N/A'}</div>
						<small class="text-muted">${site.customer_email || ''}</small>
					</td>
					<td>
						<span class="badge badge-info">${site.plan || 'No Plan'}</span>
					</td>
					<td>
						<span class="badge badge-${statusClass}">
							<i class="${statusIcon}"></i> ${site.status || 'Unknown'}
						</span>
					</td>
					<td>
						<small>${frappe.datetime.prettyDate(site.creation)}</small>
					</td>
					<td>
						<button class="btn btn-xs btn-default view-site-btn" data-site="${site.name}">
							<i class="fas fa-eye"></i> View
						</button>
					</td>
				</tr>
			`);

			// Add click handler for view button
			row.find('.view-site-btn').on('click', (e) => {
				const siteName = $(e.currentTarget).data('site');
				frappe.set_route('site-detail-dashboard', siteName);
			});

			tbody.append(row);
		});
	}

	render_expiring_list() {
		const container = $('#expiring-list');
		container.empty();

		const expiring = this.data.expiring_soon || [];

		if (expiring.length === 0) {
			container.append(`
				<div class="text-center text-muted py-4">
					<i class="fas fa-check-circle fa-2x mb-2"></i>
					<p>No subscriptions expiring soon</p>
				</div>
			`);
			return;
		}

		expiring.forEach(item => {
			const daysClass = item.days_left <= 7 ? 'danger' : 'warning';
			
			container.append(`
				<div class="expiring-item mb-3">
					<div class="d-flex justify-content-between align-items-center">
						<div class="flex-grow-1">
							<strong>${item.site_name}</strong>
							<br>
							<small class="text-muted">Expires: ${frappe.datetime.str_to_user(item.end_date)}</small>
						</div>
						<div>
							<span class="badge badge-${daysClass}">
								${item.days_left} days
							</span>
						</div>
					</div>
				</div>
			`);
		});
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

	get_status_icon(status) {
		const iconMap = {
			'Active': 'fas fa-check-circle',
			'Suspended': 'fas fa-pause-circle',
			'Provisioning': 'fas fa-spinner fa-spin',
			'Deleted': 'fas fa-times-circle'
		};
		return iconMap[status] || 'fas fa-circle';
	}

	generate_colors(count) {
		const colors = [
			'#1F1F1F', '#2f2f2f', '#007bff', '#28a745', '#ffc107',
			'#dc3545', '#17a2b8', '#6c757d', '#e83e8c', '#fd7e14'
		];
		
		const result = [];
		for (let i = 0; i < count; i++) {
			result.push(colors[i % colors.length]);
		}
		return result;
	}

	export_dashboard_data() {
		if (!this.data) {
			frappe.msgprint('No data available to export');
			return;
		}

		// Create CSV content
		let csv = 'Site Name,Customer,Plan,Status,Created,End Date\n';
		
		(this.data.recent_sites || []).forEach(site => {
			csv += `"${site.site_name}","${site.customer_name}","${site.plan}","${site.status}","${site.creation}","${site.end_date || 'N/A'}"\n`;
		});

		// Download CSV
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `dashboard-export-${frappe.datetime.now_datetime().replace(/[: ]/g, '-')}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);

		frappe.show_alert({
			message: 'Dashboard data exported successfully',
			indicator: 'green'
		});
	}

	destroy() {
		// Clean up charts and intervals
		if (this.statusChart) this.statusChart.destroy();
		if (this.planChart) this.planChart.destroy();
		if (this.growthChart) this.growthChart.destroy();
		if (this.refresh_interval) clearInterval(this.refresh_interval);
	}
}

// Cleanup on page unload
frappe.pages['admin-dashboard'].on_page_unload = function() {
	if (frappe.pages['admin-dashboard'].dashboard) {
		frappe.pages['admin-dashboard'].dashboard.destroy();
	}
}
