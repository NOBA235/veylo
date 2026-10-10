# Veylo — Strategic Feature Requests & Future Roadmap

This document outlines high-impact feature requests and evolutionary milestones for extending Veylo as a production capability on Alexa+ and AWS.

---

## 1. Multimodal Camera Vision Input for Alexa+

### Summary
Enable users on Echo Show devices or the Alexa mobile app to hold up a broken part, unlabeled cable, or worn gasket and ask:
> *"Alexa, what is this thing, and where can I buy one nearby today?"*

### Implementation Path
- **Amazon Bedrock Multimodal Inference:** Stream camera frame snapshots to Bedrock Claude 3.5 Sonnet / Amazon Nova Pro vision endpoints.
- **Visual Attribute Extraction:** Detect connector geometry (e.g. USB-C vs Lightning vs Micro-USB, thread pitch, OD/ID diameters).
- **Tool Mapping:** Pass extracted visual attributes directly into `identify_product({ visualDescription, imageBytes })`.

---

## 2. Real-Time Retail Point-of-Sale (POS) Integration

### Summary
Upgrade inventory confidence from `LIKELY` to true `CONFIRMED` across thousands of independent hardware, electrical, and electronics retailers.

### Implementation Path
- **Direct POS Webhooks:** Connect with Square, Shopify POS, Lightspeed, and Clover inventory webhooks.
- **EDI 852 Feeds:** Ingest electronic data interchange feeds from major distributors.
- **Evidence Ledger:** Automatically verify stock quantity and shelf location with a 15-minute TTL.

---

## 3. Native Amazon Prime Same-Day Delivery Fallback

### Summary
When local discovery finds that no nearby store has the product in stock today, seamlessly offer 1-click Amazon Same-Day or Next-Day Prime delivery.

### Implementation Path
- **Amazon SP-API (Selling Partner API):** Query Amazon fulfillment centers for fast delivery options.
- **Voice Commerce Flow:**
  > *"No stores nearby have the USB-C adapter in stock today, but Amazon Prime can deliver one to your door by 5 PM. Would you like me to order it?"*
- **1-Click Checkout:** Execute order through Alexa Pay / Amazon Cart.

---

## 4. Autonomous Voice Calling Concierge

### Summary
For high-urgency items where inventory status is `UNKNOWN` or `LIKELY`, allow Alexa+ to offer:
> *"Fixture Electronics is 5 minutes away, but their shelf stock isn't confirmed. Would you like me to call them to check?"*

### Implementation Path
- **Conversational Telephony Agent:** Amazon Bedrock Agent connected to Amazon Connect or Twilio SIP.
- **Targeted Store Inquiry:** The agent dials the store, speaks with an associate: *"Hi, I'm calling for an Alexa customer checking if you currently have a USB-C to HDMI adapter on the shelf?"*
- **Evidence Update:** When the associate answers "Yes", the agent updates Veylo's evidence ledger to `CONFIRMED`, logs a user report signal, and notifies the customer on their Echo Show.

---

## 5. Physical Fastener & Thread Pitch Gauge Assistant

### Summary
A specialized capability for hardware, plumbing, and automotive fasteners where millimeter differences cause compatibility failures.

### Implementation Path
- Measure bolt thread pitch, metric vs imperial thread, pipe diameter (e.g. 1/2" NPT vs 3/4" GHT) using on-device augmented reality reference cards or phone camera.
- Map measured dimensions directly to `identify_product` constraints.
