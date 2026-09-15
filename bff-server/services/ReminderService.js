/**
 * Reminder Service
 *
 * Periodically polls for coaching_schedule rows taking place tomorrow (JST)
 * and emails both the student and the coach a reminder, then marks the
 * schedule so it isn't sent twice.
 *
 * Batch/poll (like TranscriptSyncService) rather than a per-schedule timer:
 * coaching_schedule has no time-of-day column, only a date, so "the day
 * before" is the only precision available — a day-granularity reminder does
 * not need sub-day scheduling infrastructure.
 */

const { config } = require('../config/environment');
const moodleAdapter = require('../adapters/MoodleAdapter');
const apiServerAdapter = require('../adapters/ApiServerAdapter');
const mailerService = require('./MailerService');
const logger = require('../utils/logger');

class ReminderService {
  async sendPendingReminders() {
    const schedules = await apiServerAdapter.getPendingCoachingReminders();
    if (schedules.length === 0) {
      return;
    }
    logger.log(`[Reminder] Sending ${schedules.length} pending coaching reminder(s)`);

    for (const schedule of schedules) {
      try {
        await this._remindOne(schedule);
      } catch (err) {
        logger.error(
          `[Reminder] Failed to send reminder for schedule ${schedule.id}:`,
          err.response?.data || err.message
        );
      }
    }
  }

  async _remindOne(schedule) {
    const [coachUsers, studentUsers] = await Promise.all([
      moodleAdapter.getUsersByField('id', [schedule.coach_user_id]),
      moodleAdapter.getUsersByField('id', [schedule.mdl_user_id]),
    ]);
    const coach = coachUsers?.[0];
    const student = studentUsers?.[0];

    const dateLabel = this._formatDateJst(schedule.coaching_date);

    // Individual send failures are logged and swallowed rather than thrown —
    // one recipient's bad/missing address shouldn't stop the other from
    // getting their reminder, and shouldn't block marking this schedule as
    // handled (see class comment: no per-recipient retry, it's day-granularity).
    await Promise.all([
      this._sendTo(student, `明日 ${dateLabel} はコーチングセッションです`, schedule, false),
      this._sendTo(coach, `明日 ${dateLabel} はコーチングセッションです`, schedule, true),
    ]);

    await apiServerAdapter.markCoachingReminderSent(schedule.id);
    logger.log(`[Reminder] Sent reminder for schedule ${schedule.id}`);
  }

  async _sendTo(user, subject, schedule, isCoach) {
    if (!user?.email) {
      logger.warn(`[Reminder] No email on file for ${isCoach ? 'coach' : 'student'} (schedule ${schedule.id}), skipping`);
      return;
    }
    const dateLabel = this._formatDateJst(schedule.coaching_date);
    const greeting = user.fullname ? `${user.fullname} 様` : 'いつもご利用ありがとうございます。';
    const body = [
      greeting,
      '',
      `明日 ${dateLabel} にコーチングセッションの予定があります。`,
      schedule.meeting_url ? `ミーティングURL: ${schedule.meeting_url}` : '',
      '',
      `詳細は以下からご確認ください。`,
      isCoach
        ? `${config.frontendBaseUrl}/coach/schedule/${schedule.mdl_user_id}`
        : `${config.frontendBaseUrl}/coaching`,
    ].filter(line => line !== '').join('\n');

    try {
      await mailerService.sendEmail(user.email, subject, body);
    } catch (err) {
      logger.error(
        `[Reminder] Failed to email ${isCoach ? 'coach' : 'student'} ${user.email} (schedule ${schedule.id}):`,
        err.message
      );
    }
  }

  _formatDateJst(coachingDate) {
    // coaching_date arrives as "YYYY-MM-DD" (date, no time/timezone) — format
    // directly rather than via Date() to avoid any local-timezone shift.
    const [year, month, day] = coachingDate.split('-');
    return `${year}年${parseInt(month, 10)}月${parseInt(day, 10)}日`;
  }
}

module.exports = new ReminderService();
