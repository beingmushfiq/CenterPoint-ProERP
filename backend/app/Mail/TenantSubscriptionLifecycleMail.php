<?php

declare(strict_types=1);

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class TenantSubscriptionLifecycleMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly string $tenantName,
        public readonly string $eventType, // 'past_due' | 'suspended' | 'reactivated'
        public readonly ?string $gracePeriodEndsAt = null,
        public readonly string $planName = 'Standard Plan'
    ) {}

    public function envelope(): Envelope
    {
        $subject = match ($this->eventType) {
            'past_due' => sprintf('[Action Required] %s — Subscription Grace Period Started', $this->tenantName),
            'suspended' => sprintf('[Urgent] %s — Workspace Access Suspended', $this->tenantName),
            'reactivated' => sprintf('%s — Workspace Subscription Active', $this->tenantName),
            default => sprintf('%s — Subscription Notification', $this->tenantName),
        };

        return new Envelope(
            subject: $subject,
        );
    }

    public function content(): Content
    {
        $headline = match ($this->eventType) {
            'past_due' => 'Your subscription is past due',
            'suspended' => 'Your workspace has been suspended',
            'reactivated' => 'Your workspace is active and up to date',
            default => 'Subscription Update',
        };

        $badgeColor = match ($this->eventType) {
            'past_due' => '#f59e0b',
            'suspended' => '#ef4444',
            'reactivated' => '#10b981',
            default => '#3b82f6',
        };

        $messageBody = match ($this->eventType) {
            'past_due' => sprintf(
                'Your %s subscription has expired and entered a grace period%s. Please update your payment method or renew your plan to prevent operational suspension.',
                htmlspecialchars($this->planName),
                $this->gracePeriodEndsAt !== null ? ' ending on '.htmlspecialchars($this->gracePeriodEndsAt) : ''
            ),
            'suspended' => sprintf(
                'The grace period for your %s workspace has expired without payment confirmation. Access to your tenant ERP and storefront operations has been temporarily suspended.',
                htmlspecialchars($this->tenantName)
            ),
            'reactivated' => sprintf(
                'Payment has been confirmed and your %s subscription is fully active. All services and permissions have been restored.',
                htmlspecialchars($this->planName)
            ),
            default => 'There has been an update to your workspace subscription.',
        };

        $actionText = match ($this->eventType) {
            'past_due' => 'Renew Subscription Now',
            'suspended' => 'Reactivate Workspace',
            default => 'View Account',
        };

        $html = <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{$headline}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 32px 16px;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e4e4e7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <tr>
            <td style="background-color: #18181b; padding: 24px 32px; text-align: left;">
                <span style="color: #ffffff; font-size: 18px; font-weight: 700; letter-spacing: -0.02em;">DevCenterPoint ProERP</span>
            </td>
        </tr>
        <tr>
            <td style="padding: 32px;">
                <div style="display: inline-block; background-color: {$badgeColor}15; border: 1px solid {$badgeColor}40; border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; color: {$badgeColor}; margin-bottom: 16px; text-transform: uppercase;">
                    {$this->eventType}
                </div>
                <h1 style="color: #18181b; font-size: 20px; font-weight: 700; margin: 0 0 16px 0; letter-spacing: -0.01em;">
                    {$headline}
                </h1>
                <p style="color: #52525b; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                    Hello {$this->tenantName},
                </p>
                <p style="color: #52525b; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                    {$messageBody}
                </p>
                <div style="margin: 32px 0;">
                    <a href="/platform/plans" style="display: inline-block; background-color: #18181b; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">
                        {$actionText}
                    </a>
                </div>
                <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0 24px 0;">
                <p style="color: #a1a1aa; font-size: 12px; line-height: 1.5; margin: 0;">
                    This is an automated operational notification regarding your DevCenterPoint ProERP organization. If you need assistance, please contact your account representative.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
HTML;

        return new Content(
            htmlString: $html,
        );
    }
}
