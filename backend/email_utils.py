import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USER = os.getenv("EMAIL_USER", "")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def send_verification_email(to_email: str, username: str, token: str) -> bool:
    """Send an email verification link to the user."""
    if not EMAIL_USER or not EMAIL_PASSWORD:
        print("⚠️  Email not configured. Skipping email send.")
        print(f"   Verification link: {FRONTEND_URL}/verify/{token}")
        return False

    verify_url = f"{FRONTEND_URL}/verify/{token}"

    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; background: #0a0a0f; color: #f1f1f4; padding: 40px; border-radius: 16px; border: 1px solid #25253a;">
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; background: linear-gradient(135deg, #6366f1, #7c3aed); width: 56px; height: 56px; border-radius: 14px; line-height: 56px; font-size: 22px; font-weight: bold; color: white;">A</div>
            <h1 style="margin: 16px 0 4px; font-size: 24px; font-weight: 700;">AscendAI</h1>
            <p style="color: #9191a8; margin: 0; font-size: 13px;">AI-Powered Goal Architect</p>
        </div>

        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Welcome, {username}!</h2>
        <p style="color: #9191a8; line-height: 1.6;">Thanks for signing up. Please verify your email address to activate your account and start building your learning roadmaps.</p>

        <div style="text-align: center; margin: 32px 0;">
            <a href="{verify_url}"
               style="background: linear-gradient(135deg, #6366f1, #7c3aed); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; display: inline-block;">
               Verify Email Address
            </a>
        </div>

        <p style="color: #5a5a72; font-size: 12px; text-align: center; margin-top: 24px;">
            If you didn't create an AscendAI account, you can safely ignore this email.<br>
            This link expires in 24 hours.
        </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your AscendAI account"
    msg["From"] = f"AscendAI <{EMAIL_USER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(EMAIL_USER, EMAIL_PASSWORD)
            server.sendmail(EMAIL_USER, to_email, msg.as_string())
        print(f"✅ Verification email sent to {to_email}")
        return True
    except Exception as e:
        print(f"❌ Email send failed: {e}")
        print(f"   Verification link: {verify_url}")
        return False
