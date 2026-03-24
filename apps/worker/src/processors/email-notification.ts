/**
 * Email notification worker — sends transactional emails via Resend.
 *
 * Job types handled:
 * - backing-confirmation          → Confirm a backer's order
 * - moq-reached-backer-emails     → Notify all backers MOQ was hit, production begins
 * - manufacturer-notification     → Alert manufacturer of production order
 * - campaign-expired-emails       → Notify backers of expiry + refund
 * - campaign-cancelled-refunds    → Notify backers of brand cancellation
 * - process-backing-refund        → Notify a single backer of refund
 * - dispute-alert                 → Immediately alert admin of Stripe chargeback
 * - final-payment-failed          → Notify backer their remaining payment failed
 */

import { Worker, type ConnectionOptions } from "bullmq";
import { Resend } from "resend";
import { redis } from "../lib/redis";
import { prisma } from "@loocbooc/database";

const resend = new Resend(process.env["RESEND_API_KEY"] ?? "");
const EMAIL_FROM = process.env["EMAIL_FROM"] ?? "noreply@loocbooc.com";

interface EmailJobData {
  type?: string;
  backingId?: string;
  campaignId?: string;
  userId?: string;
  manufacturerId?: string;
  reason?: string;
  // Dispute-specific fields
  disputeId?: string;
  chargeId?: string;
  amount?: number;
  currency?: string;
  evidenceDueBy?: number;
  backerEmail?: string;
  backerName?: string;
  campaignTitle?: string;
  // Final payment failed
  failureReason?: string;
}

export const emailNotificationWorker = new Worker(
  "email-notification",
  async (job) => {
    const data = job.data as EmailJobData;
    const jobName = job.name;
    job.log(`Processing email job: ${jobName}`);

    switch (jobName) {
      case "backing-confirmation":
        await sendBackingConfirmation(data.backingId ?? "");
        break;
      case "moq-reached-backer-emails":
        await sendMoqReachedEmails(data.campaignId ?? "");
        break;
      case "manufacturer-notification":
        await sendManufacturerNotification(data.campaignId ?? "", data.manufacturerId ?? "");
        break;
      case "campaign-expired-emails":
        await sendCampaignExpiredEmails(data.campaignId ?? "");
        break;
      case "campaign-cancelled-refunds":
        await sendCampaignCancelledEmails(data.campaignId ?? "");
        break;
      case "process-backing-refund":
        await sendBackingRefundEmail(data.backingId ?? "");
        break;
      case "sample-shipped":
        await sendSampleShippedEmails(data.campaignId ?? "");
        break;
      case "dispute-alert":
        await sendDisputeAlert(data);
        break;
      case "final-payment-failed":
        await sendFinalPaymentFailedEmail(data.backingId ?? "", data.failureReason);
        break;
      default:
        job.log(`Unhandled email job type: ${jobName}`);
    }

    return { sent: true, jobName };
  },
  {
    connection: redis as unknown as ConnectionOptions,
    concurrency: 3, // Don't hammer Resend
    limiter: {
      max: 50,
      duration: 1000, // Max 50 emails/second (well under Resend limits)
    },
  },
);

async function sendBackingConfirmation(backingId: string): Promise<void> {
  const backing = await prisma.backing.findUnique({
    where: { id: backingId },
    include: {
      campaign: { select: { title: true, estimatedShipDate: true, moq: true } },
      user: { select: { email: true, fullName: true } },
    },
  });
  if (!backing?.user.email) return;

  const shipDateStr = backing.campaign.estimatedShipDate
    ? new Date(backing.campaign.estimatedShipDate).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  await resend.emails.send({
    from: EMAIL_FROM,
    to: backing.user.email,
    subject: `Backing confirmed — ${backing.campaign.title} ✅`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 8px;">You're backing it ✅</h1>

        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Hi ${backing.user.fullName ?? "there"}, your backing for <strong>${backing.campaign.title}</strong> is confirmed.
        </p>

        <div style="background: #f5f5f5; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #666; font-size: 14px;">Campaign</td>
              <td style="padding: 6px 0; font-weight: 600; font-size: 14px; text-align: right;">${backing.campaign.title}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #666; font-size: 14px;">Size</td>
              <td style="padding: 6px 0; font-weight: 600; font-size: 14px; text-align: right;">${backing.size} × ${backing.quantity}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #666; font-size: 14px;">Amount paid</td>
              <td style="padding: 6px 0; font-weight: 600; font-size: 14px; text-align: right;">${backing.currency} ${(backing.depositCents / 100).toFixed(2)}</td>
            </tr>
            ${shipDateStr ? `
            <tr>
              <td style="padding: 6px 0; color: #666; font-size: 14px;">Est. ship date</td>
              <td style="padding: 6px 0; font-weight: 600; font-size: 14px; text-align: right;">${shipDateStr}</td>
            </tr>
            ` : ""}
          </table>
        </div>

        <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 16px;">
          We need <strong>${backing.campaign.moq} backers</strong> total to trigger production. We'll email you the moment the campaign hits its goal.
        </p>

        <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 32px;">
          If the campaign doesn't reach its goal, your payment will be fully refunded automatically.
          No action needed from you.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
        <p style="font-size: 12px; color: #999; margin: 0;">
          Loocbooc · You backed this campaign at loocbooc.com
        </p>
      </body>
      </html>
    `,
  });
}

async function sendMoqReachedEmails(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { title: true, moq: true, currentBackingCount: true, estimatedShipDate: true },
  });
  if (!campaign) return;

  const shipDateStr = campaign.estimatedShipDate
    ? new Date(campaign.estimatedShipDate).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  // Fetch all active backers with user relation
  const backings = await prisma.backing.findMany({
    where: { campaignId, status: "active" },
    include: { user: { select: { email: true, fullName: true } } },
  });

  // Send in batches to avoid rate limiting
  const batchSize = 10;
  for (let i = 0; i < backings.length; i += batchSize) {
    const batch = backings.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (backing) => {
        if (!backing.user.email) return;
        await resend.emails.send({
          from: EMAIL_FROM,
          to: backing.user.email,
          subject: `${campaign.title} hit its goal — production is happening 🎉`,
          html: `
            <!DOCTYPE html>
            <html>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
              <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 8px;">It's happening! 🎉</h1>

              <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                Hi ${backing.user.fullName ?? "there"},
              </p>

              <p style="font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
                <strong>${campaign.title}</strong> has reached its goal of ${campaign.moq.toLocaleString()} backers.
                Production is now underway.
              </p>

              <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 20px; margin: 24px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; color: #166534; font-size: 14px;">Your size</td>
                    <td style="padding: 6px 0; font-weight: 600; font-size: 14px; color: #166534; text-align: right;">${backing.size}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #166534; font-size: 14px;">Total backers</td>
                    <td style="padding: 6px 0; font-weight: 600; font-size: 14px; color: #166534; text-align: right;">${campaign.currentBackingCount.toLocaleString()}</td>
                  </tr>
                  ${shipDateStr ? `
                  <tr>
                    <td style="padding: 6px 0; color: #166534; font-size: 14px;">Est. ship date</td>
                    <td style="padding: 6px 0; font-weight: 600; font-size: 14px; color: #166534; text-align: right;">${shipDateStr}</td>
                  </tr>
                  ` : ""}
                </table>
              </div>

              <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 32px;">
                We'll keep you updated as production progresses. You'll hear from us when your order ships.
              </p>

              <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
              <p style="font-size: 12px; color: #999; margin: 0;">
                Loocbooc · You backed this campaign at loocbooc.com
              </p>
            </body>
            </html>
          `,
        });
      }),
    );
    // Small delay between batches
    if (i + batchSize < backings.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

async function sendManufacturerNotification(campaignId: string, manufacturerId: string): Promise<void> {
  const [campaign, manufacturer] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { title: true, currentBackingCount: true, moq: true },
    }),
    prisma.manufacturer.findUnique({
      where: { id: manufacturerId },
      include: { owner: { select: { email: true, fullName: true } } },
    }),
  ]);

  if (!campaign || !manufacturer?.owner.email) return;

  await resend.emails.send({
    from: EMAIL_FROM,
    to: manufacturer.owner.email,
    subject: `Production order: ${campaign.title}`,
    html: `
      <h1>New production order</h1>
      <p>Hi ${manufacturer.owner.fullName ?? manufacturer.name},</p>
      <p>A Back It campaign has reached its MOQ and is ready for production:</p>
      <p><strong>${campaign.title}</strong></p>
      <p>Units to produce: <strong>${campaign.currentBackingCount}</strong></p>
      <p>Please log in to the Loocbooc platform to confirm and begin production.</p>
    `,
  });

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { manufacturerNotifiedAt: new Date() },
  });
}

async function sendCampaignExpiredEmails(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { title: true, moq: true, currentBackingCount: true },
  });
  if (!campaign) return;

  const backings = await prisma.backing.findMany({
    where: { campaignId, status: "refunded" },
    include: { user: { select: { email: true, fullName: true } } },
  });

  await Promise.all(
    backings.map(async (backing) => {
      if (!backing.user.email) return;
      await resend.emails.send({
        from: EMAIL_FROM,
        to: backing.user.email,
        subject: `${campaign.title} didn't reach its goal — you've been refunded`,
        html: `
          <h1>Campaign expired</h1>
          <p>Hi ${backing.user.fullName ?? "there"},</p>
          <p>Unfortunately <strong>${campaign.title}</strong> didn't reach its minimum of ${campaign.moq} backers (reached ${campaign.currentBackingCount}).</p>
          <p>Your payment of ${(backing.depositCents / 100).toFixed(2)} ${backing.currency} has been refunded. Allow 5–10 business days.</p>
          <p>Keep an eye out — the brand may re-run this campaign.</p>
        `,
      });
    }),
  );
}

async function sendCampaignCancelledEmails(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { title: true },
  });
  if (!campaign) return;

  const backings = await prisma.backing.findMany({
    where: { campaignId, status: "active" },
    include: { user: { select: { email: true, fullName: true } } },
  });

  await Promise.all(
    backings.map(async (backing) => {
      if (!backing.user.email) return;
      await resend.emails.send({
        from: EMAIL_FROM,
        to: backing.user.email,
        subject: `${campaign.title} has been cancelled`,
        html: `
          <h1>Campaign cancelled</h1>
          <p>Hi ${backing.user.fullName ?? "there"},</p>
          <p>The brand has cancelled <strong>${campaign.title}</strong>.</p>
          <p>Your payment will be refunded within 5–10 business days.</p>
        `,
      });
    }),
  );
}

async function sendBackingRefundEmail(backingId: string): Promise<void> {
  const backing = await prisma.backing.findUnique({
    where: { id: backingId },
    include: {
      campaign: { select: { title: true } },
      user: { select: { email: true, fullName: true } },
    },
  });
  if (!backing?.user.email) return;

  await resend.emails.send({
    from: EMAIL_FROM,
    to: backing.user.email,
    subject: `Your backing for ${backing.campaign.title} has been refunded`,
    html: `
      <h1>Refund processed</h1>
      <p>Hi ${backing.user.fullName ?? "there"},</p>
      <p>Your backing for <strong>${backing.campaign.title}</strong> has been refunded.</p>
      <p>Amount: ${(backing.depositCents / 100).toFixed(2)} ${backing.currency}</p>
      <p>Please allow 5–10 business days for the refund to appear.</p>
    `,
  });
}

/**
 * Notify all active backers that their order has been shipped.
 * Called when the brand marks the campaign as shipped.
 * Batched 10 at a time to respect Resend rate limits.
 */
async function sendSampleShippedEmails(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { title: true, estimatedShipDate: true },
  });
  if (!campaign) return;

  // Only notify active backings (not already cancelled/refunded)
  const backings = await prisma.backing.findMany({
    where: { campaignId, status: "active" },
    include: { user: { select: { email: true, fullName: true } } },
  });

  const batchSize = 10;
  for (let i = 0; i < backings.length; i += batchSize) {
    const batch = backings.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (backing) => {
        if (!backing.user.email) return;

        const shipDateStr = campaign.estimatedShipDate
          ? new Date(campaign.estimatedShipDate).toLocaleDateString("en-AU", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "shortly";

        await resend.emails.send({
          from: EMAIL_FROM,
          to: backing.user.email,
          subject: `Your order is on its way — ${campaign.title} 📦`,
          html: `
            <!DOCTYPE html>
            <html>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
              <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 8px;">Your order has shipped 📦</h1>

              <p style="color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                Hi ${backing.user.fullName ?? "there"},
              </p>

              <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                Great news — your backing for <strong>${campaign.title}</strong> has been shipped.
              </p>

              <div style="background: #f5f5f5; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; color: #666; font-size: 14px;">Campaign</td>
                    <td style="padding: 6px 0; font-weight: 600; font-size: 14px; text-align: right;">${campaign.title}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #666; font-size: 14px;">Size ordered</td>
                    <td style="padding: 6px 0; font-weight: 600; font-size: 14px; text-align: right;">${backing.size}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #666; font-size: 14px;">Estimated delivery</td>
                    <td style="padding: 6px 0; font-weight: 600; font-size: 14px; text-align: right;">${shipDateStr}</td>
                  </tr>
                </table>
              </div>

              <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 32px;">
                Your order is on its way to the shipping address you provided.
                Keep an eye on your inbox for tracking information from your carrier.
              </p>

              <p style="font-size: 14px; color: #999; margin: 0;">
                Questions? Reply to this email and we'll sort it out.
              </p>

              <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
              <p style="font-size: 12px; color: #999; margin: 0;">
                Loocbooc · You backed this campaign at loocbooc.com
              </p>
            </body>
            </html>
          `,
        });
      }),
    );
    // Throttle between batches
    if (i + batchSize < backings.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

/**
 * Send an immediate dispute (chargeback) alert to the Loocbooc admin team.
 * Stripe gives 7 days to submit evidence. This email needs to land NOW.
 */
async function sendDisputeAlert(data: EmailJobData): Promise<void> {
  const adminEmail = process.env["ADMIN_ALERT_EMAIL"] ?? process.env["EMAIL_FROM"] ?? "support@loocbooc.com";

  if (!data.disputeId) return;

  const evidenceDueDate = data.evidenceDueBy
    ? new Date(data.evidenceDueBy * 1000).toLocaleDateString("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : "Unknown — check Stripe dashboard immediately";

  const disputeAmountStr = data.amount != null
    ? `${(data.amount / 100).toFixed(2)} ${(data.currency ?? "AUD").toUpperCase()}`
    : "Amount unknown";

  await resend.emails.send({
    from: EMAIL_FROM,
    to: adminEmail,
    subject: `🚨 CHARGEBACK: ${data.campaignTitle ?? "Unknown campaign"} — Evidence due ${evidenceDueDate}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 32px 24px;">

        <div style="background: #fef2f2; border: 2px solid #ef4444; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h1 style="font-size: 20px; font-weight: 700; color: #dc2626; margin: 0 0 8px;">🚨 Chargeback Filed</h1>
          <p style="margin: 0; font-size: 15px; color: #dc2626; font-weight: 600;">
            Evidence deadline: ${evidenceDueDate}
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666; font-size: 14px; width: 160px;">Dispute ID</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; font-family: monospace;">${data.disputeId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666; font-size: 14px;">Charge ID</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; font-family: monospace;">${data.chargeId ?? "Unknown"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666; font-size: 14px;">Backing ID</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; font-family: monospace;">${data.backingId ?? "Unknown"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666; font-size: 14px;">Campaign</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px;">${data.campaignTitle ?? "Unknown"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666; font-size: 14px;">Backer</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px;">${data.backerName ?? "Unknown"} &lt;${data.backerEmail ?? "unknown"}&gt;</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666; font-size: 14px;">Amount</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; font-weight: 600;">${disputeAmountStr}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px;">Reason</td>
            <td style="padding: 8px 0; font-size: 14px;">${data.reason ?? "Unknown"}</td>
          </tr>
        </table>

        <div style="background: #fefce8; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <h3 style="font-size: 14px; font-weight: 700; margin: 0 0 8px;">What to do RIGHT NOW</h3>
          <ol style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
            <li>Log in to <a href="https://dashboard.stripe.com/disputes" style="color: #0070f3;">Stripe Dashboard → Disputes</a></li>
            <li>Click the dispute for charge <strong>${data.chargeId ?? "listed above"}</strong></li>
            <li>Upload evidence: campaign confirmation email, backing record, terms of service, fulfilment timeline</li>
            <li>Submit before the deadline: <strong>${evidenceDueDate}</strong></li>
          </ol>
        </div>

        <p style="font-size: 12px; color: #999; margin: 0;">
          This alert was auto-generated by Loocbooc when Stripe fired a <code>charge.dispute.created</code> event.
          Dispute ID: ${data.disputeId}
        </p>
      </body>
      </html>
    `,
  });
}

/**
 * Notify a backer that their remaining payment (after MOQ, deposit model) has failed.
 * Gives them a clear path to update their payment method.
 */
async function sendFinalPaymentFailedEmail(backingId: string, failureReason?: string): Promise<void> {
  const backing = await prisma.backing.findUnique({
    where: { id: backingId },
    include: {
      campaign: { select: { title: true, slug: true } },
      user: { select: { email: true, fullName: true } },
    },
  });
  if (!backing?.user.email) return;

  const amountStr = `${(backing.remainingCents / 100).toFixed(2)} ${backing.currency}`;

  await resend.emails.send({
    from: EMAIL_FROM,
    to: backing.user.email,
    subject: `Action needed: payment for ${backing.campaign.title} failed`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 8px;">Payment update needed</h1>

        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Hi ${backing.user.fullName ?? "there"},
        </p>

        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Your final payment of <strong>${amountStr}</strong> for <strong>${backing.campaign.title}</strong>
          couldn't be processed.${failureReason ? ` Reason: ${failureReason}.` : ""}
        </p>

        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          You have <strong>7 days</strong> to update your payment method before your backing is cancelled.
          Your initial deposit will be refunded in full if the backing is cancelled.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${process.env["WEB_APP_URL"] ?? "https://loocbooc.com"}/back/${backing.campaign.slug}"
             style="background: #1a1a1a; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600;">
            Update Payment Method
          </a>
        </div>

        <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 32px;">
          If you have questions, reply to this email and we'll help you sort it out.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
        <p style="font-size: 12px; color: #999; margin: 0;">
          Loocbooc · Backing ID: ${backingId}
        </p>
      </body>
      </html>
    `,
  });
}

emailNotificationWorker.on("failed", (job, err) => {
  console.error(`[email-notification] Job ${job?.id} (${job?.name}) failed:`, err.message);
});
