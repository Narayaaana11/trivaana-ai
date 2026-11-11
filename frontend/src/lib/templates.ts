export interface IndustryTemplate {
  id: string;
  title: string;
  mode: 'Instant' | 'Bulk' | 'Inbound';
  description: string;
}

export interface IndustryCategory {
  id: string;
  name: string;
  templates: IndustryTemplate[];
}

export const INDUSTRY_TEMPLATE_CATEGORIES: IndustryCategory[] = [
  {
    id: 'bfsi',
    name: 'BFSI',
    templates: [
      { id: 'bfsi_home_loan', title: 'Home loan enquiry', mode: 'Instant', description: 'Call new home loan enquiries within 30s, verify property city, loan amount, employment type, and schedule advisor callback.' },
      { id: 'bfsi_personal_loan', title: 'Personal loan lead', mode: 'Instant', description: 'Qualify personal loan leads on monthly salary, city, desired amount, and collect KYC document readiness.' },
      { id: 'bfsi_business_loan', title: 'Business loan lead', mode: 'Instant', description: 'Check business vintage, annual turnover, GST registration, and book an SME credit officer consultation.' },
      { id: 'bfsi_motor_renewal', title: 'Motor insurance renewal', mode: 'Bulk', description: 'Remind vehicle owners of upcoming policy expiry, confirm NCB eligibility, and send renewal link on WhatsApp.' },
      { id: 'bfsi_health_ins', title: 'Health insurance lead', mode: 'Instant', description: 'Ask family members to cover, city, and preferred sum insured to match a health insurance advisor.' },
      { id: 'bfsi_life_ins', title: 'Life & term insurance', mode: 'Instant', description: 'Qualify term life cover enquiries on age bracket, income band, and preferred callback slot.' },
      { id: 'bfsi_emi', title: 'EMI payment reminder', mode: 'Bulk', description: 'Polite service reminder for upcoming or due EMI installments with payment link confirmation.' },
      { id: 'bfsi_kyc', title: 'Loan KYC & documents', mode: 'Bulk', description: 'Follow up with applicants to complete pending PAN/Aadhaar/bank statement uploads.' },
      { id: 'bfsi_dormant', title: 'Dormant loan customer', mode: 'Bulk', description: 'Re-engage past approved borrowers with pre-qualified top-up options.' },
      { id: 'bfsi_inbound_ins', title: 'Insurance renewal inbound', mode: 'Inbound', description: 'Answer incoming policyholder renewal questions, policy status checks, and claim desk routing.' },
    ],
  },
  {
    id: 'real_estate',
    name: 'Real estate',
    templates: [
      { id: 're_site_visit', title: 'Property lead site visit', mode: 'Instant', description: 'Call property portal/ad leads in under 30s, qualify 2BHK/3BHK/Villa preference, budget, location, and book a weekend site visit.' },
      { id: 're_inbound', title: 'Inbound project enquiry', mode: 'Inbound', description: 'Answer incoming calls about floor plans, RERA approval, starting price from knowledge base, and send location pin.' },
    ],
  },
  {
    id: 'healthcare',
    name: 'Healthcare & clinics',
    templates: [
      { id: 'hc_opd', title: 'OPD appointment confirmation', mode: 'Bulk', description: 'Confirm upcoming doctor appointments, share clinic timings, and reschedule if needed.' },
      { id: 'hc_inbound', title: 'Clinic reception desk', mode: 'Inbound', description: 'Answer patient enquiries on doctor availability, consultation fees, and book appointments.' },
    ],
  },
  {
    id: 'education',
    name: 'Education & coaching',
    templates: [
      { id: 'ed_admissions', title: 'Admissions & demo counselor', mode: 'Instant', description: 'Call student/parent enquiries, confirm target exam/course, and register for a free scholarship/demo class.' },
    ],
  },
  {
    id: 'automotive',
    name: 'Automotive',
    templates: [
      { id: 'auto_test_drive', title: 'Test drive scheduler', mode: 'Instant', description: 'Follow up on SUV/EV test drive leads and book doorstep or showroom test drives.' },
      { id: 'auto_service', title: 'Periodic service reminder', mode: 'Bulk', description: 'Remind vehicle owners of scheduled maintenance and offer pickup/drop slot booking.' },
    ],
  },
  {
    id: 'ecommerce',
    name: 'E-commerce & D2C',
    templates: [
      { id: 'ec_cod', title: 'COD order verification', mode: 'Instant', description: 'Confirm Cash-on-Delivery orders, verify shipping address, and reduce RTO returns.' },
    ],
  },
  {
    id: 'home_services',
    name: 'Home services & repairs',
    templates: [
      { id: 'hs_booking', title: 'Technician visit confirmation', mode: 'Instant', description: 'Confirm appliance/AC/plumbing service slot and send technician ETA.' },
    ],
  },
  {
    id: 'jewellery',
    name: 'Jewellery & fashion',
    templates: [
      { id: 'jw_vip', title: 'Bridal / VIP showroom invite', mode: 'Bulk', description: 'Invite loyalty members to exclusive collection previews and private styling appointments.' },
    ],
  },
  {
    id: 'hospitality',
    name: 'Hotels & restaurants',
    templates: [
      { id: 'ht_table', title: 'Reservation & banquet enquiry', mode: 'Inbound', description: 'Handle table bookings, group dining enquiries, and event hall availability.' },
    ],
  },
  {
    id: 'travel',
    name: 'Travel & tours',
    templates: [
      { id: 'tr_package', title: 'Holiday package lead', mode: 'Instant', description: 'Ask destination, travel dates, group size, and budget to connect with a holiday specialist.' },
    ],
  },
  {
    id: 'solar',
    name: 'Solar & home improvement',
    templates: [
      { id: 'sl_rooftop', title: 'Rooftop solar survey', mode: 'Instant', description: 'Qualify monthly electricity bill, roof area, and schedule a free technical site survey.' },
    ],
  },
  {
    id: 'recruitment',
    name: 'Recruitment & staffing',
    templates: [
      { id: 'rc_screen', title: 'Candidate screening call', mode: 'Bulk', description: 'Screen applicants on years of experience, current location, notice period, and interview availability.' },
    ],
  },
  {
    id: 'wholesale',
    name: 'Wholesale & distribution',
    templates: [
      { id: 'wh_reorder', title: 'Dealer stock & reorder check', mode: 'Bulk', description: 'Check retailer inventory needs and capture weekly restock orders.' },
    ],
  },
  {
    id: 'other',
    name: 'Other',
    templates: [
      { id: 'oth_general', title: 'General lead qualification', mode: 'Instant', description: 'Polite custom AI voice employee that qualifies caller intent, answers FAQs from knowledge base, and books a callback.' },
    ],
  },
];

