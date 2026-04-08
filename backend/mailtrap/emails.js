import {
    VERIFICATION_EMAIL_TEMPLATE,
    WELCOME_EMAIL_TEMPLATE,
    PASSWORD_RESET_REQUEST_TEMPLATE,
    PASSWORD_RESET_SUCCESS_TEMPLATE,
    INVITE_EMAIL_TEMPLATE,
} from "./emailtemplate.js";
import { mailtrapClient, sender } from "./mailtrap.config.js";

export const sendVerificationEmail = async (email, verificationToken) => {
    const recipient = [{ email }];
    try {
        const response = await mailtrapClient.send({
            from: sender,
            to: recipient,
            subject: "Verify your email — CircleCore",
            html: VERIFICATION_EMAIL_TEMPLATE.replace("{verificationCode}", verificationToken),
            category: "Email Verification",
        });
        console.log("Verification email sent successfully", response);
    } catch (error) {
        console.log("Error sending verification email:", error);
        throw new Error(`Error sending verification email: ${error}`);
    }
};

export const sendWelcomeEmail = async (email, name) => {
    const recipient = [{ email }];
    try {
        const response = await mailtrapClient.send({
            from: sender,
            to: recipient,
            subject: "Welcome to CircleCore! ✨",
            html: WELCOME_EMAIL_TEMPLATE.replace("{userName}", name),
            category: "Welcome Email",
        });
        console.log("Welcome email sent successfully", response);
    } catch (error) {
        console.log("Error sending welcome email:", error);
    }
};

export const sendResetPasswordEmail = async (email, resetUrl) => {
    const recipient = [{ email }];
    try {
        const response = await mailtrapClient.send({
            from: sender,
            to: recipient,
            subject: "Reset your password — CircleCore",
            html: PASSWORD_RESET_REQUEST_TEMPLATE.replace("{resetURL}", resetUrl),
            category: "Password Reset",
        });
        console.log("Reset password email sent successfully", response);
    } catch (error) {
        console.log("Error sending reset password email:", error);
        throw new Error(`Error sending reset password email: ${error}`);
    }
};

export const sendResetSuccessEmail = async (email) => {
    const recipient = [{ email }];
    try {
        const response = await mailtrapClient.send({
            from: sender,
            to: recipient,
            subject: "Password reset successful — CircleCore",
            html: PASSWORD_RESET_SUCCESS_TEMPLATE,
            category: "Password Reset Success",
        });
        console.log("Password reset success email sent", response);
    } catch (error) {
        console.log("Error sending reset success email:", error);
        throw new Error(`Error sending reset success email: ${error}`);
    }
};

export const sendInviteEmail = async (email, communityName, inviteCode) => {
    const recipient = [{ email }];
    try {
        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        const inviteLink = `${clientUrl}/invite-link?code=${encodeURIComponent(inviteCode)}`;
        const html = INVITE_EMAIL_TEMPLATE
            .replace(/{communityName}/g, communityName)
            .replace(/{inviteCode}/g, inviteCode)
            .replace(/{inviteLink}/g, inviteLink);

        const response = await mailtrapClient.send({
            from: sender,
            to: recipient,
            subject: `You're invited to join ${communityName} on CircleCore! 💌`,
            html,
            category: "Community Invite",
        });
        console.log("Invite email sent successfully", response);
    } catch (error) {
        console.log("Error sending invite email:", error);
        throw new Error(`Error sending invite email: ${error}`);
    }
};

export const sendNotificationDigestEmail = async ({ email, userName, notifications = [], frequency = "daily" }) => {
        const recipient = [{ email }];
        const title = frequency === "weekly" ? "Your weekly CircleCore digest" : "Your daily CircleCore digest";
        const intro = frequency === "weekly"
                ? "Here is what happened in your communities this week."
                : "Here is what happened in your communities today.";
        const items = notifications.slice(0, 20).map((n) => {
                const type = n.type || "update";
                const text = n.meta?.eventTitle
                        || n.meta?.commentSnippet
                        || n.meta?.postSnippet
                        || n.meta?.messageSnippet
                        || n.meta?.communityName
                        || "New activity";
                const when = new Date(n.createdAt).toLocaleString();
                return `<li style="margin:0 0 10px 0;"><b>${type.toUpperCase()}</b> — ${String(text)} <span style="color:#8a8d93">(${when})</span></li>`;
        }).join("");

        const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${title}</title></head>
<body style="margin:0; padding:0; font-family:'Inter','Segoe UI',Arial,sans-serif; background:#1e1f22;">
    <div style="max-width:620px; margin:28px auto; background:#2b2d31; border-radius:14px; overflow:hidden; border:1px solid #3b3e45;">
        <div style="padding:24px 26px; background:#5865F2; color:#fff;">
            <h1 style="margin:0; font-size:22px;">${title}</h1>
            <p style="margin:8px 0 0 0; opacity:0.9; font-size:14px;">${intro}</p>
        </div>
        <div style="padding:22px 26px; color:#d7d9de;">
            <p style="margin:0 0 14px 0;">Hi ${userName || "there"},</p>
            <p style="margin:0 0 16px 0;">You have <b style="color:#fff;">${notifications.length}</b> unread notifications.</p>
            <ul style="padding-left:18px; margin:0 0 16px 0; line-height:1.45;">${items || "<li>No new notifications.</li>"}</ul>
            <p style="margin:16px 0 0 0; color:#8a8d93; font-size:12px;">Manage digest and push preferences in your notification settings.</p>
        </div>
    </div>
</body>
</html>`;

        try {
                await mailtrapClient.send({
                        from: sender,
                        to: recipient,
                        subject: title,
                        html,
                        category: "Notification Digest",
                });
        } catch (error) {
                console.log("Error sending notification digest email:", error);
                throw new Error(`Error sending notification digest email: ${error}`);
        }
};
