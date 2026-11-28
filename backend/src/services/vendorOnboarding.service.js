/**
 * Vendor onboarding: complete the business profile → submit → admin reviews → approved.
 * Until approved a vendor can only reach their profile and notifications (routes/vendor.routes.js).
 */

/** What must be filled in before a vendor can ask for approval. GSTIN and UPI stay optional. */
const REQUIRED = [
  ['business', 'name', 'Contact name'],
  ['business', 'phone', 'Mobile'],
  ['business', 'businessName', 'Business name'],
  ['business', 'businessType', 'Business type'],
  ['business', 'pan', 'PAN'],
  ['business', 'address.line1', 'Address'],
  ['business', 'address.city', 'City'],
  ['business', 'address.state', 'State'],
  ['business', 'address.pincode', 'Pincode'],
  ['bank', 'bank.accountHolder', 'Account holder'],
  ['bank', 'bank.accountNumber', 'Account number'],
  ['bank', 'bank.ifsc', 'IFSC'],
  ['bank', 'bank.bankName', 'Bank name'],
];
const REQUIRED_DOCS = [['pan', 'PAN card'], ['id_proof', 'Owner ID proof']];

const read = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

export function missingProfile(vendor) {
  const fields = REQUIRED.filter(([, path]) => !String(read(vendor, path) ?? '').trim()).map(([section, key, label]) => ({ section, key, label }));
  // a rejected document has to be uploaded again
  const docs = REQUIRED_DOCS.filter(([type]) => !vendor.documents?.some((d) => d.type === type && d.status !== 'rejected')).map(([key, label]) => ({ section: 'docs', key, label }));
  return [...fields, ...docs];
}

/** Document list for a client: the storage key stays on the server */
export const publicDocuments = (documents = []) => documents.map((d) => { const { file, ...rest } = d.toObject ? d.toObject() : d; return rest; });

/** After approval the business, bank and document details are verified facts — the vendor can't change them */
export const isProfileLocked = (vendor) => ['approved', 'suspended'].includes(vendor.status);

/** stage: incomplete · review · rejected · approved · suspended */
export function onboarding(vendor) {
  const missing = missingProfile(vendor);
  let stage = vendor.status;
  if (vendor.status === 'pending') stage = vendor.submittedAt && !missing.length ? 'review' : 'incomplete';
  return { stage, missing };
}

/** The vendor as their own panel receives it */
export function vendorView(vendor) {
  const v = vendor.toObject ? vendor.toObject() : { ...vendor };
  delete v.password;
  return { ...v, documents: publicDocuments(v.documents), onboarding: onboarding(v) };
}
