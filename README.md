# Babysitting Services — Deployable Portal

## What this version includes
### Customer side
- Branded responsive website based on the supplied flyer
- $15/hour rate
- $100 deposit policy
- Deposit rolls into final payment
- Refund explanation for final totals under $100
- Cash, card, Cash App, Venmo and Zelle
- Ages 4+
- Friday–Tuesday / flexible hours
- Inland Empire & Orange County
- Booking request form
- Automatic hourly estimate

### Owner side
- Secure owner login
- Booking dashboard
- Confirm/cancel/complete booking status
- Track deposit status
- Track payment status
- Assign a sitter
- Create sitter accounts
- Enable/disable sitter accounts
- View authorized sitters

### Sitter side
- Secure login
- Sitter sees only bookings assigned to that sitter
- Customer details needed for the booking
- Schedule, address, child count/ages, payment/deposit status and notes

## Production setup

1. Create a Firebase project.
2. Enable Firebase Authentication → Email/Password.
3. Create Firestore.
4. Create a Firebase Web App and copy its config values.
5. Create a Firebase service account for the Node backend.
6. Set the environment variables from `.env.example`.
7. Set `ADMIN_EMAILS` to the owner's email address. This controls owner access on the backend.
8. Deploy to Render using the included `render.yaml`, or deploy to another Node host.
9. In Firebase Authentication, create the owner account using the owner email. The backend recognizes that email as the owner.
10. Open the deployed website, log in through Portal Login, and use Owner Portal → Sitters → Create a Sitter Login.

## Firebase Admin credentials
Never put a Firebase service-account JSON file in the public website or GitHub repository. Store it as a secret in the hosting provider. Render supports environment/secret configuration; the exact secure credential method should follow the host's current Firebase/Google credential guidance.

## Payment handling
This version records the customer's chosen payment method and lets the owner track payment/deposit status. It does NOT collect or store card numbers. For online card payments, connect a PCI-compliant processor such as Stripe rather than storing payment-card data yourself.

## Before public launch
Recommended next additions:
- Terms / privacy policy
- Cancellation and late-payment policy
- Owner-controlled business settings stored in Firestore
- Automated booking confirmation email/SMS
- Calendar integration
- Online deposit payment through a payment processor
- Optional customer account / booking history
