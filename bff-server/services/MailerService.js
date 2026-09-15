/**
 * Mailer Service
 *
 * Thin wrapper around SES SendEmail. Kept separate from callers (e.g.
 * ReminderService) so the SES call and its config (sender address, region)
 * have one place to look when an email doesn't arrive.
 *
 * NOTE: dev/UAT's SES account is still in sandbox mode as of 2026-09 — it can
 * only deliver to addresses that are themselves verified in SES, and is
 * capped at 200 emails/day (see memory/ses-sandbox-release.md). This will
 * throw for real student/coach addresses there until that's resolved; it
 * works as-is against prod's verified webcoach.jp identity.
 */

const { SendEmailCommand } = require('@aws-sdk/client-ses');
const { getSesClient } = require('../config/clients');
const { config } = require('../config/environment');
const logger = require('../utils/logger');

class MailerService {
  /**
   * @param {string} to
   * @param {string} subject
   * @param {string} bodyText Plain-text body (no HTML part — these are short
   *   transactional reminders, not marketing mail).
   */
  async sendEmail(to, subject, bodyText) {
    const command = new SendEmailCommand({
      Source: config.reminderSenderEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Text: { Data: bodyText, Charset: 'UTF-8' } },
      },
    });
    await getSesClient().send(command);
    logger.log(`[Mailer] Sent "${subject}" to ${to}`);
  }
}

module.exports = new MailerService();
