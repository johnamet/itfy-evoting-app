#!/usr/bin/env node
/**
 * Email Service
 * 
 * Handles email sending functionality for voters and users including:
 * - Payment confirmations
 * - Vote confirmations
 * - Event notifications
 * - Admin notifications
 * - Template-based emails
 * - User registration and authentication emails
 */

import BaseService from './BaseService.js';
import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EmailService extends BaseService {
    constructor() {
        super();
        
        // Email configuration
        this.emailConfig = {
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: process.env.EMAIL_PORT || 587,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        };

        // Sender information
        this.fromEmail = process.env.FROM_EMAIL || process.env.EMAIL_USER;
        this.fromName = process.env.FROM_NAME || 'ITFY E-Voting System';
        this.supportEmail = process.env.SUPPORT_EMAIL || this.fromEmail;
        this.adminEmail = process.env.ADMIN_EMAIL || this.fromEmail;

        // App information
        this.appName = process.env.APP_NAME || 'ITFY E-Voting';
        this.appUrl = process.env.APP_URL || 'https://voting.itfy.com';
        this.logoUrl = process.env.LOGO_URL || `${this.appUrl}/assets/logo.png`;

        // Template paths
        this.templatesPath = path.join(path.dirname(__dirname), 'templates', 'emails');

        // Initialize transporter
        this.transporter = null;
        this._initializeTransporter();

        // Template cache
        this.templateCache = new Map();
        this.baseTemplate = null;

        // Email sending queue and rate limiting
        this.emailQueue = [];
        this.isProcessingQueue = false;
        this.rateLimitDelay = parseInt(process.env.EMAIL_RATE_LIMIT_MS) || 1000; // 1 second between emails
    }

    /**
     * Initialize nodemailer transporter
     */
    async _initializeTransporter() {
        try {
            if (!this.emailConfig.auth.user || !this.emailConfig.auth.pass) {
                console.warn('Email credentials not configured. Email service will be disabled.');
                return;
            }

            this.transporter = nodemailer.createTransporter(this.emailConfig);

            // Verify connection
            await this.transporter.verify();
            this._log('email_service', 'Email service initialized successfully');

            // Load base template
            await this._loadBaseTemplate();
        } catch (error) {
            this._log('email_init_error', error);
            console.error('Failed to initialize email service:', error.message);
        }
    }

    /**
     * Load base email template
     */
    async _loadBaseTemplate() {
        try {
            const baseTemplatePath = path.join(this.templatesPath, 'base.hbs');
            const templateContent = await fs.readFile(baseTemplatePath, 'utf8');
            this.baseTemplate = handlebars.compile(templateContent);
            this._log('email_template', 'Base email template loaded successfully');
        } catch (error) {
            this._log('template_load_error', error);
            console.error('Failed to load base email template:', error.message);
        }
    }

    /**
     * Load and compile email template
     */
    async _loadTemplate(templateName) {
        try {
            // Check cache first
            if (this.templateCache.has(templateName)) {
                return this.templateCache.get(templateName);
            }

            const templatePath = path.join(this.templatesPath, `${templateName}.hbs`);
            const templateContent = await fs.readFile(templatePath, 'utf8');
            const compiledTemplate = handlebars.compile(templateContent);
            
            // Cache the compiled template
            this.templateCache.set(templateName, compiledTemplate);
            
            return compiledTemplate;
        } catch (error) {
            this._log('template_load_error', error);
            throw new Error(`Failed to load email template: ${templateName}`);
        }
    }

    /**
     * Generate HTML email content using templates
     */
    async _generateEmailHTML(templateName, data) {
        try {
            const template = await this._loadTemplate(templateName);
            const content = template(data);

            // Use base template if available
            if (this.baseTemplate) {
                return this.baseTemplate({
                    content,
                    subject: data.subject,
                    appName: this.appName,
                    appUrl: this.appUrl,
                    logoUrl: this.logoUrl,
                    supportEmail: this.supportEmail,
                    currentYear: new Date().getFullYear(),
                    ...data
                });
            }

            return content;
        } catch (error) {
            this._log('email_generation_error', error);
            return `<p>Error generating email content: ${error.message}</p>`;
        }
    }

    /**
     * Send email using queue system
     */
    async _sendEmail(to, subject, html, attachments = []) {
        const emailData = {
            from: `${this.fromName} <${this.fromEmail}>`,
            to,
            subject,
            html,
            attachments
        };

        // Add to queue
        return new Promise((resolve, reject) => {
            this.emailQueue.push({
                emailData,
                resolve,
                reject,
                timestamp: Date.now()
            });

            // Start processing queue if not already running
            if (!this.isProcessingQueue) {
                this._processEmailQueue();
            }
        });
    }

    /**
     * Process email queue with rate limiting
     */
    async _processEmailQueue() {
        if (this.isProcessingQueue || this.emailQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.emailQueue.length > 0) {
            const { emailData, resolve, reject } = this.emailQueue.shift();

            try {
                if (!this.transporter) {
                    throw new Error('Email service not initialized');
                }

                const result = await this.transporter.sendMail(emailData);
                this._log('email_sent', `Email sent to ${emailData.to}: ${emailData.subject}`);
                resolve(result);
            } catch (error) {
                this._log('email_send_error', error);
                reject(error);
            }

            // Rate limiting - wait before sending next email
            if (this.emailQueue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
            }
        }

        this.isProcessingQueue = false;
    }

    /**
     * Send payment confirmation email to voter
     */
    async sendPaymentConfirmation(voterData, paymentData, eventData) {
        try {
            const templateData = {
                subject: 'Payment Confirmation - Voting Access Approved',
                voterName: voterData.name || voterData.fullName,
                paymentId: paymentData.id || paymentData._id,
                amount: paymentData.amount,
                currency: paymentData.currency || 'GHS',
                eventName: eventData.name || eventData.title,
                paymentDate: new Date(paymentData.createdAt).toLocaleString(),
                transactionReference: paymentData.reference || paymentData.transactionId,
                votingStartDate: new Date(eventData.votingStartDate).toLocaleString(),
                votingEndDate: new Date(eventData.votingEndDate).toLocaleString(),
                votingUrl: `${this.appUrl}/events/${eventData.id || eventData._id}/vote`
            };

            const html = await this._generateEmailHTML('payment-confirmation', templateData);
            
            return await this._sendEmail(
                voterData.email,
                templateData.subject,
                html
            );
        } catch (error) {
            this._log('payment_confirmation_error', error);
            throw error;
        }
    }

    /**
     * Send vote confirmation email to voter
     */
    async sendVoteConfirmation(voterData, voteData, eventData) {
        try {
            const templateData = {
                subject: 'Vote Confirmation - Your Voice Has Been Heard',
                voterName: voterData.name || voterData.fullName,
                voteId: voteData.id || voteData._id,
                eventName: eventData.name || eventData.title,
                categoriesCount: voteData.categories?.length || voteData.votes?.length || 1,
                voteDate: new Date(voteData.createdAt).toLocaleString(),
                verificationHash: voteData.hash || voteData.verificationHash,
                hasReceipt: !!voteData.receiptUrl,
                receiptUrl: voteData.receiptUrl
            };

            const html = await this._generateEmailHTML('vote-confirmation', templateData);
            
            return await this._sendEmail(
                voterData.email,
                templateData.subject,
                html
            );
        } catch (error) {
            this._log('vote_confirmation_error', error);
            throw error;
        }
    }

    /**
     * Send event notification email
     */
    async sendEventNotification(recipientData, eventData) {
        try {
            const templateData = {
                subject: `New Voting Event: ${eventData.name || eventData.title}`,
                recipientName: recipientData.name || recipientData.fullName,
                eventName: eventData.name || eventData.title,
                eventDescription: eventData.description,
                registrationStart: new Date(eventData.registrationStartDate).toLocaleString(),
                registrationEnd: new Date(eventData.registrationEndDate).toLocaleString(),
                votingStart: new Date(eventData.votingStartDate).toLocaleString(),
                votingEnd: new Date(eventData.votingEndDate).toLocaleString(),
                entryFee: eventData.entryFee || 0,
                currency: eventData.currency || 'GHS',
                categoriesCount: eventData.categories?.length || 0,
                paymentDeadline: new Date(eventData.paymentDeadline || eventData.registrationEndDate).toLocaleString(),
                registrationUrl: `${this.appUrl}/events/${eventData.id || eventData._id}/register`,
                eventDetails: eventData.details
            };

            const html = await this._generateEmailHTML('event-notification', templateData);
            
            return await this._sendEmail(
                recipientData.email,
                templateData.subject,
                html
            );
        } catch (error) {
            this._log('event_notification_error', error);
            throw error;
        }
    }

    /**
     * Send admin notification email
     */
    async sendAdminNotification(alertType, message, additionalData = {}) {
        try {
            const templateData = {
                subject: `Admin Alert: ${alertType}`,
                alertType,
                severity: additionalData.severity || 'Medium',
                timestamp: new Date().toLocaleString(),
                source: additionalData.source || 'System',
                message,
                affectedUser: additionalData.affectedUser,
                eventId: additionalData.eventId,
                additionalInfo: additionalData.additionalInfo,
                actionRequired: additionalData.actionRequired,
                adminUrl: `${this.appUrl}/admin`
            };

            const html = await this._generateEmailHTML('admin-notification', templateData);
            
            return await this._sendEmail(
                this.adminEmail,
                templateData.subject,
                html
            );
        } catch (error) {
            this._log('admin_notification_error', error);
            throw error;
        }
    }

    /**
     * Send welcome email to new user
     */
    async sendWelcomeEmail(userData) {
        try {
            const templateData = {
                subject: `Welcome to ${this.appName}!`,
                userName: userData.name || userData.fullName,
                userEmail: userData.email,
                accountType: userData.role || 'Voter',
                registrationDate: new Date(userData.createdAt).toLocaleString(),
                loginUrl: `${this.appUrl}/login`
            };

            const html = await this._generateEmailHTML('welcome', templateData);
            
            return await this._sendEmail(
                userData.email,
                templateData.subject,
                html
            );
        } catch (error) {
            this._log('welcome_email_error', error);
            throw error;
        }
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(userData, resetToken, expiresInMinutes = 30) {
        try {
            const templateData = {
                subject: 'Password Reset Request',
                userName: userData.name || userData.fullName,
                userEmail: userData.email,
                requestTime: new Date().toLocaleString(),
                ipAddress: userData.ipAddress || 'Unknown',
                expiresIn: expiresInMinutes,
                resetUrl: `${this.appUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(userData.email)}`
            };

            const html = await this._generateEmailHTML('password-reset', templateData);
            
            return await this._sendEmail(
                userData.email,
                templateData.subject,
                html
            );
        } catch (error) {
            this._log('password_reset_error', error);
            throw error;
        }
    }

    /**
     * Send bulk notifications to multiple recipients
     */
    async sendBulkNotifications(recipients, templateName, baseData) {
        const promises = recipients.map(recipient => {
            const templateData = { ...baseData, ...recipient };
            return this._generateEmailHTML(templateName, templateData).then(html => {
                return this._sendEmail(recipient.email, templateData.subject, html);
            });
        });

        try {
            const results = await Promise.allSettled(promises);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            this._log('bulk_email', `Bulk email results: ${successful} successful, ${failed} failed`);
            
            return { successful, failed, results };
        } catch (error) {
            this._log('bulk_email_error', error);
            throw error;
        }
    }

    /**
     * Send custom email with HTML content
     */
    async sendCustomEmail(to, subject, htmlContent, attachments = []) {
        try {
            return await this._sendEmail(to, subject, htmlContent, attachments);
        } catch (error) {
            this._log('custom_email_error', error);
            throw error;
        }
    }

    /**
     * Get email service status
     */
    getServiceStatus() {
        return {
            isInitialized: !!this.transporter,
            queueLength: this.emailQueue.length,
            isProcessingQueue: this.isProcessingQueue,
            templatesLoaded: this.templateCache.size,
            hasBaseTemplate: !!this.baseTemplate,
            rateLimitDelay: this.rateLimitDelay
        };
    }

    /**
     * Clear template cache (useful for development)
     */
    clearTemplateCache() {
        this.templateCache.clear();
        this.baseTemplate = null;
        this._log('email_service', 'Template cache cleared');
    }

    /**
     * Reload templates (useful for development)
     */
    async reloadTemplates() {
        this.clearTemplateCache();
        await this._loadBaseTemplate();
        this._log('email_service', 'Templates reloaded');
    }
}

export default EmailService;