# Feature: Advanced Staff Permissions

**Document Version**: 1.0.0  
**Status**: Proposed  
**Created**: 2025-10-08  
**Author**: Gemini

---

## 1. Objective

To expand the current staff management system from predefined roles (`owner`, `staff`) to a flexible and granular Role-Based Access Control (RBAC) system. This will allow merchant owners to create custom roles and assign a specific set of permissions, enabling them to give employees access to only the parts of the dashboard they need to do their jobs.

This is a crucial feature for larger, more established businesses and a key differentiator from simpler platforms.

---

## 2. Key Features

### 2.1. Role Management

- **Default Roles:** The system will still come with non-editable default roles:
  - **Owner:** Full access to everything, including billing and staff management.
  - **Administrator:** Full access except for billing and store deletion.
- **Custom Roles:** Merchants on Pro and Max plans can create their own roles (e.g., "Fulfillment Manager", "Content Editor", "Accountant").
- **Role Creation UI:** A dashboard interface under `Settings > Staff` to create, edit, and delete custom roles.

### 2.2. Granular Permissions

- **Permission Groups:** Permissions will be grouped logically in the UI:
  - **Products:** `view`, `create`, `update`, `delete`
  - **Orders:** `view`, `create`, `update`, `cancel`, `fulfill`
  - **Customers:** `view`, `create`, `update`, `delete`
  - **Discounts:** `view`, `create`, `update`, `delete`
  - **Analytics:** `view_reports`
  - **Settings:** `manage_store_settings`, `manage_payments`, `manage_shipping`
- **Permission Checkboxes:** When creating or editing a role, the owner will see a list of all available permissions and can check the ones they want to grant to that role.

### 2.3. Staff Assignment

- **Invite Staff:** Owners can invite new staff members via email.
- **Assign Role:** During the invitation process, the owner must assign one or more roles to the new staff member.
- **Role Modification:** An owner can easily change the roles assigned to an existing staff member.

---

## 3. Database Schema Changes

To support this, we need to introduce `roles`, `permissions`, and a join table `role_permissions`. The existing `staff_members` table will be updated.

```sql
-- Create a table for all possible permissions in the system
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'products:create'
  description TEXT
);

-- Create a table for roles, which are tenant-specific
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false, -- To protect 'Owner' role
  UNIQUE(tenant_id, name)
);

-- Join table to link roles with their permissions
CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Update the staff_members table to use the new roles table
-- The old 'role' column can be removed.
CREATE TABLE staff_roles (
    staff_id UUID REFERENCES staff_members(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (staff_id, role_id)
);
```

---

## 4. Technical Implementation

- **Backend:**
  - A new set of API endpoints will be created under `/api/staff` and `/api/roles` for managing roles, permissions, and assignments.
  - The core authentication middleware will be updated. When a user logs in, their JWT payload will include their assigned `role_ids`.
  - A new authorization middleware or helper function, `can(permission: string)`, will be created. This function will check if any of the user's assigned roles contain the required permission for the action they are trying to perform.

- **Frontend:**
  - A new section in the merchant dashboard under `Settings > Staff & Permissions` will be built.
  - This UI will allow owners to perform full CRUD (Create, Read, Update, Delete) operations on custom roles.
  - When inviting or editing a staff member, a multi-select dropdown will allow the owner to assign roles.

---

## 5. Priority & Sprint Assignment

- **Priority:** **P2 (Growth)**. This is a key feature for attracting larger, more established businesses that have multiple employees with different responsibilities.
- **Proposed Sprint:** Sprints 13-14.
