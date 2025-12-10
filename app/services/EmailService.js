#!/usr/bin/env node
/**
 * Email Service
 * Handles email sending using Nodemailer with:
 * - SMTP configuration (Gmail, SendGrid, AWS SES)
 * - HTML email templates
 * - Email queue support (via Bull)
 * - Email verification, password reset, notifications
 * 
 * @module services/EmailService
 * @version 2.0.0
 */

import nodemailer from "nodemailer";
import path from "path";
import fs from "fs/promises";
import handlebars from "handlebars";
import config from "../config/ConfigManager.js";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EmailService {
    constructor() {
        this.transporter = null;
        this.from = config.get('email.from') || "ITFY E-Voting <noreply@itfy-evoting.com>";
        this.templatesDir = path.join(process.cwd(), "app", "templates", "emails");
        this.isReady = false;

        // Register Handlebars helpers
        this.registerHandlebarsHelpers();

        // Initialize transporter
        this.initialize();
    }

    /**
     * Register custom Handlebars helpers
     * @private
     */
    registerHandlebarsHelpers() {
        handlebars.registerHelper('eq', (a, b) => a === b);
        handlebars.registerHelper('ne', (a, b) => a !== b);
        handlebars.registerHelper('gt', (a, b) => a > b);
        handlebars.registerHelper('lt', (a, b) => a < b);
        handlebars.registerHelper('or', function() {
            return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
        });
        handlebars.registerHelper('and', function() {
            return Array.prototype.slice.call(arguments, 0, -1).every(Boolean);
        });
        handlebars.registerHelper('formatDate', (date) => {
            if (!date) return '';
            return new Date(date).toLocaleDateString();
        });
        handlebars.registerHelper('capitalize', (str) => {
            if (!str) return '';
            return str.charAt(0).toUpperCase() + str.slice(1);
        });
    }

    /**
     * Initialize email transporter
     * @private
     */
    async initialize() {
        try {
            const emailProvider = config.get('email.provider') || "gmail";

            console.log(`[EmailService] Initializing with provider: ${emailProvider}`);

            switch (emailProvider.toLowerCase()) {
                case "gmail":
                    this.transporter = this.createGmailTransporter();
                    break;
                case "sendgrid":
                    this.transporter = this.createSendGridTransporter();
                    break;
                case "ses":
                    this.transporter = this.createSESTransporter();
                    break;
                case "smtp":
                default:
                    this.transporter = this.createSMTPTransporter();
            }

            // Verify transporter configuration
            await this.transporter.verify();
            this.isReady = true;
            console.log("[EmailService] ✓ Email service initialized successfully");
        } catch (error) {
            console.error("[EmailService] Initialization failed:", error.message);
            this.isReady = false;

            // Fallback to console logging in development
            if (config.get('env') !== "production") {
                console.warn("[EmailService] Using console email preview in development");
                this.transporter = this.createTestTransporter();
            }
        }
    }

    // ========================================
    // TRANSPORTER CONFIGURATIONS
    // ========================================

    createGmailTransporter() {
        return nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: config.get('email.user'),
                pass: config.get('email.password'),
            },
        });
    }

    createSendGridTransporter() {
        return nodemailer.createTransport({
            host: "smtp.sendgrid.net",
            port: 587,
            secure: false,
            auth: {
                user: "apikey",
                pass: config.get('email.sendgridApiKey'),
            },
        });
    }

    createSESTransporter() {
        return nodemailer.createTransport({
            host: `email.${config.get('aws.sesRegion') || "us-east-1"}.amazonaws.com`,
            port: 587,
            secure: false,
            auth: {
                user: config.get('aws.accessKeyId'),
                pass: config.get('aws.secretAccessKey'),
            },
        });
    }

    createSMTPTransporter() {
        return nodemailer.createTransport({
            host: config.get('smtp.host'),
            port: parseInt(config.get('smtp.port'), 10) || 587,
            secure: config.get('smtp.secure') === "true",
            auth: {
                user: config.get('smtp.user'),
                pass: config.get('smtp.password'),
            },
        });
    }

    createTestTransporter() {
        return {
            sendMail: async (mailOptions) => {
                console.log("\n===== EMAIL PREVIEW =====");
                console.log("To:", mailOptions.to);
                console.log("Subject:", mailOptions.subject);
                console.log("Text:", mailOptions.text?.substring(0, 200));
                console.log("========================\n");
                return { messageId: "test-" + Date.now() };
            },
            verify: async () => true,
        };
    }

    // ========================================
    // CORE EMAIL SENDING
    // ========================================

    /**
     * Send email
     * @param {Object} options - { to, subject, text, html, attachments }
     * @returns {Promise<Object>}
     */
    async sendEmail(options) {
        try {
            if (!this.isReady && config.get('env') === "production") {
                throw new Error("Email service not ready");
            }

            const mailOptions = {
                from: options.from || this.from,
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
                attachments: options.attachments,
            };

            const info = await this.transporter.sendMail(mailOptions);

            console.log(`[EmailService] ✓ Email sent: ${info.messageId} to ${options.to}`);
            return {
                success: true,
                messageId: info.messageId,
                response: info.response,
            };
        } catch (error) {
            console.error("[EmailService] Email send failed:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Send email using template
     * @param {Object} options - { to, subject, template, context }
     * @returns {Promise<Object>}
     */
    async sendTemplateEmail(options) {
        try {
            const { to, subject, template, context } = options;

            // Load and compile template
            const html = await this.renderTemplate(template, context);
            const text = this.htmlToText(html);

            return await this.sendEmail({
                to,
                subject,
                html,
                text,
            });
        } catch (error) {
            console.error("[EmailService] Template email send failed:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    // ========================================
    // EMAIL TEMPLATES
    // ========================================

    /**
     * Load and render email template
     * @param {string} templateName - Template file name (without .hbs)
     * @param {Object} context - Template variables
     * @returns {Promise<string>} - Rendered HTML
     */
    async renderTemplate(templateName, context = {}) {
        try {
            const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);
            const templateSource = await fs.readFile(templatePath, "utf-8");
            const template = handlebars.compile(templateSource);

            // Add common context variables
            const fullContext = {
                ...context,
                appName: "ITFY E-Voting",
                appUrl: config.get('app.url') || "http://localhost:3000",
                currentYear: new Date().getFullYear(),
                supportEmail: config.get('app.supportEmail') || "support@itfy-evoting.com",
            };

            return template(fullContext);
        } catch (error) {
            console.error(`[EmailService] Template render failed for ${templateName}:`, error);
            return this.getFallbackTemplate(context);
        }
    }

    getFallbackTemplate(context) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>ITFY E-Voting</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2>ITFY E-Voting</h2>
                    <div style="margin: 20px 0;">
                        ${context.message || ""}
                    </div>
                    <hr style="border: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">
                        © ${new Date().getFullYear()} ITFY E-Voting. All rights reserved.
                    </p>
                </div>
            </body>
            </html>
        `;
    }

    htmlToText(html) {
        return html
            .replace(/<[^>]*>/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    // ========================================
    // PRE-BUILT EMAIL METHODS
    // ========================================

    async sendWelcomeEmail(data) {
        return await this.sendTemplateEmail({
            to: data.email,
            subject: "Welcome to ITFY E-Voting! 🎉",
            template: "welcome",
            context: {
                name: data.name,
                email: data.email,
                role: data.role,
                verificationUrl: data.verificationUrl,
            },
        });
    }

    async sendVerificationEmail(data) {
        return await this.sendTemplateEmail({
            to: data.email,
            subject: "Verify Your Email Address",
            template: "email-verification",
            context: {
                name: data.name,
                verificationUrl: data.verificationUrl,
            },
        });
    }

    async sendPasswordResetEmail(data) {
        return await this.sendTemplateEmail({
            to: data.email,
            subject: "Reset Your Password",
            template: "password-reset",
            context: {
                name: data.name,
                resetUrl: data.resetUrl,
            },
        });
    }

    async sendPasswordChangedEmail(data) {
        return await this.sendTemplateEmail({
            to: data.email,
            subject: "Your Password Has Been Changed",
            template: "password-changed",
            context: {
                name: data.name,
                changeDate: new Date().toLocaleString(),
            },
        });
    }

    async sendAccountLockedEmail(data) {
        return await this.sendTemplateEmail({
            to: data.email,
            subject: "Your Account Has Been Temporarily Locked",
            template: "account-locked",
            context: {
                name: data.name,
                duration: data.duration || "15",
            },
        });
    }

    async sendCandidateApprovedEmail(data) {
        return await this.sendTemplateEmail({
            to: data.email,
            subject: "Your Candidacy Has Been Approved! 🎉",
            template: "candidate-approved",
            context: {
                name: data.name,
                eventName: data.eventName,
                verificationUrl: data.verificationUrl,
                loginUrl: `${config.get('app.url')}/candidate/login`,
            },
        });
    }

    async sendCandidateRejectedEmail(data) {
        return await this.sendTemplateEmail({
            to: data.email,
            subject: "Candidacy Application Update",
            template: "candidate-rejected",
            context: {
                name: data.name,
                eventName: data.eventName,
                reason: data.reason || "Your application did not meet the requirements",
            },
        });
    }

    async sendVerificationReminderEmail(data) {
        return await this.sendTemplateEmail({
            to: data.email,
            subject: "Reminder: Verify Your Email Address",
            template: "verification-reminder",
            context: {
                name: data.name,
                verificationUrl: data.verificationUrl,
                daysRemaining: data.daysRemaining || 0,
            },
        });
    }

    async sendVoteCastConfirmationEmail(data) {
        return await this.sendTemplateEmail({
            to: data.email,
            subject: "Vote Cast Confirmation",
            template: "vote-confirmation",
            context: {
                name: data.name,
                eventName: data.eventName,
                candidateName: data.candidateName,
                timestamp: new Date().toLocaleString(),
            },
        });
    }

    async sendEventResultsEmail(data) {
        return await this.sendTemplateEmail({
            to: data.email,
            subject: `${data.eventName} - Results Available`,
            template: "event-results",
            context: {
                name: data.name,
                eventName: data.eventName,
                resultsUrl: data.resultsUrl,
            },
        });
    }

    // ========================================
    // BULK EMAIL SENDING
    // ========================================

    async sendBulkEmail(recipients, options) {
        try {
            const results = {
                sent: [],
                failed: [],
            };

            for (const recipient of recipients) {
                const result = await this.sendTemplateEmail({
                    to: recipient,
                    ...options,
                });

                if (result.success) {
                    results.sent.push(recipient);
                } else {
                    results.failed.push({ email: recipient, error: result.error });
                }

                // Add small delay to avoid rate limiting
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            console.log(`[EmailService] Bulk email sent: ${results.sent.length} success, ${results.failed.length} failed`);
            
            return {
                success: true,
                sent: results.sent.length,
                failed: results.failed.length,
                details: results,
            };
        } catch (error) {
            console.error("[EmailService] Bulk email failed:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    async verify() {
        try {
            await this.transporter.verify();
            return true;
        } catch (error) {
            console.error("[EmailService] Email verification failed:", error);
            return false;
        }
    }

    async healthCheck() {
        try {
            const isVerified = await this.verify();
            return {
                status: isVerified ? "healthy" : "unhealthy",
                provider: config.get('email.provider') || "smtp",
                isReady: this.isReady,
                from: this.from,
            };
        } catch (error) {
            return {
                status: "unhealthy",
                error: error.message,
            };
        }
    }

    async sendTestEmail(to) {
        return await this.sendEmail({
            to,
            subject: "Test Email from ITFY E-Voting",
            html: this.getFallbackTemplate({
                message: `
                    <h3>Test Email</h3>
                    <p>This is a test email from the ITFY E-Voting platform.</p>
                    <p>If you received this, the email service is working correctly! ✓</p>
                    <p>Time: ${new Date().toLocaleString()}</p>
                `,
            }),
        });
    }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
