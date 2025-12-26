# Quick Testing Guide for Customer Signup

## 🚀 Quick Start Testing

### 1. Access the Page
```
http://your-site.com/customer-signup
```

### 2. Quick Test Flow (Happy Path)

#### Step 1: Choose Plan
1. Wait for plans to load
2. Select "Monthly" from dropdown (default)
3. Verify price shows correctly
4. Click "Choose Plan"
5. ✅ Should move to Step 2

#### Step 2: Fill Information
1. Fill in:
   - First Name: `Test`
   - Last Name: `User`
   - Email: `your-email@example.com`
   - Confirm Email: `your-email@example.com` (must match)
   - Phone: `+1-555-0100` (optional)
   - Street: `123 Test Street`
   - City: `Test City`
   - State: `TS`
   - Postal: `12345`
   - Country: `United States`

2. Click "Send Verification Code"
3. Check your email for 6-digit code
4. Enter the code
5. Click "Verify"
6. ✅ Should show "✓ Verified"
7. Click "Continue to Review"
8. ✅ Should move to Step 3

#### Step 3: Review & Confirm
1. Verify all information is correct
2. Check the Terms & Conditions box
3. Click "Create My Account"
4. Watch progress bar
5. ✅ Should show success message
6. ✅ Check email for credentials

---

## 🧪 Detailed Test Cases

### Test Case 1: Email Validation
**Purpose:** Ensure invalid emails are rejected

**Steps:**
1. Go to Step 2
2. Enter email: `invalid-email`
3. Tab out of field
4. ✅ Should show error: "Please enter a valid email address"

**Expected:** Red border, error message below field

### Test Case 2: Email Confirmation Mismatch
**Purpose:** Prevent typos in email

**Steps:**
1. Email: `test@example.com`
2. Confirm Email: `test@exampl.com` (typo)
3. Try to proceed
4. ✅ Should show error: "Email addresses do not match"

### Test Case 3: OTP Verification - Invalid Code
**Purpose:** Ensure OTP security

**Steps:**
1. Send OTP to valid email
2. Enter wrong code: `111111`
3. Click Verify
4. ✅ Should show: "Invalid OTP. 2 attempts remaining"

### Test Case 4: OTP Verification - Expired
**Purpose:** Test expiry logic

**Steps:**
1. Send OTP
2. Wait 11 minutes
3. Try to verify
4. ✅ Should show: "OTP has expired"

### Test Case 5: Mobile Responsiveness
**Purpose:** Ensure mobile works

**Steps:**
1. Open on mobile or resize browser to 375px width
2. Check plan cards stack vertically
3. Check buttons are tappable
4. Check no horizontal scroll
5. ✅ Everything should be readable and usable

### Test Case 6: Back Navigation
**Purpose:** Ensure data persists when going back

**Steps:**
1. Fill Step 2 form completely
2. Click "Continue to Review"
3. In Step 3, click "Edit"
4. ✅ Should return to Step 2 with data still filled

### Test Case 7: Error Handling - Network Failure
**Purpose:** Graceful error handling

**Steps:**
1. Open DevTools
2. Go to Network tab
3. Set throttling to "Offline"
4. Try to send OTP
5. ✅ Should show user-friendly error message

### Test Case 8: Required Fields
**Purpose:** Ensure all required fields are enforced

**Steps:**
1. Go to Step 2
2. Leave all fields empty
3. Try to proceed
4. ✅ Should highlight all required fields in red

### Test Case 9: Phone Optional
**Purpose:** Ensure phone is truly optional

**Steps:**
1. Fill all fields EXCEPT phone
2. Verify email with OTP
3. Proceed to Step 3
4. ✅ Should work without phone

### Test Case 10: Plan Term Changes
**Purpose:** Ensure pricing updates correctly

**Steps:**
1. Select a plan
2. Change term to "Trial"
3. ✅ Should show "X days Free Trial!" with no price
4. Change to "Monthly"
5. ✅ Should show monthly price
6. Change to "Biannually"
7. ✅ Should show "SAVE X%" badge

---

## 🐛 Known Issues to Check

### Issue: OTP Email Delay
**Symptom:** OTP takes too long to arrive  
**Check:** Email queue, SMTP settings  
**Workaround:** OTP is logged in console (remove in production)

### Issue: Provisioning Timeout
**Symptom:** Provisioning seems stuck  
**Check:** Bench logs, domain availability  
**Fix:** Ensure domains are available in Saas Domain doctype

### Issue: Mobile Layout Breaks
**Symptom:** Horizontal scrolling on mobile  
**Check:** Custom CSS overrides, viewport meta tag  
**Fix:** Clear cache, check Bootstrap is loaded

---

## 📊 Testing Checklist

### Functional Testing
- [ ] Plan selection works
- [ ] Term selector updates pricing
- [ ] Form validation catches errors
- [ ] Email format validated
- [ ] Email confirmation works
- [ ] OTP sends successfully
- [ ] OTP verification works
- [ ] Invalid OTP rejected
- [ ] Phone field is optional
- [ ] Country dropdown loads
- [ ] Review page shows correct data
- [ ] Back buttons work
- [ ] Edit buttons work
- [ ] Final submission works
- [ ] Success message displays
- [ ] Email with credentials sent

### UI/UX Testing
- [ ] Plan cards look good
- [ ] "Most Popular" badge shows
- [ ] Features list readable
- [ ] Form sections organized
- [ ] Error messages clear
- [ ] Loading states show
- [ ] Progress bar works
- [ ] Buttons disable during processing
- [ ] Animations smooth
- [ ] Colors consistent
- [ ] Fonts readable

### Mobile Testing
- [ ] Works on iPhone
- [ ] Works on Android
- [ ] Touch targets large enough
- [ ] No horizontal scrolling
- [ ] Text readable without zoom
- [ ] Buttons easy to tap
- [ ] Form fields easy to fill
- [ ] Keyboard doesn't hide fields

### Browser Testing
- [ ] Chrome desktop
- [ ] Firefox desktop
- [ ] Safari desktop
- [ ] Edge desktop
- [ ] Chrome mobile
- [ ] Safari mobile

### Security Testing
- [ ] SQL injection prevented
- [ ] XSS attacks blocked
- [ ] CSRF token present
- [ ] OTP expires after 10min
- [ ] OTP limited to 3 attempts
- [ ] Email verified before signup
- [ ] No sensitive data in console

### Performance Testing
- [ ] Page loads in < 3 seconds
- [ ] Plans load in < 2 seconds
- [ ] No console errors
- [ ] No memory leaks
- [ ] Images optimized
- [ ] CSS/JS minified (production)

---

## 🔍 Debugging Tips

### JavaScript Not Working
1. Open DevTools Console (F12)
2. Look for red errors
3. Check if `frappe.ready()` fired
4. Verify file paths are correct
5. Check browser compatibility

### CSS Not Applied
1. Hard refresh (Ctrl+Shift+R)
2. Clear browser cache
3. Check `build.json` has CSS file
4. Run `bench build --app erp_saas`
5. Check file path in HTML

### OTP Not Sending
1. Check Frappe Error Log
2. Test SMTP settings
3. Check email queue
4. Verify email address format
5. Check spam folder

### Provisioning Fails
1. Check bench logs: `bench console`
2. Verify available domains
3. Check database credentials
4. Ensure apps are installed
5. Check disk space

---

## 📝 Test Data

### Valid Test Emails
```
test1@example.com
test2@example.com
test3@example.com
```

### Valid Test Phones
```
+1-555-0100
+1-555-0101
+44-20-7123-4567
```

### Valid Test Addresses
```
123 Main Street, New York, NY, 10001, United States
456 Oak Avenue, Los Angeles, CA, 90001, United States
789 Pine Road, Chicago, IL, 60601, United States
```

---

## ✅ Sign-off Checklist

Before marking as "Production Ready":

### Developer Checklist
- [ ] All tests pass
- [ ] No console errors
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Performance acceptable
- [ ] Security checked
- [ ] Mobile tested
- [ ] Browsers tested

### QA Checklist
- [ ] All test cases executed
- [ ] Edge cases tested
- [ ] Error handling verified
- [ ] UX reviewed
- [ ] Accessibility checked
- [ ] Cross-browser tested
- [ ] Mobile devices tested
- [ ] Performance measured

### Business Checklist
- [ ] Requirements met
- [ ] User feedback positive
- [ ] Conversion rate improved
- [ ] Support tickets reduced
- [ ] Analytics configured
- [ ] A/B test ready
- [ ] Marketing approved
- [ ] Legal approved (T&C, Privacy)

---

## 📞 Report Issues

If you find bugs:
1. Check browser console
2. Check Frappe Error Log
3. Document steps to reproduce
4. Include screenshots
5. Note browser/device info
6. Report to development team

---

## 🎯 Success Criteria

The signup page is considered successful when:
- ✅ 80%+ signup completion rate
- ✅ 95%+ email verification rate
- ✅ 99%+ provisioning success rate
- ✅ < 5 minutes average completion time
- ✅ Zero critical security vulnerabilities
- ✅ No major UX complaints
- ✅ Positive user feedback

---

**Happy Testing! 🚀**

