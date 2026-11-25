# Flutter migration plan (guest app)

The web guest app was built "app-first" so the Flutter app is a re-skin over the **same API** — no backend changes needed.

## Screen map
| Web route | Flutter screen | Bottom tab |
|---|---|---|
| `/` Home (sections from `homeSections`) | HomeScreen | Home |
| `/search` | StayResultsScreen (+ FilterSheet) | Explore |
| `/stay/:slug` | PropertyScreen | — |
| `/checkout` → PaymentStep | CheckoutScreen → Razorpay Flutter SDK → `/me/payments/verify` | — |
| `/booking/:id` | BookingDetailScreen (voucher, cancel, review, help) | — |
| `/bus`, `/bus/:tripId` | BusSearch, BusSeatMap | — |
| `/flights`, `/flights/book` | FlightSearch, FlightPassengers | — |
| `/ai` | LexaAiScreen (chat + planner) | Lexa |
| `/account/trips` | TripsScreen | Trips |
| `/account/*` | Profile, Travellers, Saved, Notifications, Support | Profile |
| `/login` | OtpLoginScreen | — |

## Mapping notes
- **Theme**: build `ThemeData` from `/public/settings.theme` at startup (cache last value for offline start).
- **Feature flags**: hide tabs/screens exactly like the web (`features.*`).
- **Auth**: store the user JWT in `flutter_secure_storage`; send `Authorization` + `X-Client: app`.
- **Models**: generate Dart classes from the JSON responses (`json_serializable`); envelope `{success,data,meta,message}`.
- **Payments**: `razorpay_flutter` using `/me/payments/order` response (`keyId`, `orderId`, `amount`).
- **Push**: add FCM token endpoint (planned) and send from `notification.service.js#notify`.
- **Deep links**: `lexatrip.com/stay/:slug` and `/booking/:id` → app routes (Android App Links / iOS Universal Links).
- Suggested packages: `dio`, `go_router`, `flutter_riverpod`, `cached_network_image`, `google_fonts`, `intl`.
