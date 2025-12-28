# 📊 RiyalERP SaaS Admin Dashboard

## Overview
A modern, comprehensive admin dashboard for managing your RiyalERP SaaS infrastructure. Monitor customer sites, subscriptions, domains, and revenue in real-time with beautiful visualizations and analytics.

---

## 🎯 Features

### 📈 Real-Time Statistics
- **Total Sites**: View all customer sites at a glance
- **Active Sites**: Monitor currently running sites
- **Provisioning Sites**: Track sites being set up
- **Suspended Sites**: Identify suspended accounts
- **Subscriptions**: Track total and active subscriptions
- **Monthly Recurring Revenue (MRR)**: Monitor your revenue stream
- **Domain Management**: Track total, in-use, and available domains
- **Expiring Subscriptions**: Alert for subscriptions ending in 30 days

### 📊 Visual Analytics
1. **Site Status Distribution (Pie Chart)**
   - Active sites percentage
   - Suspended sites
   - Provisioning sites
   - Deleted sites

2. **Plan Distribution (Bar Chart)**
   - Sites per subscription plan
   - Popular plan identification
   - Resource allocation insights

3. **Growth Trend (Line Chart)**
   - 12-month site creation history
   - Growth pattern analysis
   - Month-over-month trends

### 📋 Data Tables
- **Recent Customer Sites Table**
  - Site name and domain
  - Customer name and email
  - Subscription plan
  - Current status
  - Creation date
  - Quick view actions

- **Expiring Subscriptions List**
  - Sites expiring in next 30 days
  - Days remaining counter
  - Priority alerts (7 days = red, 30 days = yellow)

---

## 🚀 Accessing the Dashboard

### Method 1: Direct URL
```
https://your-site.com/app/admin-dashboard
```

### Method 2: Desk Navigation
1. Login as **System Manager**
2. Click on **Awesomebar** (search bar)
3. Type: `Admin Dashboard`
4. Select the page

### Method 3: Workspace (Recommended)
1. Go to **SaaS Workspace**
2. Click **Admin Dashboard** shortcut

---

## 🔐 Permissions
Only users with **System Manager** role can access the dashboard.

---

## 🎨 Dashboard Components

### Summary Cards (Top Section)
8 beautifully designed cards with:
- **Color-coded indicators**
  - Blue: Total Sites
  - Green: Active Sites & Revenue
  - Yellow: Provisioning
  - Red: Suspended
  - Cyan: Subscriptions
  - Gray: Domains
  - Purple: Expiring Soon

- **Icons**: Font Awesome icons for visual clarity
- **Hover effects**: Cards lift on hover for interactivity
- **Gradient backgrounds**: Modern professional look

### Charts Section (Middle Section)
Three responsive charts:
- **Doughnut Chart**: Site status distribution
- **Bar Chart**: Plan distribution
- **Line Chart**: 12-month growth trend

All charts use Chart.js 4.4.0 for smooth animations and responsive design.

### Data Section (Bottom Section)
- **Recent Sites Table**: Last 10 sites created
  - Sortable columns
  - Click "View" to open site details
  - Responsive design
  - Sticky headers for scrolling

- **Expiring Panel**: Visual alerts for renewals
  - Color-coded urgency
  - Days remaining counter
  - One-click site access

---

## 🔄 Auto-Refresh
The dashboard automatically refreshes every **60 seconds** to show real-time data.

---

## 🛠️ Dashboard Actions

### Refresh Button
Click the **Refresh** button in the page header to manually reload data.

### Export Data
Click **Export Data** button to download:
- CSV file with all site information
- Includes: Site name, customer, plan, status, dates
- Filename format: `dashboard-export-YYYY-MM-DD-HH-MM-SS.csv`

### View Site Details
Click **View** button on any site in the table to:
- Open the Customer Site form
- Edit site configuration
- View full subscription details
- Manage site status

---

## 📱 Mobile Responsive
The dashboard is fully responsive and works on:
- ✅ Desktop (1920px+)
- ✅ Laptop (1366px - 1920px)
- ✅ Tablet (768px - 1365px)
- ✅ Mobile (320px - 767px)

### Mobile Optimizations
- Stacked cards for easy viewing
- Scrollable tables with sticky headers
- Touch-friendly buttons
- Compressed chart sizes
- Optimized font sizes

---

## 🎯 Use Cases

### Daily Operations
1. **Morning Check**: Review overnight site creations
2. **Status Monitoring**: Identify suspended or failing sites
3. **Revenue Tracking**: Monitor MRR growth
4. **Capacity Planning**: Check domain availability

### Weekly Reviews
1. **Growth Analysis**: Review the 12-month trend chart
2. **Plan Distribution**: Optimize resource allocation
3. **Renewal Planning**: Contact customers with expiring subscriptions
4. **Support Planning**: Identify high-traffic periods

### Monthly Reporting
1. **Export Data**: Generate CSV reports
2. **Revenue Reports**: Track MRR month-over-month
3. **Churn Analysis**: Monitor suspended vs. active sites
4. **Capacity Forecasting**: Plan for domain pool expansion

---

## 🔧 Technical Details

### Backend API
**File**: `/apps/erp_saas/erp_saas/erp_saas/api/dashboard_api.py`

**Key Methods**:
- `get_dashboard_stats()`: Fetches all dashboard data
- `get_site_details(site_name)`: Retrieves specific site info
- `update_site_status(site_name, status)`: Updates site status
- `get_growth_trend(months)`: Calculates growth data

### Frontend
**File**: `/apps/erp_saas/erp_saas/erp_saas/page/admin_dashboard/admin_dashboard.js`

**Key Features**:
- ES6 Class-based architecture
- Async/await for API calls
- Chart.js integration
- Auto-refresh with intervals
- Event-driven updates

### Styling
**File**: `/apps/erp_saas/erp_saas/public/css/admin_dashboard.css`

**Design Features**:
- CSS Grid & Flexbox layouts
- Gradient backgrounds
- Smooth transitions
- Professional color palette
- Dark/light theme compatible

---

## 📊 Data Sources

The dashboard pulls data from:
1. **Customer Site DocType**
   - Total sites, status distribution
   - Site details, creation dates

2. **Subscription DocType**
   - Active subscriptions
   - Revenue calculations
   - Expiry tracking

3. **Saas Domain DocType**
   - Total domains
   - Available domains
   - Domain allocation status

4. **Subscription Plan DocType**
   - Plan details
   - Pricing information
   - Resource limits

---

## 🚨 Troubleshooting

### Dashboard Not Loading
1. **Clear browser cache**: `Ctrl + Shift + R` (or `Cmd + Shift + R`)
2. **Clear Frappe cache**: 
   ```bash
   bench --site site1.local clear-cache
   ```
3. **Rebuild assets**:
   ```bash
   bench build --app erp_saas
   ```

### Charts Not Displaying
1. **Check Chart.js**: Ensure CDN is accessible
2. **Browser Console**: Check for JavaScript errors (F12)
3. **Network Tab**: Verify Chart.js loaded successfully

### No Data Showing
1. **Check Permissions**: Ensure you have System Manager role
2. **Verify Data**: Check if Customer Sites exist in the system
3. **API Errors**: Check Error Log DocType for API issues

### Slow Performance
1. **Disable Auto-Refresh**: Modify `refresh_interval` in JS
2. **Reduce Data**: Modify API to limit records returned
3. **Optimize Queries**: Add database indexes

---

## 🎨 Customization

### Change Auto-Refresh Interval
Edit `admin_dashboard.js`:
```javascript
// Change from 60 seconds to 120 seconds
this.refresh_interval = setInterval(() => {
    this.load_dashboard_data(true);
}, 120000); // 120000 ms = 2 minutes
```

### Modify Color Scheme
Edit `admin_dashboard.css`:
```css
/* Change primary gradient */
.dashboard-header {
    background: linear-gradient(135deg, #YOUR_COLOR_1, #YOUR_COLOR_2);
}
```

### Add New Summary Cards
1. Edit `admin_dashboard.js` - Add HTML in `setup_page()`
2. Add calculation in `dashboard_api.py` - Update `get_dashboard_stats()`
3. Update render method - Add to `update_summary_cards()`

### Custom Charts
Add new charts by:
1. Adding canvas element in `setup_page()`
2. Creating render method (e.g., `render_custom_chart()`)
3. Calling it in `render_dashboard()`

---

## 📝 Future Enhancements

### Planned Features
- [ ] Real-time notifications for new sites
- [ ] Advanced filtering and search
- [ ] Site health monitoring
- [ ] Resource usage graphs (CPU, RAM, Disk)
- [ ] Customer engagement metrics
- [ ] Revenue forecasting
- [ ] Email report scheduling
- [ ] Multi-tenancy comparison
- [ ] API usage tracking
- [ ] Performance benchmarks

---

## 🤝 Support

For issues or feature requests:
1. Check Error Log in Frappe
2. Review browser console (F12)
3. Contact your system administrator
4. Email: info@havenir.com

---

## 📚 Related Documentation
- [Customer Site DocType](./erp_saas/doctype/customer_site)
- [Subscription DocType](../erpnext/accounts/doctype/subscription)
- [Provisioning API](./erp_saas/api/provisioning.py)
- [Self-Service API](./erp_saas/api/self_service.py)

---

## ✅ Installation Checklist

- [x] Dashboard page created
- [x] Backend API implemented
- [x] Frontend JavaScript completed
- [x] CSS styling applied
- [x] Chart.js integrated
- [x] Permissions configured
- [x] Auto-refresh enabled
- [x] Export functionality added
- [x] Mobile responsive design
- [x] Error handling implemented

---

**Version**: 1.0.0  
**Last Updated**: December 28, 2025  
**Developer**: Havenir Solutions Private Limited  
**License**: MIT

