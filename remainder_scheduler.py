"""
EXPIRA - Reminder Scheduler
Background job that checks expiry dates and sends alerts.

Uses:
  - APScheduler for background task scheduling
  - SMTP (smtplib) for email notifications
  - Twilio SDK for SMS (optional)
  - Flask-Mail as alternative email backend
"""

import logging
import smtplib
import os
from datetime import datetime, date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

# ─── EMAIL CONFIGURATION ─────────────────────────────────────────────────────

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER", "your-email@gmail.com")
SMTP_PASS = os.getenv("SMTP_PASS", "your-app-password")
FROM_NAME = "EXPIRA Smart Tracker"


def get_status_color(days_left: int) -> str:
    if days_left < 0:
        return "#ef4444"   # Red - expired
    elif days_left <= 7:
        return "#f97316"   # Orange - critical
    elif days_left <= 30:
        return "#eab308"   # Yellow - warning
    return "#22c55e"       # Green - safe


def build_email_html(user_name: str, items: List[dict]) -> str:
    """Build a styled HTML email for expiry reminders."""
    rows = ""
    for item in items:
        days = item["days_left"]
        color = get_status_color(days)
        label = "EXPIRED" if days < 0 else f"{days} days left"
        rows += f"""
        <tr>
          <td style="padding:12px;border-bottom:1px solid #1e1b4b;">{item['name']}</td>
          <td style="padding:12px;border-bottom:1px solid #1e1b4b;text-transform:capitalize">{item['category'].replace('_',' ')}</td>
          <td style="padding:12px;border-bottom:1px solid #1e1b4b;">{item['expiry_date']}</td>
          <td style="padding:12px;border-bottom:1px solid #1e1b4b;color:{color};font-weight:700">{label}</td>
        </tr>"""

    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="background:#06040f;margin:0;padding:20px;font-family:'Helvetica Neue',Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;">
        <div style="text-align:center;padding:30px 0 20px;">
          <h1 style="font-family:monospace;font-size:28px;background:linear-gradient(90deg,#a78bfa,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:0;">⏱ EXPIRA</h1>
          <p style="color:#64748b;font-size:13px;margin:4px 0 0;">Smart Expiry Intelligence</p>
        </div>

        <div style="background:#0f0a1e;border-radius:16px;border:1px solid #1e1b4b;padding:24px;margin-bottom:20px;">
          <h2 style="color:#e2e8f0;font-size:18px;margin:0 0 8px;">Hey {user_name} 👋</h2>
          <p style="color:#64748b;margin:0 0 20px;font-size:14px;">
            You have <strong style="color:#a78bfa">{len(items)} item(s)</strong> expiring soon. Here's your update:
          </p>

          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#1e1b4b;">
                <th style="padding:10px;text-align:left;color:#a78bfa;">Product</th>
                <th style="padding:10px;text-align:left;color:#a78bfa;">Category</th>
                <th style="padding:10px;text-align:left;color:#a78bfa;">Expiry</th>
                <th style="padding:10px;text-align:left;color:#a78bfa;">Status</th>
              </tr>
            </thead>
            <tbody style="color:#cbd5e1;">
              {rows}
            </tbody>
          </table>
        </div>

        <div style="text-align:center;color:#334155;font-size:12px;">
          You're receiving this because you enabled reminders in EXPIRA.<br>
          <a href="#" style="color:#4f46e5;">Manage notification settings</a>
        </div>
      </div>
    </body>
    </html>"""


def send_email_reminder(to_email: str, user_name: str, items: List[dict]):
    """Send HTML email reminder via SMTP."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"⏱ EXPIRA: {len(items)} item(s) expiring soon"
        msg["From"] = f"{FROM_NAME} <{SMTP_USER}>"
        msg["To"] = to_email

        html_body = build_email_html(user_name, items)
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, to_email, msg.as_string())

        logger.info(f"Email sent to {to_email} for {len(items)} expiring items")

    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")


def send_sms_reminder(phone: str, user_name: str, items: List[dict]):
    """
    Optional: Send SMS using Twilio.
    Requires: pip install twilio
    Set env vars: TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM
    """
    try:
        from twilio.rest import Client
        client = Client(os.getenv("TWILIO_SID"), os.getenv("TWILIO_TOKEN"))

        names = ", ".join(i["name"] for i in items[:3])
        if len(items) > 3:
            names += f" +{len(items)-3} more"

        body = f"⏱ EXPIRA Alert: {names} {'is' if len(items)==1 else 'are'} expiring soon. Check your dashboard!"
        client.messages.create(body=body, from_=os.getenv("TWILIO_FROM"), to=phone)
        logger.info(f"SMS sent to {phone}")

    except ImportError:
        logger.warning("Twilio not installed. Skipping SMS.")
    except Exception as e:
        logger.error(f"SMS failed to {phone}: {e}")


# ─── CORE REMINDER JOB ───────────────────────────────────────────────────────

def check_and_send_reminders(app):
    """
    Daily job:
      1. Query all products expiring in ≤30 days
      2. Group by user
      3. Send email (and SMS if configured)
      4. Mark reminder_sent flags to avoid duplicates
    """
    from database import db, User, Product

    with app.app_context():
        today = date.today()
        users = User.query.all()

        for user in users:
            products = Product.query.filter_by(user_id=user.id).all()
            alert_items = []

            for p in products:
                days_left = (p.expiry_date - today).days

                # 7-day critical alert
                if 0 <= days_left <= 7 and not p.reminder_sent_7:
                    alert_items.append({**p.to_dict(), "days_left": days_left})
                    p.reminder_sent_7 = True

                # 30-day early warning
                elif 7 < days_left <= 30 and not p.reminder_sent_30:
                    alert_items.append({**p.to_dict(), "days_left": days_left})
                    p.reminder_sent_30 = True

            if alert_items:
                send_email_reminder(user.email, user.name, alert_items)
                logger.info(f"Reminders sent to {user.email}: {len(alert_items)} items")

        db.session.commit()
        logger.info(f"Reminder job complete at {datetime.utcnow().isoformat()}")


# ─── SCHEDULER SETUP ─────────────────────────────────────────────────────────

def start_scheduler(app):
    """Initialize and start the background scheduler."""
    scheduler = BackgroundScheduler(timezone="Asia/Kolkata")

    # Run daily at 8:00 AM IST
    scheduler.add_job(
        func=lambda: check_and_send_reminders(app),
        trigger=CronTrigger(hour=8, minute=0),
        id="daily_reminder",
        name="Daily Expiry Reminder",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Reminder scheduler started — runs daily at 08:00 IST")
    return scheduler


# Add this at the bottom of reminder_scheduler.py

def check_reminders_for_user(email: str, name: str, products: list) -> dict:
    """
    Called directly by ml_server.py
    products = list of dicts: [{name, expiry_date, category, days_left}, ...]
    """
    from datetime import date, datetime

    alert_items = []
    for p in products:
        days = p.get("days_left", 999)
        if days <= 30:
            alert_items.append(p)

    if alert_items:
        send_email_reminder(email, name, alert_items)
        return {"sent": True, "alert_count": len(alert_items)}

    return {"sent": False, "alert_count": 0}