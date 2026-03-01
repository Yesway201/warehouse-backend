# 3PL Warehouse Receiving Application - Development Plan

## Design Guidelines

### Design References
- **Primary Inspiration**: Modern logistics dashboards (ShipBob, Flexport)
- **Style**: Professional Dashboard + Clean Data Tables + Mobile-First Forms
- **Color Scheme**: Logistics/Industrial theme with clear status indicators

### Color Palette
- Primary: #1E40AF (Deep Blue - navigation, primary actions)
- Secondary: #64748B (Slate Gray - secondary elements)
- Success: #10B981 (Green - approved, completed)
- Warning: #F59E0B (Amber - pending review)
- Danger: #EF4444 (Red - rejected, issues)
- Background: #F8FAFC (Light Gray - main background)
- Card: #FFFFFF (White - cards, panels)
- Text: #0F172A (Dark Slate - primary text)

### Typography
- Heading1: Inter font-weight 700 (32px)
- Heading2: Inter font-weight 600 (24px)
- Heading3: Inter font-weight 600 (18px)
- Body: Inter font-weight 400 (14px)
- Body/Bold: Inter font-weight 600 (14px)
- Small: Inter font-weight 400 (12px)

### Key Component Styles
- **Buttons**: Primary blue, secondary gray, success green, rounded-md
- **Cards**: White background, subtle shadow, rounded-lg border
- **Tables**: Striped rows, hover effects, sortable headers
- **Forms**: Clear labels, validation states, mobile-optimized inputs
- **Status Badges**: Color-coded (green=approved, amber=pending, red=rejected)

### Layout & Spacing
- Dashboard: Sidebar navigation (desktop), bottom nav (mobile)
- Content area: Max-width container with padding
- Cards: 16px padding, 8px gap between elements
- Forms: Stacked layout on mobile, 2-column on desktop

### Images to Generate
1. **hero-warehouse-operations.jpg** - Modern warehouse with workers and technology (Style: photorealistic, bright industrial)
2. **icon-shipment-tracking.png** - Icon for shipment dashboard (Style: minimalist, blue theme)
3. **icon-asn-document.png** - Icon for ASN creation (Style: minimalist, blue theme)
4. **icon-receiving-checklist.png** - Icon for receiving interface (Style: minimalist, blue theme)
5. **icon-review-approval.png** - Icon for office review (Style: minimalist, blue theme)
6. **logo-3pl-warehouse.png** - Application logo (Style: professional, logistics theme)

---

## Development Tasks

### 1. Project Setup & Core Structure
- [x] Initialize shadcn-ui template
- [ ] Generate all required images using ImageCreator
- [ ] Update index.html with proper title and meta tags
- [ ] Create main layout component with navigation
- [ ] Set up routing for all main pages
- [ ] Create authentication context with role management (Warehouse/Office)

### 2. Authentication & Role Management
- [ ] Create Login page component
- [ ] Implement role-based routing guards
- [ ] Create user context with role state (Warehouse Staff / Office Staff)
- [ ] Add role switcher for demo purposes (since no backend)
- [ ] Style authentication pages

### 3. Shipment Dashboard (Smartsheet Integration)
- [ ] Create ShipmentDashboard page component
- [ ] Build shipment list table with sortable columns
- [ ] Add filter controls (date range, status, vendor)
- [ ] Create search functionality
- [ ] Add mock Smartsheet data structure
- [ ] Create API configuration section for Smartsheet credentials
- [ ] Style dashboard with responsive design

### 4. ASN Creation Module
- [ ] Create ASNCreation page component
- [ ] Build multi-step form for ASN details
- [ ] Add shipment selection from Smartsheet data
- [ ] Create ASN storage mechanism (localStorage for MVP)
- [ ] Add ASN list view with edit/delete capabilities
- [ ] Generate printable ASN documents
- [ ] Style forms with validation states

### 5. Warehouse Receiving Interface
- [ ] Create ReceivingInterface page component
- [ ] Build mobile-optimized receiving form
- [ ] Add ASN selection dropdown
- [ ] Create line item receiving with quantity inputs
- [ ] Add photo upload capability for received items
- [ ] Add condition notes and discrepancy reporting
- [ ] Implement receiving history log
- [ ] Style for tablet/mobile use

### 6. Office Review Portal
- [ ] Create ReviewPortal page component
- [ ] Build pending receivings queue
- [ ] Create detailed receiving review view
- [ ] Add approve/reject actions with comments
- [ ] Create receiving history with audit trail
- [ ] Add bulk approval functionality
- [ ] Style review interface

### 7. API Integration & Mapping
- [ ] Create APISettings page component
- [ ] Build Smartsheet API configuration form
- [ ] Build Extensiv API configuration form
- [ ] Create field mapping interface (Smartsheet → App)
- [ ] Create field mapping interface (App → Extensiv)
- [ ] Add connection testing functionality
- [ ] Store API configs securely (localStorage encrypted for MVP)
- [ ] Style settings interface

### 8. Extensiv Sync Module
- [ ] Create ExtensivSync component
- [ ] Build sync queue for approved receivings
- [ ] Add sync status tracking
- [ ] Create error handling and retry logic
- [ ] Add sync history log
- [ ] Build manual sync trigger
- [ ] Style sync interface

### 9. Dashboard & Analytics
- [ ] Create main Dashboard page
- [ ] Add key metrics cards (pending shipments, receivings today, etc.)
- [ ] Create charts for receiving trends
- [ ] Add recent activity feed
- [ ] Style dashboard overview

### 10. Final Polish & Testing
- [ ] Run pnpm run lint and fix all errors
- [ ] Test all user flows (Warehouse and Office roles)
- [ ] Verify responsive design on mobile/tablet/desktop
- [ ] Add loading states and error handling
- [ ] Create user documentation in README
- [ ] Final build and deployment preparation

---

## Data Structures

### Shipment (from Smartsheet)
```typescript
{
  id: string
  poNumber: string
  vendor: string
  expectedDate: string
  items: Array<{sku: string, description: string, expectedQty: number}>
  status: 'scheduled' | 'in-transit' | 'arrived'
  notes: string
}
```

### ASN (Advanced Shipping Notice)
```typescript
{
  id: string
  shipmentId: string
  createdBy: string
  createdAt: string
  items: Array<{sku: string, description: string, expectedQty: number}>
  specialInstructions: string
  status: 'draft' | 'active'
}
```

### Receiving
```typescript
{
  id: string
  asnId: string
  receivedBy: string
  receivedAt: string
  items: Array<{
    sku: string
    expectedQty: number
    receivedQty: number
    condition: 'good' | 'damaged' | 'defective'
    notes: string
    photos: string[]
  }>
  status: 'pending-review' | 'approved' | 'rejected'
  reviewedBy?: string
  reviewedAt?: string
  reviewComments?: string
}
```

### API Configuration
```typescript
{
  smartsheet: {
    apiKey: string
    sheetId: string
    fieldMapping: Record<string, string>
  }
  extensiv: {
    apiKey: string
    warehouseId: string
    fieldMapping: Record<string, string>
  }
}
```

---

## Technical Notes
- Use localStorage for data persistence (MVP approach)
- Implement proper TypeScript types for all data structures
- Use React Context for global state (auth, API configs)
- Leverage shadcn-ui components for consistent UI
- Ensure mobile-first responsive design
- Add proper error boundaries and loading states