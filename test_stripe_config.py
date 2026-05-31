# Stripe Configuration Test Script
# Run this to verify your Stripe setup is working

import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

# Load environment variables
from dotenv import load_dotenv
env_path = backend_path / "reception_labs" / ".env"
load_dotenv(env_path, override=True)

print("=" * 70)
print("🔍 STRIPE PAYMENT GATEWAY CONFIGURATION CHECK")
print("=" * 70)
print()

# Check Stripe configuration
stripe_key = os.getenv("STRIPE_SECRET_KEY", "")
webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")

print("📋 Configuration Status:")
print("-" * 70)

# Stripe Secret Key
if not stripe_key or stripe_key == "sk_test_your_stripe_secret_key_here":
    print("❌ STRIPE_SECRET_KEY: Not configured (using mock mode)")
    print("   → Get from: https://dashboard.stripe.com/apikeys")
    mode = "MOCK"
elif stripe_key.startswith("sk_test_"):
    print(f"✅ STRIPE_SECRET_KEY: Configured (TEST MODE)")
    print(f"   → Key: {stripe_key[:15]}...{stripe_key[-4:]}")
    mode = "TEST"
elif stripe_key.startswith("sk_live_"):
    print(f"✅ STRIPE_SECRET_KEY: Configured (LIVE MODE)")
    print(f"   → Key: {stripe_key[:15]}...{stripe_key[-4:]}")
    mode = "LIVE"
else:
    print(f"⚠️  STRIPE_SECRET_KEY: Invalid format")
    print(f"   → Current: {stripe_key[:20]}...")
    mode = "INVALID"

print()

# Webhook Secret
if not webhook_secret or webhook_secret == "whsec_your_stripe_webhook_secret_here":
    if mode == "MOCK":
        print("⚠️  STRIPE_WEBHOOK_SECRET: Not needed (mock mode)")
    else:
        print("❌ STRIPE_WEBHOOK_SECRET: Not configured")
        print("   → Get from: https://dashboard.stripe.com/webhooks")
elif webhook_secret.startswith("whsec_"):
    print(f"✅ STRIPE_WEBHOOK_SECRET: Configured")
    print(f"   → Secret: {webhook_secret[:20]}...{webhook_secret[-4:]}")
else:
    print(f"⚠️  STRIPE_WEBHOOK_SECRET: Invalid format")
    print(f"   → Should start with 'whsec_'")

print()

# Frontend URL
print(f"✅ FRONTEND_URL: {frontend_url}")

print()
print("=" * 70)
print("💰 PAYMENT TIERS")
print("=" * 70)
print()
print("Tier       Price    Tokens     Description")
print("-" * 70)
print("Starter    $19.99   50,000     Small businesses")
print("Growth     $29.99   100,000    Growing companies")
print("Pro        $39.99   200,000    Large enterprises")
print()

print("=" * 70)
print("🔗 ENDPOINTS")
print("=" * 70)
print()
print(f"Backend:          http://localhost:8000")
print(f"Frontend:         {frontend_url}")
print(f"Create Checkout:  POST /payments/create-checkout")
print(f"Webhook:          POST /payments/webhook")
print(f"Confirm Payment:  POST /payments/confirm")
print()

print("=" * 70)
print("📝 SETUP STATUS")
print("=" * 70)
print()

if mode == "MOCK":
    print("🟡 MOCK MODE ACTIVE")
    print()
    print("   Your application is running in MOCK mode - no real payments.")
    print("   Clients can test the checkout flow without charges.")
    print()
    print("   To enable real payments:")
    print("   1. Get Stripe API keys from https://dashboard.stripe.com/apikeys")
    print("   2. Add them to backend/reception_labs/.env")
    print("   3. Restart the backend server")
    print()
elif mode == "TEST":
    print("🟢 TEST MODE ACTIVE")
    print()
    print("   Your Stripe integration is configured in TEST mode.")
    print("   You can process test payments safely.")
    print()
    print("   Test Card Numbers:")
    print("   ✅ Success:     4242 4242 4242 4242")
    print("   ❌ Decline:     4000 0000 0000 0002")
    print("   🔐 3D Secure:   4000 0025 0000 3155")
    print()
    if not webhook_secret or webhook_secret == "whsec_your_stripe_webhook_secret_here":
        print("   ⚠️  WARNING: Webhook secret not configured!")
        print("   → Payments will process but webhooks will fail")
        print("   → Add STRIPE_WEBHOOK_SECRET to .env")
    else:
        print("   ✅ Webhook secret configured - full flow ready!")
    print()
elif mode == "LIVE":
    print("🔴 LIVE MODE ACTIVE")
    print()
    print("   ⚠️  WARNING: Real payments will be charged!")
    print("   Make sure you've tested thoroughly in test mode first.")
    print()
    if not webhook_secret or webhook_secret == "whsec_your_stripe_webhook_secret_here":
        print("   ❌ CRITICAL: Webhook secret not configured!")
        print("   → Payments will charge but plans won't activate")
        print("   → Add production STRIPE_WEBHOOK_SECRET to .env")
    else:
        print("   ✅ Production configuration complete")
    print()
else:
    print("❌ INVALID CONFIGURATION")
    print()
    print("   Check your STRIPE_SECRET_KEY in .env file")
    print()

print("=" * 70)
print()
print("📖 For detailed setup instructions, see: STRIPE_SETUP.md")
print()
