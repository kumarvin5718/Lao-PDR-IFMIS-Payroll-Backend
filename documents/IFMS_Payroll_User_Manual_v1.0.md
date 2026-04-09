# IFMS Payroll Module — User Manual
### Lao PDR Government | Integrated Financial Management System
**Version:** 1.0 | **Date:** March 2026 | **Classification:** Official Use Only

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started — All Users](#2-getting-started--all-users)
3. [Employee Role Guide](#3-employee-role-guide)
4. [Manager Role Guide](#4-manager-role-guide)
5. [Administrator Role Guide](#5-administrator-role-guide)
6. [Frequently Asked Questions](#6-frequently-asked-questions)
7. [Glossary](#7-glossary)

---

## 1. Introduction

### 1.1 About This System

The **IFMS Payroll Module** is the Government of Lao PDR's official web-based payroll management system. It replaces the previous Excel-based payroll toolkit and provides a centralised, secure, and role-controlled platform for managing civil servant payroll across 18 ministries and provincial administrations.

The system implements the following official regulations:

- **MoF Circular No. 4904/MOF (December 2025)** — civil servant salary structure
- **SSO/MLSW Decree** — Social Security Organisation contributions (5.5% employee, 6% employer)
- **GDT/MoF PIT Circular** — Progressive Personal Income Tax, 6 brackets, 0%–24%
- **MoHA Gazette / Decree 292/GoL 2021** — Remote and hazardous province classifications

All monetary values in the system are in **Lao Kip (LAK)**.

### 1.2 What the System Does

- Stores and manages employee master records for civil servants
- Calculates monthly payroll including basic salary, allowances, SSO contributions, and PIT
- Supports three methods of employee data entry: web form, Excel bulk upload, and online grid entry
- Provides role-based dashboards showing employee headcount and data completeness
- Generates payroll reports and employee lists in Excel and PDF formats
- Enforces data ownership rules to ensure accurate and accountable record management
- Maintains a full audit trail of all changes

### 1.3 User Roles Overview

| Role | Who Uses It | Summary of Access |
|---|---|---|
| **Employee** | Civil servants | Register and manage own profile only |
| **Manager** | Department or location managers | Manage employees in assigned location and department |
| **Department Officer** | Senior officers overseeing departments | Assign managers to locations and departments |
| **Administrator** | System administrators (MoF/MoHA IT) | Full system access including payroll, users, and audit |

This manual covers three roles: **Employee**, **Manager**, and **Administrator**.

### 1.4 System Access Requirements

- **Browser:** Google Chrome (recommended), Microsoft Edge, or Mozilla Firefox — latest versions only
- **URL:** Provided by your system administrator
- **Screen resolution:** Minimum 1280 × 768 pixels recommended

---

## 2. Getting Started — All Users

### 2.1 Logging In

1. Open your web browser and navigate to the system URL.
2. On the Login page, enter your **Username** and **Password**.
3. Click the **Login** button.
4. If your credentials are correct, you will be taken to the Dashboard.

**Important notes:**
- Passwords are case-sensitive.
- After **5 consecutive failed login attempts**, your account will be locked for **15 minutes**. Contact your administrator to unlock it sooner.

### 2.2 First-Time Login — Changing Your Password

The system will redirect you to the Change Password screen immediately after your first login. You cannot access any other screen until you set a new password.

1. Enter your current temporary password in the **Current Password** field.
2. Enter your new password in the **New Password** field.
3. Re-enter your new password in the **Confirm Password** field.
4. Click **Save New Password**.

**Password requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one number
- Cannot be the same as your temporary password

### 2.3 Screen Layout

The screen is divided into three areas:

- **Top bar** — System name, your name, language toggle (EN / ລາວ), and Logout button
- **Left sidebar** — Main navigation menu (items vary by role)
- **Main content area** — Pages, forms, tables, and charts

### 2.4 Switching Language

Click **EN** in the top-right corner to display the system in English, or **ລາວ** to display in Lao script.

### 2.5 Logging Out

Click **Logout** in the top-right corner. Your session expires automatically after 8 hours of inactivity.

---

## 3. Employee Role Guide

As an Employee, you can register yourself, view your own profile, and update your personal information. You cannot view other employees' records or access payroll functions.

### 3.1 What You Can Do

| Action | Available |
|---|---|
| Register yourself in the system | Yes |
| View your own employee record | Yes |
| Edit your own employee record | Yes |
| Enter your data via online grid | Yes |
| View other employees' records | No |
| Access payroll calculations | No |
| Export employee data | No |
| Access master data, users, or audit trail | No |

### 3.2 Self-Registration

If you do not yet have an account, you can register yourself. No login is required to register.

1. Go to the system login page.
2. Click **"New employee? Register here"** below the login form.
3. Fill in the registration form:

| Field | What to Enter | Format / Example |
|---|---|---|
| SSO Number | Your Social Security number | SSO followed by 7 digits — e.g. SSO1234567 |
| Full Name | Your full legal name | Somchai Vongkhamphanh |
| Email Address | Your official government email | somchai.vong@gov.la |
| Phone Number | Your mobile number (optional) | Digits only — e.g. 2012345678 |
| Location / Province | Your service location | Select from dropdown |
| Department | Your department | Select from dropdown |

4. Click **Submit Registration**.
5. You will see the confirmation: *"Your registration has been submitted. Your manager will review and activate your account."*

**What happens next:**
- Your registration is sent to the Manager responsible for your selected location and department.
- The Manager will approve or reject your registration.
- Once approved, your Manager shares a temporary password with you.
- Log in with your SSO number as username and the temporary password.
- You will be prompted to change your password immediately.

> **Your account is not active until your Manager or Administrator approves it. You cannot log in until approval is complete.**

### 3.3 Viewing Your Profile

1. Click **My Profile** in the left sidebar.
2. Your employee record opens and displays your information across several tabs:

| Tab | Contents |
|---|---|
| Personal | Name, date of birth, gender, email, mobile |
| Employment | Position, grade, step, employment type, education, prior experience |
| Identity | Civil Service Card ID, SSO number |
| Organisation | Ministry, department, division, service province, district |
| Address | Residential address, province, PIN code, country |
| Bank | Bank name, branch, account number |
| Payroll Flags | Spouse status, children, allowance type, NA member status |

### 3.4 Editing Your Profile

1. Click **My Profile** in the left sidebar.
2. Navigate to the tab with the information you want to change.
3. Update the fields. Key rules:
   - Dropdown fields (Ministry, Department, Province, Bank Name, Bank Branch) must be selected from the available list.
   - Date fields must be in **YYYY-MM-DD** format (example: 1985-03-15).
   - Email must end in **@gov.la**.
   - Mobile number must contain digits only — no spaces or special characters.
4. Click **Save Changes**.
5. A success message confirms the update.

> You can only edit your own record. The Edit button on other employees' records will be greyed out.

### 3.5 Online Grid Entry

Online Grid Entry lets you enter your data in a spreadsheet-like interface directly in the browser.

1. Click **Employees** → **Online Grid Entry** in the sidebar.
2. The grid appears with blank rows.
3. Click any cell and enter your information, or select from the dropdown.
4. Use **Tab** to move to the next cell, or click any cell directly.
5. For dropdown columns (Ministry, Province, Bank Name, Bank Branch), click the cell and choose from the list.
6. For date columns, type in **YYYY-MM-DD** format.
7. The **Status** column on the far right shows:
   - Grey circle ○ — row is empty
   - Green checkmark ✓ — row is valid and ready to submit
   - Red cross ✗ — row has errors that must be fixed
8. Click **Add Row** to add more blank rows.
9. Click **Submit Valid Rows** when done.
10. A summary shows how many records were saved and lists any rows skipped due to errors.

**Tips:**
- Title, First Name, and Last Name columns are fixed on the left — they stay visible as you scroll right.
- Duplicate email, SSO number, Civil Service Card ID, or bank account number are detected immediately when you leave the cell.
- Fix errors directly in the grid and resubmit — your other data is not lost.

### 3.6 Dashboard

The Dashboard is your home screen after login. As an Employee it shows:

- **Total Employees** — shows 1 (your own record)
- **Grade Distribution** — bar chart showing your grade level
- **Employment Type Mix** — pie chart showing your employment type

---

## 4. Manager Role Guide

As a Manager, you can view and manage all employees within your assigned location and department. Your scope is assigned by your Department Officer or Administrator.

### 4.1 What You Can Do

| Action | Available |
|---|---|
| View employees in assigned scope | Yes |
| Add new employees | Yes |
| Edit employee records (ownership rules apply) | Yes |
| Approve or reject employee registrations | Yes |
| Export employee list to Excel or PDF | Yes |
| Bulk upload employees via Excel | Yes |
| Enter employees via online grid | Yes |
| View and use the Dashboard | Yes |
| Access payroll calculations | No |
| Access user management | No |
| Access audit trail | No |

### 4.2 Understanding Your Scope

Your scope defines which employees you can see and manage. It is based on one or more **Location (Province) + Department** combinations assigned to you by your Department Officer or Administrator.

Any employee whose **service province** AND **department** match your assigned scope is automatically visible to you — no additional manual assignment is needed.

**Example:** If your scope is *Vientiane Capital + Department of Budget*, you will see all active employees who are posted in Vientiane Capital AND assigned to the Department of Budget.

You may have multiple scopes. Each combination appears as a separate row in the Manager Master screen.

**To check your current scope:**
1. Click **Master Data** → **Manager Master**.
2. Find your name in the table. Each row shows one location + department combination with the number of employees currently tagged to it.

### 4.3 Viewing the Employee List

1. Click **Employees** → **Employee List**.
2. The list shows only employees within your assigned scope.
3. Columns: Employee Code, Full Name, Ministry, Department, Grade, Employment Type, Province, Status.
4. Use the **Search** bar to find by name, code, or email.
5. Use **Filters** to narrow by grade, employment type, or province.

### 4.4 Adding a New Employee

You can add employees through three methods. All three save to the same database with the same validation rules.

---

#### Method 1 — Web Form (one employee at a time)

**Steps:**

1. Click **Employees** → **Add Employee**.
2. Fill in the required fields across all 7 tabs. Key fields by tab:

**Tab 1 — Personal Information**

| Field | Format | Required |
|---|---|---|
| Title | Select: Mr., Ms., Mrs., Dr., Prof. | Yes |
| First Name | Text | Yes |
| Last Name | Text | Yes |
| Gender | Select: Male, Female, Other | Yes |
| Date of Birth | YYYY-MM-DD | Yes |
| Email Address | Must end in @gov.la | Yes |
| Mobile Number | Digits only | No |

**Tab 2 — Employment Details**

| Field | Format | Required |
|---|---|---|
| Date of Joining | YYYY-MM-DD | Yes |
| Employment Type | Permanent / Probationary / Contract / Intern | Yes |
| Position / Designation | Text | Yes |
| Education Qualification | Select from list | Yes |
| Prior Experience (Years) | Number | Yes |
| Grade | Number 1–10 | Yes |
| Step | Number 1–15 | Yes |

**Tab 3 — Identity**

| Field | Format | Required |
|---|---|---|
| Civil Service Card ID | Must be unique | Yes |
| Social Security Number | Optional | No |

**Tab 4 — Organisation**

| Field | Format | Required |
|---|---|---|
| Ministry | Select from dropdown | Yes |
| Department | Select from dropdown | Yes |
| Division | Text | No |
| Service Country | Select | Yes |
| Service Province | Select from dropdown | Yes |
| Service District | Text | No |

**Tab 5 — Address**

| Field | Required |
|---|---|
| House Number, Street, Area/Baan | No |
| Province of Residence | No |
| PIN Code, Country | No |

**Tab 6 — Bank Details**

| Field | Format | Required |
|---|---|---|
| Bank Name | Select from dropdown — all licensed banks in Lao PDR | Yes |
| Bank Branch | Select from dropdown — filters automatically by selected bank | Yes |
| Bank Account Number | Must be unique | Yes |

**Tab 7 — Payroll Flags**

| Field | Format | Required |
|---|---|---|
| Has Spouse | Yes / No | Yes |
| Number of Eligible Children | 0–3 | Yes |
| Position Level | Auto-derived from position title | Yes |
| Is NA Member | Yes / No | Yes |
| Field Allowance Type | Teaching / Medical / None | Yes |

3. Click **Add Employee**.
4. A success message shows the new employee code (e.g. LAO00506).

---

#### Method 2 — Excel Bulk Upload (multiple employees)

**Steps:**

1. Click **Employees** → **Bulk Upload**.
2. Click **Download Template** to get the official Excel template. Do not change the column headers.
3. Fill in employee details — one row per employee. Rules:
   - Leave the Employee Code column blank — it will be auto-generated.
   - Dates must be in **YYYY-MM-DD** format.
   - Email must end in **@gov.la**.
   - Bank Branch must match the selected Bank Name.
4. Save the file and return to the Bulk Upload page.
5. Click **Choose File**, select your file, and click **Upload**.
6. The system validates every row and shows a preview:
   - Valid rows shown in green — ready to import
   - Error rows shown in red — with specific field and error message
7. Fix errors in your file and re-upload, or click **Confirm Import** to import only valid rows.
8. A summary shows how many employees were imported and how many were skipped.

**Common errors and fixes:**

| Error Message | Cause | Fix |
|---|---|---|
| Email already registered | Duplicate email address | Correct or verify the email |
| Civil Service Card ID duplicate | CSC ID already used | Verify the CSC ID |
| Bank account number duplicate | Account number already used | Verify the account number |
| Invalid bank/branch combination | Branch does not belong to selected bank | Select correct branch |
| Invalid date format | Date not in YYYY-MM-DD | Correct the date format |
| SSO number duplicate | SSO already registered | Verify the SSO number |

---

#### Method 3 — Online Grid Entry (multiple employees in browser)

**Steps:**

1. Click **Employees** → **Online Grid Entry**.
2. Click on any cell and enter data. Use Tab to move between cells.
3. Dropdown columns (Ministry, Province, Bank Name, Bank Branch, Title, Gender, etc.) — click the cell and select from the list.
4. Bank Branch options automatically filter based on the selected Bank Name.
5. Date fields — type in **YYYY-MM-DD** format.
6. Maximum **200 rows** per session.
7. The **Status** column shows:
   - Grey ○ — empty
   - Green ✓ — valid, ready to submit
   - Red ✗ — errors present
8. Click **Submit Valid Rows**.
9. A summary shows imported records with their employee codes, and skipped rows with error details.
10. Confirm to clear successfully imported rows from the grid. Error rows remain for you to fix.

**Important tips:**
- Title, First Name, and Last Name columns are pinned — they stay visible when you scroll right.
- Duplicates are detected in real time as you type.
- You can fix errors in the grid and resubmit without losing your work.

---

### 4.5 Editing an Employee Record

Data ownership rules determine which records you can edit:

| Record Was Created By | Can You Edit It? |
|---|---|
| The employee (self-registration) | Yes — employee-created records in your scope |
| Administrator | Yes |
| You (this manager) | Yes — your own uploads |
| A different manager | No |

If a record cannot be edited by you, the Edit button is greyed out with the tooltip: *"You do not have permission to edit this record."*

**Steps:**
1. Click **Employees** → **Employee List**.
2. Find the employee and click the **Edit** (pencil) icon.
3. Update the required fields.
4. Click **Save Changes**.

### 4.6 Approving or Rejecting Registrations

When an employee self-registers with a location and department in your scope, their registration appears in your Pending Registrations list.

**To approve:**
1. Click **Pending Registrations** in the sidebar.
2. Review the details: Full Name, Email, SSO Number, Location, Department, Date Submitted.
3. Click **Approve**.
4. A dialog shows the **temporary password** — this is displayed **once only**. Copy it and share with the employee securely.
5. Click OK. The account is now active.

**To reject:**
1. Click **Pending Registrations** in the sidebar.
2. Click **Reject** on the registration.
3. Enter an optional rejection reason.
4. Click **Confirm Reject**.

> The temporary password is shown only once at approval. If the employee does not receive it, contact your Administrator to reset the password.

### 4.7 Exporting the Employee List

1. Click **Employees** → **Employee List**.
2. Apply filters if needed to narrow the list.
3. Click the **Export** dropdown (top right).
4. Select **Export Excel** or **Export PDF**.

- **Excel:** Immediate download for ≤100 employees. Background job for >100 employees — file downloads when ready (within 2 minutes).
- **PDF:** Immediate download. Maximum 1,000 employees. Landscape A4 format with page numbers.

### 4.8 Dashboard

Your dashboard shows data for employees within your assigned scope.

**KPI Cards (top row):**

| Card | What It Shows |
|---|---|
| Total Employees | Count of active employees in your scope |
| Data Complete | Employees with fully completed records, and fill rate percentage |
| Pending Registrations | Registrations awaiting your approval — click to go to the approvals page |

**Employee Data Status Panel:**

Select a filter to see detailed statistics:

- **Department** — select a department to see: total employees, records filled, records pending, fill rate percentage
- **Location** — select a province to see the same breakdown by location
- **Manager** — select your own name to see your total tagged employees and data completeness

Each selection shows a progress bar: green (filled) and red (pending).

**Charts (scroll down):**

| Chart | What It Shows |
|---|---|
| Data Fill Rate by Department | Stacked bar — green = complete, red = incomplete |
| Employment Type Mix | Pie chart — Permanent vs Probationary |
| Grade Distribution | Bar chart — number of employees at each grade |
| Monthly Payroll Trend | Line chart — 12-month gross and net payroll (Admin only) |

---

## 5. Administrator Role Guide

As an Administrator, you have full access to all system functions including employee management, payroll calculation, master data, user management, and audit trail.

### 5.1 What You Can Do

| Action | Available |
|---|---|
| All employee actions (view, add, edit, deactivate) | Yes — all employees |
| Run monthly payroll | Yes |
| Approve and lock payroll | Yes |
| Manage master data (grades, allowances, PIT, banks, etc.) | Yes |
| Manage users (create, edit, reset passwords) | Yes |
| Manage Manager Master and Department Officer Master | Yes |
| Approve or reject registrations | Yes |
| View and export audit trail | Yes |
| View all dashboard data | Yes |
| Export employee lists | Yes |

### 5.2 Dashboard

As an Administrator, the Dashboard shows organisation-wide data.

**KPI Cards:**

| Card | What It Shows |
|---|---|
| Total Employees | All active employees in the system |
| Data Complete | Count and percentage of fully completed records |
| Pending Registrations | All pending registrations system-wide |
| Gross Payroll (Current Month) | Total gross payroll for the current month in LAK |
| Net Payroll (Current Month) | Total net payroll for the current month in LAK |

**Employee Data Status Panel:**
- Select any **Department**, **Location**, or **Manager** to see employee counts and data fill rate for that selection.

**Charts:**
- Data Fill Rate by Department
- Employment Type Mix
- Grade Distribution
- Monthly Payroll Trend (12 months) — gross payroll, net payroll, and headcount

### 5.3 Managing Users

#### 5.3.1 Viewing the User List

1. Click **User Management** in the left sidebar.
2. The list shows all system users with: Username, Full Name, Email, Role, Status, Last Login.

#### 5.3.2 Creating a New User

1. Click **User Management** → **Add User**.
2. Fill in the form:

| Field | Description |
|---|---|
| Username | Unique login name (lowercase, no spaces) |
| Full Name | User's full name |
| Email | User's email address |
| Role | Select: Employee, Manager, Department Officer, or Administrator |
| Preferred Language | English or Lao |

3. Click **Save**. A temporary password will be generated and displayed — share it with the user.
4. The user will be prompted to change their password on first login.

#### 5.3.3 Editing a User

1. Click **User Management**.
2. Click **Edit** next to the user.
3. Update the required fields (name, email, role, language).
4. Click **Save**.

> Changing a user's role takes effect on their next login.

#### 5.3.4 Resetting a User's Password

1. Click **User Management**.
2. Click **Reset Password** next to the user.
3. A new temporary password will be generated and displayed.
4. Share the temporary password with the user securely.
5. The user will be prompted to change it on next login.

#### 5.3.5 Deactivating a User

1. Click **User Management**.
2. Click **Edit** next to the user.
3. Set **Is Active** to **No**.
4. Click **Save**. The user can no longer log in.

#### 5.3.6 Approving Pending Registrations

1. Click **Pending Registrations** in the sidebar.
2. All pending self-registrations are shown.
3. Click **Approve** to activate an account — a temporary password will be displayed.
4. Click **Reject** to decline, with an optional reason.

### 5.4 Managing Scope — Manager Master

The Manager Master defines which location and department each Manager user can access. You or a Department Officer must assign scope to a Manager before they can log in and view employees.

#### 5.4.1 Assigning a Scope to a Manager

1. Click **Master Data** → **Manager Master**.
2. Click **Add Manager Scope**.
3. Fill in the drawer:
   - **Manager** — select the manager user from the dropdown
   - **Location** — select the province
   - **Department** — select the department
4. Click **Save**. The manager can now see employees in that location + department.

A manager can have multiple scope rows. Repeat the process to add additional location + department combinations for the same manager.

#### 5.4.2 Editing or Removing a Scope

- Click **Edit** on any scope row to change the location or department assignment.
- Click **Remove** on an active scope row to deactivate it (the row remains visible as inactive).
- Use the **Show: All / Active only** toggle to show or hide inactive rows.
- The **Employees Tagged** column shows how many active employees are currently in each scope.

### 5.5 Managing Scope — Department Officer Master

The Department Officer Master defines which departments each Department Officer user can manage.

1. Click **Master Data** → **Dept Officer Master**.
2. Click **Add Department Officer**.
3. Select the Department Officer user and the Department.
4. Click **Save**.

The **Employees** column shows how many active employees are in each department.

### 5.6 Managing Master Data

Master data controls the lookup tables used throughout the system. All master screens support Add, Edit, and (where applicable) soft-delete. Access is restricted to Administrators.

| Master Screen | What It Controls |
|---|---|
| Grade & Step — Basic Salary | Grade and step index values used to calculate basic salary |
| Allowance Rates | Flat-rate and percentage-based allowance amounts |
| Grade Derivation Matrix | Rules that derive grade and step from education level and experience |
| Organisation Master | Ministry and department hierarchy |
| Location Master | Provinces, districts, remote/hazardous classifications |
| Bank Master | Licensed banks and branches in Lao PDR |
| PIT Brackets | Personal Income Tax progressive brackets |

**To edit any master record:**
1. Click **Master Data** and select the relevant screen.
2. Find the row and click **Edit**.
3. Update the fields in the drawer.
4. Click **Save**.

**To add a new record:**
1. Click the **Add** button (top right of each master screen).
2. Fill in the required fields.
3. Click **Save**.

**Show All / Active Only toggle:** Most master screens show only active records by default. Use the **Show: All / Active only** toggle to display inactive records. Inactive records can still be edited to reactivate them.

### 5.7 Running Monthly Payroll

Payroll is calculated monthly for all active employees. This function is available to Administrators only.

#### 5.7.1 Running the Payroll Calculation

1. Click **Payroll** in the left sidebar.
2. The Payroll page shows the current month and previous payroll runs.
3. To run payroll for the current month, click **Run Payroll**.
4. Confirm the month in the dialog.
5. The system will calculate payroll for all active employees. A progress indicator shows while the calculation runs.
6. When complete, the results are shown in the payroll register table.

#### 5.7.2 What Payroll Calculates

For each active employee, the system calculates:

| Component | Basis |
|---|---|
| Basic Salary | Grade × Step index × 10,000 LAK |
| Position Allowance | Based on position level (Minister, Director, General Staff, etc.) |
| Teaching Allowance | 20% of basic salary (for teaching profession) |
| Medical Allowance | Flat rate (for medical profession) |
| Remote Area Allowance | 25% of basic salary (for remote provinces) |
| Hazardous Area Allowance | Flat rate (for hazardous provinces) |
| Foreign Posting Allowance | Flat rate (for foreign postings) |
| Spouse Allowance | Flat rate per spouse |
| Child Allowance | Flat rate per eligible child (maximum 3) |
| Housing Allowance | Flat rate |
| Transport Allowance | Flat rate |
| NA Member Allowance | Flat rate (National Assembly members only) |
| Employee SSO Contribution | 5.5% of basic salary (deducted from gross) |
| Employer SSO Contribution | 6% of basic salary (employer cost) |
| Taxable Income | Gross salary minus employee SSO |
| Personal Income Tax (PIT) | Progressive 6-bracket calculation on taxable income |
| **Net Salary** | **Gross salary minus employee SSO minus PIT** |

#### 5.7.3 Reviewing Payroll Results

After running payroll, the register table shows each employee's payroll record for the month. You can:
- Search and filter by ministry, department, grade, or employee code
- View individual payroll records by clicking an employee row
- Export the payroll register to Excel for distribution to ministries

#### 5.7.4 Approving and Locking Payroll

- **Approve:** Click **Approve** on the payroll run to mark it as approved. Approved payrolls are visible to authorised recipients.
- **Lock:** Click **Lock Month** to prevent further changes to the payroll for that month. Locked payroll cannot be re-run or edited.

### 5.8 Exporting Employee Data

1. Click **Employees** → **Employee List**.
2. Apply filters to narrow the list if needed.
3. Click the **Export** dropdown and select **Export Excel** or **Export PDF**.

- **Excel:** Immediate download for ≤100 employees. Background job (within 2 minutes) for >100 employees.
- **PDF:** Immediate download. Maximum 1,000 employees. Landscape A4.

### 5.9 Audit Trail

The Audit Trail records every data change in the system — who changed what, when, and what the old and new values were.

1. Click **Audit Trail** in the left sidebar.
2. The audit log is shown in reverse chronological order (most recent first).
3. Use the filters to search by:
   - Date range
   - User who made the change
   - Record type (employee, user, master data)
   - Employee code
4. Click **Export to Excel** to download the audit log for the filtered period.

The audit log cannot be edited or deleted by any user, including administrators.

---

## 6. Frequently Asked Questions

**Q: I forgot my password. What do I do?**
A: Contact your Manager (if you are an Employee) or your System Administrator. They can reset your password and give you a new temporary password.

**Q: My account is locked. What do I do?**
A: Wait 15 minutes and try again. If you need immediate access, contact your System Administrator to unlock your account.

**Q: I registered but cannot log in.**
A: Your registration is pending approval by your Manager. You cannot log in until approved. Contact your Manager to approve your registration.

**Q: I can see a record but the Edit button is greyed out.**
A: The record was created by another manager and the data ownership rules prevent you from editing it. Contact your System Administrator if you believe this is incorrect.

**Q: I selected a bank but the branch dropdown is empty.**
A: The selected bank may not have branches registered in the system. Contact your System Administrator to add the branch to the Bank Master.

**Q: My Excel bulk upload failed with no rows imported.**
A: Check the error details shown in the validation preview. Common causes include duplicate email addresses, invalid date formats, or mismatched bank/branch combinations. Fix the errors in your file and re-upload.

**Q: The payroll calculation shows incorrect allowances.**
A: Check the employee's profile to ensure the service province (for remote/hazardous allowances), profession category (for teaching/medical), and payroll flags (spouse, children) are correctly filled. If the master data rates have changed, contact your Administrator.

**Q: How do I add a manager who is not yet in the system?**
A: Go to User Management and create a new user with the Role set to Manager. Then go to Master Data → Manager Master and assign the manager's scope (location + department).

**Q: Can an employee see their payslip?**
A: In the current version, payslips are generated by Administrators and distributed offline. Employee self-service payslip access is planned for a future phase.

**Q: What happens to old payroll data?**
A: Payroll data is retained for 3 years in active storage and then archived. Archived data can be retrieved by Administrators on request.

---

## 7. Glossary

| Term | Definition |
|---|---|
| **Basic Salary** | The monthly salary calculated as grade index × step index × 10,000 LAK |
| **Civil Service Card ID (CSC ID)** | A unique government-issued identifier for each civil servant |
| **Department Officer** | A system role with authority to assign managers to departments |
| **Employee Code** | A unique system-generated code in the format LAO##### assigned to each employee record |
| **Field Allowance** | An additional monthly payment for employees in teaching or medical professions |
| **Grade** | The civil service grade level (1–6 in most cases), determining base pay |
| **Gross Salary** | Total monthly earnings before deductions (basic salary + all allowances) |
| **Hazardous Area Allowance** | A flat-rate allowance for employees posted in provinces classified as hazardous by MoHA |
| **LAK** | Lao Kip — the currency used for all monetary values in the system |
| **Manager Scope** | The specific location (province) and department combination that a manager is authorised to manage |
| **MoF** | Ministry of Finance |
| **MoHA** | Ministry of Home Affairs |
| **Net Salary** | Gross salary minus employee SSO contribution minus Personal Income Tax |
| **Owner Role** | Indicates which role created the employee record (Employee, Manager, or Admin), used to enforce data ownership |
| **PIT** | Personal Income Tax — calculated progressively on taxable income at rates of 0% to 24% |
| **Remote Area Allowance** | 25% of basic salary for employees posted in provinces classified as remote by MoHA |
| **Scope** | The set of locations and departments a Manager or Department Officer is authorised to access |
| **SSO** | Social Security Organisation — employee contributes 5.5% of basic salary; employer contributes 6% |
| **SSO Number** | The employee's Social Security Organisation registration number |
| **Step** | The step within a grade, affecting the salary index used for basic salary calculation |
| **Taxable Income** | Gross salary minus employee SSO contribution — this is the amount on which PIT is calculated |
| **Uploaded By** | The user who created an employee record; used to enforce data ownership rules |

---

*IFMS Payroll Module — User Manual Version 1.0*
*Lao PDR Government — Ministry of Finance*
*March 2026 — Official Use Only*
*For technical support, contact your System Administrator.*
