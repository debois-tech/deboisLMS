interface CredentialsEmailInput {
  name: string;
  email: string;
  password: string;
  portalUrl: string;
  courseName?: string;
}

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Email bodies are assembled as strings, so anything from the database is escaped. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SUPPORT_EMAIL = 'support@deboistech.in';
const SUPPORT_PHONE = '+91 82638 30296';

export function credentialsEmail(
  { name, email, password, portalUrl, courseName }: CredentialsEmailInput,
): RenderedEmail {
  const firstName = name.trim().split(/\s+/)[0] || 'there';
  const course = (courseName ?? '').trim();

  const safe = {
    firstName: escapeHtml(firstName),
    email: escapeHtml(email),
    password: escapeHtml(password),
    portalUrl: escapeHtml(portalUrl),
    course: escapeHtml(course),
  };

  // The batch is not guaranteed — a student can hold a login before being put on
  // one. Both sentences read naturally rather than leaving a dangling "enrolled in".
  const introLine = course
    ? `You&#39;ve been enrolled in <strong>${safe.course}</strong> on the deboistech Learning Portal.`
    : 'Your deboistech Learning Portal account is ready.';

  const thirdStep = course
    ? `Open <strong>${safe.course}</strong> from your dashboard and begin with <strong>Module 1</strong>.`
    : 'Open your batch from your dashboard and begin with <strong>Module 1</strong>.';

  const html = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Your LMS login — deboistech</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<style>
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #f2f4f3; font-family: 'Manrope', Helvetica, Arial, sans-serif; }
  .btn-primary a { background-color: #409B51; }

  .fluid-img { display:block; width:100%; max-width:100%; height:auto; }
  .cred-value { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; }
  .header-logo { display:block; border:0; height:auto; width:160px; max-width:180px; }

  @media screen and (max-width: 600px) {
    .email-container { width: 100% !important; min-width:0 !important; }
    .fluid-img { width: 100% !important; height: auto !important; max-width:600px !important; }
    .stack-column { display: block !important; width: 100% !important; }
    .mobile-padding { padding-left: 16px !important; padding-right: 16px !important; padding-top:12px !important; padding-bottom:12px !important; }
    .heading { font-size: 22px !important; line-height: 30px !important; }
    .cred-value { font-size: 15px !important; }
    .cta-stack td { display:block !important; width:100% !important; }
    .cta-stack a { display:block !important; width:100% !important; box-sizing:border-box; text-align:center !important; padding:12px 18px !important; }
    .support-note { font-size:13px !important; padding:12px 18px !important; }
    .header-logo { width:140px !important; max-width:60%; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#f2f4f3;">

<!-- Preheader (hidden preview text) -->
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
  Your deboistech LMS account is ready. Sign in with the credentials provided in this email.
</div>

<center style="width:100%; background-color:#f2f4f3;">
<!--[if mso]>
<table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0">
<tr><td>
<![endif]-->

<table role="presentation" class="email-container" width="600" align="center" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; margin:0 auto; background-color:#ffffff;">

  <!-- Top brand strip -->
  <tr>
    <td style="background-color:#135f2e; height:6px; line-height:6px; font-size:1px;">&nbsp;</td>
  </tr>

  <!-- Header / Logo -->
  <tr>
    <td align="center" class="mobile-padding" style="padding:32px 10px 10px 10px;">
      <img src="https://res.cloudinary.com/uxbtmcpx/image/upload/v1786885876/deboistech_email_id.png" alt="deboistech" width="450" class="fluid-img" style="display:block; width:100%; max-width:450px; height:auto;">
    </td>
  </tr>

  <!-- Divider -->
  <tr>
    <td style="padding:0 30px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="border-top:1px solid #e6e9e7; font-size:1px; line-height:1px;">&nbsp;</td></tr>
      </table>
    </td>
  </tr>

  <!-- Eyebrow + heading -->
  <tr>
    <td align="center" class="mobile-padding" style="padding:36px 40px 6px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 14px auto;">
        <tr>
          <td style="width:6px; height:6px; background-color:#409B51; font-size:1px; line-height:1px;">&nbsp;</td>
          <td style="width:3px; font-size:1px; line-height:1px;">&nbsp;</td>
          <td style="width:6px; height:6px; background-color:#409B51; font-size:1px; line-height:1px;">&nbsp;</td>
          <td style="width:3px; font-size:1px; line-height:1px;">&nbsp;</td>
          <td style="width:6px; height:6px; background-color:#93CCA0; font-size:1px; line-height:1px;">&nbsp;</td>
          <td style="width:12px; font-size:1px; line-height:1px;">&nbsp;</td>
          <td style="font-family:'Manrope', Arial, sans-serif; font-size:13px; letter-spacing:2px; text-transform:uppercase; color:#15602F; font-weight:700; white-space:nowrap;">
            Account&nbsp;Ready
          </td>
          <td style="width:12px; font-size:1px; line-height:1px;">&nbsp;</td>
          <td style="width:6px; height:6px; background-color:#93CCA0; font-size:1px; line-height:1px;">&nbsp;</td>
          <td style="width:3px; font-size:1px; line-height:1px;">&nbsp;</td>
          <td style="width:6px; height:6px; background-color:#409B51; font-size:1px; line-height:1px;">&nbsp;</td>
          <td style="width:3px; font-size:1px; line-height:1px;">&nbsp;</td>
          <td style="width:6px; height:6px; background-color:#409B51; font-size:1px; line-height:1px;">&nbsp;</td>
        </tr>
      </table>
      <h1 class="heading" style="margin:0; font-family:'Manrope', Arial, sans-serif; font-size:26px; line-height:34px; color:#111111; font-weight:700;">
        Welcome aboard, ${safe.firstName} &#128075;
      </h1>
    </td>
  </tr>

  <tr>
    <td align="center" class="mobile-padding" style="padding:12px 50px 28px 50px;">
      <p style="margin:0; font-family:'Manrope', Arial, sans-serif; font-size:15px; line-height:24px; color:#4a4a4a;">
        ${introLine}
        Your login details are below &mdash; sign in using the credentials and your dashboard opens up with all
        modules, assignments and session recordings.
      </p>
    </td>
  </tr>

  <!-- Credentials showcase -->
  <tr>
    <td align="center" style="padding:0 30px 30px 30px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EAF4EC; border-radius:22px;">
        <tr>
          <td align="center" style="padding:14px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:16px; box-shadow:0 12px 28px rgba(21,96,47,0.14);">
              <tr>
                <td class="mobile-padding" style="padding:34px 34px 30px 34px;">

                  <p style="margin:0 0 6px 0; font-family:'Manrope', Arial, sans-serif; font-size:11px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; color:#7d8f84;">Portal</p>
                  <p class="cred-value" style="margin:0 0 22px 0; font-size:16px; line-height:24px; color:#111111; word-break:break-all;">
                    <a href="${safe.portalUrl}" style="color:#15602F; text-decoration:none;">lms.deboistech.in</a>
                  </p>

                  <p style="margin:0 0 6px 0; font-family:'Manrope', Arial, sans-serif; font-size:11px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; color:#7d8f84;">Username</p>
                  <p class="cred-value" style="margin:0 0 22px 0; font-size:16px; line-height:24px; color:#111111; word-break:break-all;">${safe.email}</p>

                  <p style="margin:0 0 6px 0; font-family:'Manrope', Arial, sans-serif; font-size:11px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; color:#7d8f84;">Password</p>
                  <p class="cred-value" style="margin:0; font-size:16px; line-height:24px; color:#111111; word-break:break-all;">${safe.password}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td align="center" style="padding:0 30px 8px 30px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="cta-stack">
        <tr>
          <td class="btn-primary" style="border-radius:6px;">
            <a href="${safe.portalUrl}" target="_blank" style="display:inline-block; padding:13px 32px; font-family:'Manrope', Arial, sans-serif; font-size:14px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:6px; background-color:#409B51;">
              Sign in to LMS
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Support note under CTA -->
  <tr>
    <td align="center" style="padding:0 30px 18px 30px;">
      <p class="support-note" style="margin:0; font-family:'Manrope', Arial, sans-serif; font-size:13px; line-height:20px; color:#7d8f84;">
        <strong>Use the credentials provided above to sign in to your LMS account. For your security, please do not share your login credentials with anyone.</strong>
      </p>
    </td>
  </tr>

  <!-- Spacer -->
  <tr>
    <td style="padding:8px 30px 30px 30px; font-size:1px; line-height:1px;">&nbsp;</td>
  </tr>

  <!-- Divider -->
  <tr>
    <td style="padding:0 30px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="border-top:1px solid #e6e9e7; font-size:1px; line-height:1px;">&nbsp;</td></tr>
      </table>
    </td>
  </tr>

  <!-- First steps -->
  <tr>
    <td class="mobile-padding" style="padding:28px 50px 8px 50px;">
      <p style="margin:0 0 16px 0; font-family:'Manrope', Arial, sans-serif; font-size:14px; font-weight:700; color:#111111;">
        First steps
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="26" valign="top" style="font-family:'Manrope', Arial, sans-serif; font-size:13px; font-weight:800; color:#93CCA0; padding-bottom:12px;">1</td>
          <td valign="top" style="font-family:'Manrope', Arial, sans-serif; font-size:14px; line-height:22px; color:#4a4a4a; padding-bottom:12px;"><strong>Click &ldquo;Sign in to LMS&rdquo;</strong> and log in using the username and password provided above.</td>
        </tr>
        <tr>
          <td width="26" valign="top" style="font-family:'Manrope', Arial, sans-serif; font-size:13px; font-weight:800; color:#93CCA0; padding-bottom:12px;">2</td>
          <td valign="top" style="font-family:'Manrope', Arial, sans-serif; font-size:14px; line-height:22px; color:#4a4a4a; padding-bottom:12px;">Once signed in, review your dashboard and confirm that your profile and enrollment details are correct.</td>
        </tr>
        <tr>
          <td width="26" valign="top" style="font-family:'Manrope', Arial, sans-serif; font-size:13px; font-weight:800; color:#93CCA0;">3</td>
          <td valign="top" style="font-family:'Manrope', Arial, sans-serif; font-size:14px; line-height:22px; color:#4a4a4a;">${thirdStep}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Support / Help -->
  <tr>
    <td class="mobile-padding" style="padding:22px 50px 0 50px;">
      <p style="margin:12px 0 0 0; font-family:'Manrope', Arial, sans-serif; font-size:14px; line-height:21px; color:#111111; font-weight:700;">Need help?</p>
      <p style="margin:6px 0 0 0; font-family:'Manrope', Arial, sans-serif; font-size:13px; line-height:21px; color:#7d8f84;">
        If you have any difficulty accessing your LMS account or course, contact <strong><a href="mailto:${SUPPORT_EMAIL}" style="color:#15602F; font-weight:600; text-decoration:none;">${SUPPORT_EMAIL}</a></strong> or call <strong>${SUPPORT_PHONE}</strong>.
      </p>
    </td>
  </tr>

  <!-- Signature -->
  <tr>
    <td class="mobile-padding" style="padding:26px 50px 36px 50px;">
      <p style="margin:0; font-family:'Manrope', Arial, sans-serif; font-size:14px; line-height:22px; color:#4a4a4a;">
        Warm regards,<br>
        <strong style="color:#008037;">Team deboistech</strong>
      </p>
    </td>
  </tr>

  <!-- ===== Compliance footer ===== -->

  <tr>
    <td style="padding:0 30px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="border-top:1px solid #e6e9e7; font-size:1px; line-height:1px;">&nbsp;</td></tr>
      </table>
    </td>
  </tr>

  <!-- Follow us -->
  <tr>
    <td align="center" style="padding:22px 30px 20px 30px;">
      <p style="margin:0 0 12px 0; font-family:'Manrope', Arial, sans-serif; font-size:13px; color:#4a4a4a;">
        Follow us on
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr>
          <td style="padding:0 6px;">
            <a href="https://www.linkedin.com/company/deboistech" target="_blank">
              <img src="https://res.cloudinary.com/uxbtmcpx/image/upload/v1786610393/9.png" alt="LinkedIn" width="28" height="28" style="display:block; width:28px; height:28px;">
            </a>
          </td>
          <td style="padding:0 6px;">
            <a href="https://www.instagram.com/deboistech.in" target="_blank">
              <img src="https://res.cloudinary.com/uxbtmcpx/image/upload/v1786610393/6.png" alt="Instagram" width="28" height="28" style="display:block; width:28px; height:28px;">
            </a>
          </td>
          <td style="padding:0 6px;">
            <a href="https://www.facebook.com/profile.php?id=61592931560315" target="_blank">
              <img src="https://res.cloudinary.com/uxbtmcpx/image/upload/v1786610392/8.png" alt="Facebook" width="28" height="28" style="display:block; width:28px; height:28px;">
            </a>
          </td>
          <td style="padding:0 6px;">
            <a href="https://www.x.com/deboistech" target="_blank">
              <img src="https://res.cloudinary.com/uxbtmcpx/image/upload/v1786610393/7.png" alt="X" width="28" height="28" style="display:block; width:28px; height:28px;">
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Legal -->
  <tr>
    <td align="center" class="mobile-padding" style="border-top:1px solid #e6e9e7; padding:20px 40px 32px 40px;">
      <p style="margin:0 0 8px 0; font-family:'Manrope', Arial, sans-serif; font-size:13px; line-height:22px; color:#333333;">
        Copyright 2026 deboistech, All Rights Reserved.
      </p>
      <p style="margin:0 0 10px 0; font-family:'Manrope', Arial, sans-serif; font-size:10px; line-height:15px; color:#6b6b6b;">
        deboistech, 3rd Floor, Roongta Mall, Cidco, Nashik, Maharashtra - 422010
      </p>
      <p style="margin:0 0 18px 0; font-family:'Manrope', Arial, sans-serif; font-size:13px; line-height:15px; color:#4a4a4a;">
        <a href="https://www.deboistech.in/lib/pages/privacypolicy.html" style="color:#008037; font-weight:700; text-decoration:underline;">Privacy Policy</a>
        &nbsp;|&nbsp;
        <a href="mailto:hello@deboistech.in" style="color:#008037; font-weight:700; text-decoration:underline;">Contact Us</a>
      </p>
      <img src="https://res.cloudinary.com/uxbtmcpx/image/upload/v1786611065/deboistech_assets.png" alt="deboistech" width="130" style="display:block; margin:0 auto; width:130px; height:auto;">
    </td>
  </tr>

</table>

<!--[if mso]>
</td></tr>
</table>
<![endif]-->
</center>
</body>
</html>`;

  // Sent alongside the HTML. Without a text part some filters score the message
  // as spam, and a plain-text client shows the reader nothing at all.
  const text = [
    `Welcome aboard, ${firstName}`,
    '',
    course
      ? `You've been successfully enrolled in the Technology Excellence Program 2026 - ${course} on the deboistech Learning Portal.`
      : 'Your deboistech Learning Portal account is ready.',
    '',
    `Portal:   ${portalUrl}`,
    `Username: ${email}`,
    `Password: ${password}`,
    '',
    'Do not share your login credentials with anyone.',
    '',
    `Need help? ${SUPPORT_EMAIL} or ${SUPPORT_PHONE}`,
    '',
    'Warm regards,',
    'Team deboistech',
  ].join('\n');

  return { subject: 'Your deboistech LMS login', html, text };
}
