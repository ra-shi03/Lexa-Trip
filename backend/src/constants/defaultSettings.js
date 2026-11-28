/**
 * Default platform settings. Everything here is editable from
 * Master Admin → Appearance / Features / Integrations, and served to the
 * web + app clients via GET /api/v1/public/settings.
 *
 * Colours are taken from the LexaTrip logo:
 *   orange gradient #F7931E → #EE5A0E, navy word-mark #14213D.
 */
export const DEFAULT_SETTINGS = {
  brand: {
    appName: 'LexaTrip',
    tagline: 'Book. Explore. Repeat.',
    logoUrl: '/lexatrip-logo-full.jpg',
    markUrl: '/lexatrip-mark.jpg',
    faviconUrl: '/lexatrip-mark.jpg',
    supportEmail: 'support@lexatrip.com',
    supportPhone: '',
    whatsapp: '',
    address: '',
  },
  theme: {
    preset: 'lexatrip',
    mode: 'light', // light | dark | system
    primary: '#F26B1D', // logo orange
    primaryHover: '#D9560B',
    primarySoft: '#FFF1E8',
    secondary: '#14213D', // logo navy
    accent: '#F7931E',
    background: '#FFFFFF',
    surface: '#F7F8FA',
    text: '#14213D',
    muted: '#5B6478',
    border: '#E6E8EE',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    fontFamily: 'Plus Jakarta Sans',
    headingFontFamily: 'Plus Jakarta Sans',
    radius: 12, // px — buttons/cards
    density: 'comfortable', // comfortable | compact
  },
  features: {
    hotels: true,
    buses: true,
    flights: true,
    aiAssistant: true,
    aiSmartSearch: true,
    aiTripPlanner: true,
    aiReviewSummary: true,
    wishlist: true,
    reviews: true,
    coupons: true,
    savedTravellers: true,
    priceInsights: true,
    mapView: true,
    supportTickets: true,
    payAtHotel: false,
    requestToBook: false, // global switch for approval-based bookings
    maintenanceMode: false,
  },
  /** Home screen composition for web + app — order and visibility */
  homeSections: [
    { key: 'hero_search', label: 'Hero search', enabled: true },
    { key: 'categories', label: 'Accommodation categories', enabled: true },
    { key: 'ai_banner', label: 'Lexa AI planner banner', enabled: true },
    { key: 'offers', label: 'Offers & coupons', enabled: true },
    { key: 'popular_destinations', label: 'Popular destinations', enabled: true },
    { key: 'featured_properties', label: 'Featured stays', enabled: true },
    { key: 'why_us', label: 'Why book with us', enabled: true },
  ],
  /** "Popular destinations" on the app + website home — Admin → Catalogue → Popular destinations (permission: catalog).
   *  items: [{ city, image? }] in display order; null = not curated yet → cities flagged isPopular */
  popularDestinations: { enabled: true, title: 'Popular destinations', subtitle: 'Trending with LexaTrip travellers', items: null },
  /** "Handpicked stays" on the app + website home — Admin → Catalogue → Handpicked stays (permission: properties).
   *  Which stays = Property.isFeatured; order = the ids here. */
  featuredStays: { enabled: true, title: 'Handpicked stays', subtitle: 'Top-rated properties our travellers love', order: [] },
  /** Home page content — images & text editable in Admin → Home page */
  home: {
    hero: {
      headline: 'Where to next?',
      subheadline: 'Compare hotels, villas, resorts, buses and flights across India.',
      overlayOpacity: 0.55,
      autoplaySeconds: 6,
      slides: [
        { url: 'https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?auto=format&fit=crop&w=1920&q=70', title: 'Udaipur', subtitle: 'City of Lakes' , link: '/search?city=Udaipur' },
        { url: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1920&q=70', title: 'Goa', subtitle: 'Beaches & villas', link: '/search?city=Goa' },
        { url: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1920&q=70', title: 'Manali', subtitle: 'Mountain escapes', link: '/search?city=Manali' },
        { url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1920&q=70', title: 'Luxury resorts', subtitle: 'Pools, spas & more', link: '/search?category=resorts' },
      ],
    },
    offers: { autoplay: true, autoplaySeconds: 4 },
    aiBanner: {
      title: 'Plan smarter with Lexa AI',
      text: 'Describe your dream trip in plain words — get a day-wise itinerary and matching stays in seconds.',
      image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1920&q=70',
    },
  },
  /** Login / sign-up page (website + app) — Admin → Login page */
  auth: {
    image: '/auth-hero.jpg',
    overlayOpacity: 0.3,
    showLogo: true,
    welcomeTitle: 'Welcome',
    welcomeText: 'Find your next stay, feel at home. Where comfort meets convenience.',
    loginLabel: 'Login',
    signupLabel: 'Sign Up',
    loginHeading: 'Welcome back',
    loginText: 'Log in with your mobile number — we’ll send a one-time password.',
    signupHeading: 'Create your account',
    signupText: 'Join to book stays, buses and flights faster.',
    emailField: 'optional', // optional | required | hidden
    highlights: ['Hotels, villas & resorts across India', 'Bus & flight tickets in one place', 'Secure payments & instant vouchers'], // shown beside the form on desktop
  },
  /** Mobile app (Android/iOS/PWA) — Admin → Mobile app */
  app: {
    /** Quick-service tiles under the app home hero. Built-in keys (stays/buses/flights/ai) also need their feature flag on; key 'custom' = any link. */
    quickServicesEnabled: true, // master switch for the whole tile row on the app home
    quickServices: [
      { key: 'stays', label: 'Stays', link: '/search', icon: 'bed-double', image: '', enabled: true },
      { key: 'buses', label: 'Buses', link: '/bus', icon: 'bus', image: '', enabled: true },
      { key: 'flights', label: 'Flights', link: '/flights', icon: 'plane', image: '', enabled: true },
      { key: 'ai', label: '', link: '/ai', icon: 'sparkles', image: '', enabled: true }, // label '' → first word of the AI assistant name
    ],
    splash: { background: '', image: '', seconds: 1.8, showTagline: true, tagline: '' }, // tagline '' → brand tagline // background '' → brand gradient from theme
    onboarding: {
      enabled: true,
      slides: [
        { image: 'https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?auto=format&fit=crop&w=1000&q=70', title: 'Discover stays you’ll love', text: 'Hotels, villas, resorts and homestays across India — at transparent prices.' },
        { image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1000&q=70', title: 'Book bus & flights too', text: 'One app for your stay, your bus seat and your flight.' },
        { image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1000&q=70', title: 'Plan with Lexa AI', text: 'Tell us your trip in plain words — get itineraries and matching stays.' },
      ],
    },
  },
  /** Region & time — Admin → Settings → Region & time (master admin). Decides "today" for bookings, deals,
   *  reports and jobs, and the clock every app/panel displays. IANA name: "Asia/Kolkata", "UTC", "Asia/Dubai"… */
  regional: { timezone: 'Asia/Kolkata' },
  /** Where new uploads go, per server mode (NODE_ENV) — Admin → Developer → Image setting, master admin only.
   *  'local' = server disk · 'cloudinary' = Cloudinary (falls back to disk until its .env keys are set). */
  storage: { development: 'cloudinary', production: 'local' },
  booking: {
    holdMinutes: 15, // inventory hold while payment is in progress
    maxRoomsPerBooking: 8,
    maxNights: 30,
    convenienceFee: 0,
    currency: 'INR',
  },
  /** India GST slabs for accommodation (configurable — verify current rates with your CA) */
  tax: {
    hotelSlabs: [
      { upTo: 7500, rate: 5 },
      { upTo: null, rate: 18 },
    ],
    busRate: 5,
    flightRate: 5,
    pricesIncludeTax: false,
  },
  commission: { defaultRate: 15 },
  social: { facebook: '', instagram: '', twitter: '', youtube: '', linkedin: '' },
  seo: {
    siteName: 'LexaTrip',
    defaultTitle: 'LexaTrip — Hotels, Resorts, Bus & Flight Booking',
    defaultDescription: 'Book hotels, villas, resorts, buses and flights across India with LexaTrip. Best prices, instant confirmation.',
    titleSuffix: ' | LexaTrip',
    gscVerification: '', // google-site-verification meta content
    bingVerification: '',
    robotsExtra: '',
    defaultOgImage: '/lexatrip-logo-full.jpg',
    organizationLogo: '/lexatrip-logo-full.jpg',
    hotelCategoryTemplates: [
      { name: '5-Star Hotels', slug: '5-star-hotels', starRating: 5 },
      { name: '4-Star Hotels', slug: '4-star-hotels', starRating: 4 },
      { name: '3-Star Hotels', slug: '3-star-hotels', starRating: 3 },
      { name: 'Luxury Resorts', slug: 'luxury-resorts' },
    ],
  },
  integrations: {
    payment: { provider: 'mock', enabledMethods: ['card', 'upi', 'netbanking', 'wallet'] },
    sms: { provider: 'console' },
    email: { provider: 'smtp' },
    push: { provider: 'none' },
    maps: { provider: 'osm', apiKey: '' },
    ai: { provider: 'gemini', model: 'gemini-2.5-flash', assistantName: 'Lexa AI' },
    bus: { provider: 'mock', status: 'sandbox' },
    flight: { provider: 'mock', status: 'sandbox' },
    channelManager: { provider: 'mock', status: 'sandbox' },
  },
};
