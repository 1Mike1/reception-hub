"""
SMTP email service for transactional notifications.

Configured via environment variables:
    SMTP_HOST       (e.g. smtp.gmail.com)
    SMTP_PORT       (default 587)
    SMTP_USER       (email address used for authentication)
    SMTP_PASSWORD   (app password — for Gmail use App Passwords, not your real one)
    SMTP_FROM       (defaults to SMTP_USER)
    SMTP_USE_TLS    (default "true")

If SMTP_HOST is not set, all email sends are no-ops and the function returns
False — the app keeps working but won't send anything. This means you can
develop locally without any SMTP configuration.

All sends are dispatched on a background thread to avoid blocking request
handlers (FastAPI is async, smtplib is sync).
"""
from __future__ import annotations

import logging
import os
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


def _smtp_config() -> Optional[Dict[str, Any]]:
    host = os.getenv("SMTP_HOST", "").strip()
    if not host:
        return None
    return {
        "host": host,
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": os.getenv("SMTP_USER", "").strip(),
        "password": os.getenv("SMTP_PASSWORD", ""),
        "from_addr": os.getenv("SMTP_FROM", os.getenv("SMTP_USER", "")).strip(),
        "use_tls": os.getenv("SMTP_USE_TLS", "true").lower() == "true",
    }


def is_configured() -> bool:
    cfg = _smtp_config()
    return bool(cfg and cfg["host"] and cfg["from_addr"])


def _send_sync(to: List[str], subject: str, html: str, text: str) -> bool:
    cfg = _smtp_config()
    if not cfg or not cfg["from_addr"]:
        logger.info(f"[EMAIL] SMTP not configured — would send to {to}: {subject}")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = cfg["from_addr"]
        msg["To"] = ", ".join(to)
        msg.attach(MIMEText(text, "plain", "utf-8"))
        msg.attach(MIMEText(html, "html", "utf-8"))

        with smtplib.SMTP(cfg["host"], cfg["port"], timeout=15) as server:
            if cfg["use_tls"]:
                server.starttls()
            if cfg["user"]:
                server.login(cfg["user"], cfg["password"])
            server.send_message(msg)
        logger.info(f"[EMAIL] Sent '{subject}' to {to}")
        return True
    except Exception as e:
        logger.error(f"[EMAIL] Send failed to {to}: {e}")
        return False


def send_email(to: List[str], subject: str, html: str, text: str = "") -> None:
    """Fire-and-forget email send on a background thread."""
    if not text:
        # Crude HTML-to-text fallback
        import re
        text = re.sub(r"<[^>]+>", "", html).strip()
    threading.Thread(
        target=_send_sync, args=(to, subject, html, text), daemon=True
    ).start()


# ═════════════════════════════════════════════════════════════════════════════
# EMAIL TEMPLATES
# ═════════════════════════════════════════════════════════════════════════════

_BRAND = "2nd Wave AI"
_WRAPPER = """
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">{brand}</h1>
        </td></tr>
        <tr><td style="padding:32px;color:#1f2937;font-size:14px;line-height:1.6;">
          {content}
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 32px;color:#9ca3af;font-size:12px;text-align:center;border-top:1px solid #e5e7eb;">
          This is an automated message from {brand}.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
"""


def _wrap(content_html: str) -> str:
    return _WRAPPER.format(brand=_BRAND, content=content_html)


def _format_duration(secs: int) -> str:
    if secs < 60:
        return f"{secs}s"
    m, s = divmod(secs, 60)
    return f"{m}m {s}s"


def render_call_summary_email(
    company_name: str,
    conversation: Dict[str, Any],
    transcript: List[Dict[str, Any]],
) -> tuple[str, str, str]:
    """Build (subject, html, text) for a post-call summary email."""
    conv_id = conversation.get("conversation_id", "")
    started_at = conversation.get("start_time_unix_secs")
    duration = conversation.get("call_duration_secs", 0)
    summary = (
        conversation.get("transcript_summary")
        or conversation.get("call_summary_title")
        or "No summary was generated for this call."
    )
    when = (
        datetime.fromtimestamp(started_at).strftime("%b %d, %Y at %I:%M %p")
        if started_at else "Unknown time"
    )

    # Transcript HTML
    msgs_html = []
    for m in transcript[:200]:  # cap to avoid massive emails
        role = m.get("role", "")
        text = (m.get("message") or "").replace("<", "&lt;").replace(">", "&gt;")
        if not text:
            continue
        bg = "#eef2ff" if role == "agent" else "#f3f4f6"
        label_color = "#6366f1" if role == "agent" else "#6b7280"
        label = "Agent" if role == "agent" else "Caller"
        msgs_html.append(
            f'<div style="background:{bg};border-radius:8px;padding:10px 14px;margin:6px 0;">'
            f'<div style="color:{label_color};font-size:11px;font-weight:600;text-transform:uppercase;margin-bottom:4px;">{label}</div>'
            f'<div style="color:#1f2937;">{text}</div></div>'
        )
    transcript_html = "".join(msgs_html) or "<p style='color:#6b7280;'>No transcript available.</p>"

    content = f"""
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827;">New call received</h2>
      <p style="color:#6b7280;margin:0 0 24px;">A call to your AI receptionist has just finished.</p>

      <table cellpadding="0" cellspacing="0" style="width:100%;background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
        <tr><td style="padding:8px 0;color:#6b7280;font-size:12px;">When</td>
            <td style="padding:8px 0;color:#111827;font-weight:500;text-align:right;">{when}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;font-size:12px;">Duration</td>
            <td style="padding:8px 0;color:#111827;font-weight:500;text-align:right;">{_format_duration(duration)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;font-size:12px;">Conversation ID</td>
            <td style="padding:8px 0;color:#9ca3af;font-family:monospace;font-size:11px;text-align:right;">{conv_id}</td></tr>
      </table>

      <h3 style="font-size:14px;color:#111827;margin:0 0 8px;">Summary</h3>
      <p style="background:#fffbeb;border-left:3px solid #f59e0b;padding:12px 14px;margin:0 0 24px;color:#78350f;border-radius:4px;">{summary}</p>

      <h3 style="font-size:14px;color:#111827;margin:0 0 12px;">Transcript</h3>
      {transcript_html}
    """

    subject = f"New call · {company_name} · {_format_duration(duration)}"
    html = _wrap(content)
    text = (
        f"New call received\n"
        f"When: {when}\n"
        f"Duration: {_format_duration(duration)}\n"
        f"Conversation ID: {conv_id}\n\n"
        f"Summary:\n{summary}\n"
    )
    return subject, html, text


def render_plan_alert_email(company_name: str, usage_percent: float, total_tokens: int) -> tuple[str, str, str]:
    content = f"""
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827;">You're approaching your plan limit</h2>
      <p style="color:#374151;">Hi {company_name},</p>
      <p style="color:#374151;">Your AI receptionist has used <strong>{usage_percent}%</strong> of your {total_tokens:,}-token plan.</p>
      <p style="color:#374151;">To avoid service interruption, please upgrade your plan in your dashboard before tokens run out.</p>
      <div style="margin:24px 0;">
        <a href="{os.getenv('FRONTEND_URL', 'http://localhost:8080')}/dashboard"
           style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;">
          Open Dashboard
        </a>
      </div>
    """
    return (
        f"Usage alert · {usage_percent}% of plan used",
        _wrap(content),
        f"You have used {usage_percent}% of your {total_tokens:,}-token plan. Please upgrade in your dashboard.",
    )


def render_plan_purchased_email(company_name: str, tier_name: str, tokens: int) -> tuple[str, str, str]:
    content = f"""
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Welcome to {tier_name}!</h2>
      <p style="color:#374151;">Hi {company_name},</p>
      <p style="color:#374151;">Your <strong>{tier_name}</strong> plan has been activated.
         You now have <strong>{tokens:,} LLM tokens</strong> available for your AI receptionist.</p>
      <p style="color:#374151;">Your agent has been activated and is ready to take calls.</p>
      <div style="margin:24px 0;">
        <a href="{os.getenv('FRONTEND_URL', 'http://localhost:8080')}/dashboard"
           style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;">
          Go to Dashboard
        </a>
      </div>
    """
    return (
        f"Plan activated · {tier_name}",
        _wrap(content),
        f"Your {tier_name} plan is active. {tokens:,} tokens available.",
    )
