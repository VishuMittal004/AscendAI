import os
import sys
import traceback
import requests as http_requests
from dotenv import load_dotenv

load_dotenv()

BREVO_API_KEY = os.getenv("BREVO_API_KEY")
EMAIL_FROM = os.getenv("EMAIL_FROM", "ascendaijiit@gmail.com")
FRONTEND_URL = os.getenv("FRONTEND_URL")


def send_verification_email(to_email: str, username: str, token: str) -> bool:
    """Send an email verification link via Brevo HTTP API."""

    verify_url = f"{FRONTEND_URL}/verify/{token}"

    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; background: #0a0a0f; color: #f1f1f4; padding: 40px; border-radius: 16px; border: 1px solid #25253a;">
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; background: linear-gradient(135deg, #6366f1, #7c3aed); width: 56px; height: 56px; border-radius: 14px; line-height: 56px; font-size: 22px; font-weight: bold; color: white;">A</div>
            <h1 style="margin: 16px 0 4px; font-size: 24px; font-weight: 700;">AscendAI</h1>
            <p style="color: #9191a8; margin: 0; font-size: 13px;">AI-Powered Goal Architect</p>
        </div>

        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Welcome, {username}!</h2>
        <p style="color: #9191a8; line-height: 1.6;">
            Thanks for signing up. Please verify your email address to activate your account and start building your learning roadmaps.
        </p>

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

    try:
        print("📨 Sending verification email via Brevo HTTP API...", flush=True)
        print(f"  From: {EMAIL_FROM}", flush=True)
        print(f"  To: {to_email}", flush=True)
        print(f"  API Key present: {bool(BREVO_API_KEY)}", flush=True)

        response = http_requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={
                "api-key": BREVO_API_KEY,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json={
                "sender": {"name": "AscendAI", "email": EMAIL_FROM},
                "to": [{"email": to_email, "name": username}],
                "subject": "Verify your AscendAI account",
                "htmlContent": html_body,
            },
            timeout=30,
        )

        print(f"  Brevo response status: {response.status_code}", flush=True)
        print(f"  Brevo response body: {response.text}", flush=True)

        if response.status_code in (200, 201):
            print(f"✅ Verification email sent to {to_email}", flush=True)
            return True
        else:
            print(f"❌ Brevo API returned {response.status_code}: {response.text}", flush=True)
            return False

    except Exception as e:
        print("❌ Email send failed", flush=True)
        print("Error:", e, flush=True)
        traceback.print_exc()
        sys.stdout.flush()
        sys.stderr.flush()
        print(f"Verification link (manual): {verify_url}", flush=True)
        return False
