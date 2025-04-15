import nodemailer from 'nodemailer';

async function sendEmail(to, subject, html) {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'johnametepeagboku@gmail.com',
            pass: 'uavb plyq ueyg qool'
        }
    });

    let mailOptions = {
        from: 'johnametepeagboku@gmail.com',
        to: to,
        subject: subject,
        text: 'Welcome to IT For Youth Ghana! Your account details: ' + to, // Add a plain text version
        html: html
    };
    

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
    } catch (error) {
        console.error('Error sending email: ' + error);
    }
}


// Function to generate welcome email content
function generateWelcomeEmail(
    email, 
    password, 
    role
  ) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to IT For Youth Ghana!</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap');
            body {
                font-family: 'Poppins', Arial, sans-serif;
                background-color: #F5E6D3; /* Warm sand color inspired by African earth tones */
                margin: 0;
                padding: 20px;
                line-height: 1.6;
            }
            .email-container {
                max-width: 600px;
                margin: auto;
                background: linear-gradient(135deg, #FFF4E0 0%, #F9E4CB 100%);
                border-radius: 15px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(90deg, #C2185B, #8E2DE2);
                color: white;
                text-align: center;
                padding: 20px;
            }
            .kente-border {
                background: repeating-linear-gradient(
                    45deg,
                    #FFD700, #FFD700 10px,
                    #008000 10px, #008000 20px,
                    #FF4500 20px, #FF4500 30px
                );
                height: 10px;
            }
            .content {
                padding: 30px;
                color: #2C3E50;
            }
            .details {
                background-color: rgba(255, 255, 255, 0.7);
                border-radius: 10px;
                padding: 20px;
                margin: 20px 0;
                border: 2px solid #C2185B;
            }
            .cta-button {
                display: inline-block;
                background-color: #8E2DE2;
                color: white !important;
                text-decoration: none;
                padding: 12px 25px;
                border-radius: 25px;
                margin: 15px 0;
                font-weight: 600;
            }
            .footer {
                text-align: center;
                padding: 15px;
                background-color: #F0F0F0;
                font-size: 12px;
                color: #666;
            }
            a {
                color: #8E2DE2;
                text-decoration: none;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="kente-border"></div>
            <div class="header">
                <h1 style="margin: 0;">🌍 IT For Youth Ghana 🇬🇭</h1>
            </div>
            
            <div class="content">
                <h2 style="color: #C2185B;">Welcome Aboard!</h2>
                
                <p>We're thrilled to have you join our vibrant community of tech innovators in Ghana! 🚀</p>
                
                <div class="details">
                    <h3>Your Account Details</h3>
                    <p><strong>📧 Email:</strong> ${email}</p>
                    <p><strong>🔐 Temporary Password:</strong> ${password}</p>
                    <p><strong>👥 Role:</strong> ${role}</p>
                </div>
                
                <p>Click the button below to log in and start your journey:</p>
                
                <a href="https://yourdomain.com/login" class="cta-button">Log In Now</a>
                
                <p>Please change your temporary password upon first login for security.</p>
            </div>
            
            <div class="footer">
                <p>Need help? Contact us at <a href="mailto:support@itforyouthghana.com">support@itforyouthghana.com</a></p>
                <p>© 2023 IT For Youth Ghana. Empowering the next generation of tech leaders! 💻</p>
            </div>
            
            <div class="kente-border"></div>
        </div>
    </body>
    </html>`;
  }

  export function generateTemporaryPasswordResetTemplate(
    email, 
    temporaryPassword,
  ) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Temporary Password - IT For Youth Ghana</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap');
            body {
                font-family: 'Poppins', Arial, sans-serif;
                background-color: #F5E6D3;
                margin: 0;
                padding: 20px;
                line-height: 1.6;
            }
            .email-container {
                max-width: 600px;
                margin: auto;
                background: linear-gradient(135deg, #FFF4E0 0%, #F9E4CB 100%);
                border-radius: 15px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(90deg, #FF4500, #C2185B);
                color: white;
                text-align: center;
                padding: 20px;
            }
            .kente-border {
                background: repeating-linear-gradient(
                    45deg,
                    #FFD700, #FFD700 10px,
                    #008000 10px, #008000 20px,
                    #FF4500 20px, #FF4500 30px
                );
                height: 10px;
            }
            .content {
                padding: 30px;
                color: #2C3E50;
            }
            .temp-password {
                background-color: rgba(0, 0, 0, 0.05);
                border: 2px dashed #FF4500;
                border-radius: 10px;
                padding: 15px;
                text-align: center;
                margin: 20px 0;
                font-size: 1.2em;
                letter-spacing: 2px;
            }
            .security-note {
                background-color: rgba(255, 99, 71, 0.1);
                border-left: 5px solid #FF4500;
                padding: 15px;
                margin: 20px 0;
                font-size: 0.9em;
            }
            .cta-button {
                display: inline-block;
                background-color: #C2185B;
                color: white !important;
                text-decoration: none;
                padding: 12px 25px;
                border-radius: 25px;
                margin: 15px 0;
                font-weight: 600;
            }
            .footer {
                text-align: center;
                padding: 15px;
                background-color: #F0F0F0;
                font-size: 12px;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="kente-border"></div>
            <div class="header">
                <h1 style="margin: 0;">🔐 Temporary Password Reset 🇬🇭</h1>
            </div>
            
            <div class="content">
                <h2 style="color: #C2185B;">Password Recovery</h2>
                
                <p>We've generated a temporary password for your account associated with ${email}.</p>
                
                <div class="temp-password">
                    <strong>🔑 Temporary Password:</strong> ${temporaryPassword}
                </div>
                
                <div class="security-note">
                    <strong>⚠️ Important Security Instructions:</strong>
                    <ul>
                        <li>Please change your password immediately after logging in.</li>
                        <li>Do not share this password with anyone.</li>
                    </ul>
                </div>
                
                <a href="https://yourdomain.com/login" class="cta-button">Log In Now</a>
                
                <p>If you did not request this password reset, please contact our support team immediately.</p>
            </div>
            
            <div class="footer">
                <p>Need help? Contact us at <a href="mailto:support@itforyouthghana.com">support@itforyouthghana.com</a></p>
                <p>© 2023 IT For Youth Ghana. Securing your digital journey! 🔒</p>
            </div>
            
            <div class="kente-border"></div>
        </div>
    </body>
    </html>`;
  }

  export function generatePasswordResetTemplate(
    email,password
  ) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - IT For Youth Ghana</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap');
            body {
                font-family: 'Poppins', Arial, sans-serif;
                background-color: #F5E6D3;
                margin: 0;
                padding: 20px;
                line-height: 1.6;
            }
            .email-container {
                max-width: 600px;
                margin: auto;
                background: linear-gradient(135deg, #FFF4E0 0%, #F9E4CB 100%);
                border-radius: 15px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(90deg, #FF4500, #C2185B);
                color: white;
                text-align: center;
                padding: 20px;
            }
            .kente-border {
                background: repeating-linear-gradient(
                    45deg,
                    #FFD700, #FFD700 10px,
                    #008000 10px, #008000 20px,
                    #FF4500 20px, #FF4500 30px
                );
                height: 10px;
            }
            .content {
                padding: 30px;
                color: #2C3E50;
            }
            .security-note {
                background-color: rgba(255, 99, 71, 0.1);
                border-left: 5px solid #FF4500;
                padding: 15px;
                margin: 20px 0;
                font-size: 0.9em;
            }
            .cta-button {
                display: inline-block;
                background-color: #C2185B;
                color: white !important;
                text-decoration: none;
                padding: 12px 25px;
                border-radius: 25px;
                margin: 15px 0;
                font-weight: 600;
            }
            .footer {
                text-align: center;
                padding: 15px;
                background-color: #F0F0F0;
                font-size: 12px;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="kente-border"></div>
            <div class="header">
                <h1 style="margin: 0;">🔐 Password Change Request</h1>
            </div>
            
            <div class="content">
                <h2 style="color: #C2185B;">Change Your Password</h2>
                
                <p>We received a request to change the password for the account associated with ${email}.</p>
                
                <div class="security-note">
                    <strong>⚠️ Security Alert:</strong> 
                    If you did not request this password change, please contact support immediately.
                </div>
                
                <p>Below is your new password:</p>
                
                <a href="itfy.com/login" class="cta-button">${password}</a>
                
                <p>Your New Password</p>
                <p style="word-break: break-all; font-size: 0.8em;">${password}</p>
            </div>
            
            <div class="footer">
                <p>Need help? Contact us at <a href="mailto:support@itforyouthghana.com">support@itforyouthghana.com</a></p>
                <p>© 2023 IT For Youth Ghana. Securing your digital journey! 🔒</p>
            </div>
            
            <div class="kente-border"></div>
        </div>
    </body>
    </html>`;
  }

export {generateWelcomeEmail}
export default sendEmail;
