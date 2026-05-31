# 💳 Stripe Payment Gateway Setup Guide
## Sales Bot USA - Subscription Payment Integration

---

## 📋 **Overview**

Your application already has **full Stripe integration** implemented! Here's what's included:

✅ **3 Subscription Tiers:**
- **Starter**: $19.99 - 50,000 LLM tokens
- **Growth**: $29.99 - 100,000 LLM tokens  
- **Pro**: $39.99 - 200,000 LLM tokens

✅ **Features Already Working:**
- Secure Stripe Checkout Sessions
- Webhook handling for payment confirmations
- Mock mode for testing (no real charges)
- Automatic plan activation after payment
- Email notifications for purchases
- Usage tracking and alerts at 80%

---

## 🚀 **Quick Setup (3 Steps)**

### **Step 1: Create Stripe Account**

1. Go to [stripe.com](https://stripe.com) and sign up
2. Complete business verification (can start with test mode)
3. Navigate to **Dashboard** → **Developers** → **API Keys**

---

### **Step 2: Get Your API Keys**

#### **A. Get Secret Key:**
1. In Stripe Dashboard → **Developers** → **API keys**
2. Copy your **Secret key** (starts with `sk_test_...` for test mode)
3. Update `.env` file:
   ```env
   STRIPE_SECRET_KEY=sk_test_51AbC123...your_actual_key
   ```

#### **B. Get Webhook Secret:**
1. Go to **Developers** → **Webhooks** → **Add endpoint**
2. Set endpoint URL:
   - **Local Testing**: `http://localhost:8000/payments/webhook`
   - **Production**: `https://your-domain.com/payments/webhook`
   - **LocalTunnel**: `https://salesbot-usa.loca.lt/payments/webhook`

3. Select events to listen to:
   - ✅ `checkout.session.completed`
   
4. Click **Add endpoint**
5. Click on your new endpoint → **Signing secret** → **Reveal**
6. Copy the webhook secret (starts with `whsec_...`)
7. Update `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_abc123...your_actual_secret
   ```

---

### **Step 3: Update Frontend URL**

Update the redirect URL in `.env` (must match your frontend):

```env
FRONTEND_URL=http://localhost:8080
```

For production:
```env
FRONTEND_URL=https://your-production-domain.com
```

---

## 🧪 **Testing the Payment Flow**

### **Option A: Mock Mode (No Real Stripe - Already Working!)**

Your app automatically uses **mock mode** when Stripe keys are not configured:

1. Leave `STRIPE_SECRET_KEY` empty or commented out
2. Go to client dashboard → **Upgrade Plan**
3. Click any tier → You'll see a mock success without charging

**✅ Perfect for development testing!**

---

### **Option B: Stripe Test Mode (Real Stripe, Fake Cards)**

Once you add your **test mode** keys (starting with `sk_test_`):

1. Restart backend server:
   ```bash
   cd backend
   .\reception_labs\venv\Scripts\python.exe -m uvicorn reception_labs.main:app --host 0.0.0.0 --port 8000 --reload
   ```

2. Go to client dashboard → **Upgrade Plan**
3. Select a tier
4. Use Stripe test card numbers:
   - **Success**: `4242 4242 4242 4242`
   - **Decline**: `4000 0000 0000 0002`
   - **3D Secure**: `4000 0025 0000 3155`
   - **Expiry**: Any future date (e.g., `12/34`)
   - **CVC**: Any 3 digits (e.g., `123`)
   - **ZIP**: Any 5 digits (e.g., `12345`)

5. Complete checkout → You'll be redirected back with success
6. Check backend logs for plan activation confirmation

---

## 🔐 **Production Setup**

### **1. Switch to Live Mode**

In Stripe Dashboard → Toggle **Test mode** OFF (top right)

### **2. Get Live Keys**

1. Go to **Developers** → **API keys**
2. Copy your **live Secret key** (starts with `sk_live_...`)
3. Update `.env`:
   ```env
   STRIPE_SECRET_KEY=sk_live_your_actual_production_key
   ```

### **3. Update Webhook for Production**

1. Go to **Developers** → **Webhooks**
2. **Add endpoint** with your production URL
3. Select `checkout.session.completed` event
4. Copy the new webhook secret
5. Update `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret
   ```

### **4. Update Frontend URL**

```env
FRONTEND_URL=https://your-production-domain.com
```

---

## 📊 **How It Works**

### **Payment Flow:**

```
Client Dashboard
    ↓
Clicks "Upgrade Plan"
    ↓
POST /payments/create-checkout
    ↓
Redirects to Stripe Checkout
    ↓
Client enters card details
    ↓
Stripe processes payment
    ↓
Stripe sends webhook → POST /payments/webhook
    ↓
Backend activates plan
    ↓
Sends confirmation email
    ↓
Client redirected to dashboard (success)
```

---

## 🛠️ **Troubleshooting**

### **Issue: Webhook not receiving events**

**Solution:**
1. Check webhook URL is correct in Stripe Dashboard
2. Verify `checkout.session.completed` event is selected
3. For local testing, use **LocalTunnel** or **ngrok**:
   ```bash
   npx localtunnel --port 8000 --subdomain salesbot-usa
   ```
   Then use: `https://salesbot-usa.loca.lt/payments/webhook`

---

### **Issue: "Invalid signature" error**

**Solution:**
1. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
2. Make sure you copied the secret from the **correct webhook endpoint**
3. Restart backend server after updating `.env`

---

### **Issue: Payment succeeds but plan not activated**

**Solution:**
1. Check backend logs for webhook errors
2. Verify webhook endpoint is receiving events (Stripe Dashboard → Webhooks → Your endpoint → Recent events)
3. Test webhook manually using Stripe CLI:
   ```bash
   stripe trigger checkout.session.completed
   ```

---

## 📧 **Email Notifications**

After successful payment, customers automatically receive:
✅ **Plan Purchase Confirmation** email with:
- Tier name and token allocation
- Purchase date
- Company name

**Already configured** via your SMTP settings in `.env`!

---

## 💡 **Next Steps**

1. **Add Stripe keys** to `.env` (test mode first)
2. **Restart backend** server
3. **Test payment flow** with test card `4242 4242 4242 4242`
4. **Check backend logs** for confirmation
5. **Verify email** was sent
6. **Switch to live mode** when ready for production

---

## 📝 **Current Configuration**

Your `.env` file has been updated with placeholders:

```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret_here
FRONTEND_URL=http://localhost:8080
```

**⚠️ Remember:** Replace these with your actual keys from Stripe Dashboard!

---

## 🔗 **Useful Links**

- [Stripe Dashboard](https://dashboard.stripe.com)
- [Stripe API Keys](https://dashboard.stripe.com/apikeys)
- [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
- [Stripe Test Cards](https://stripe.com/docs/testing)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)

---

## ✅ **What's Already Implemented**

✔️ Stripe checkout session creation  
✔️ Webhook signature verification  
✔️ Plan activation logic  
✔️ Usage tracking system  
✔️ Email notifications  
✔️ Mock mode for testing  
✔️ Replay protection  
✔️ HMAC token signing  
✔️ Frontend checkout UI  
✔️ Success/cancel redirect handling  

**You just need to add your Stripe keys and you're ready to accept payments!** 🚀
