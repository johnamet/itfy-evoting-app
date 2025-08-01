#!/usr/bin/env node
/**
 * ITFY E-Voting Admin Console
 * 
 * A comprehensive bash-like console for managing the ITFY E-Voting application.
 * Provides admin access to all system operations through a command-line interface.
 * 
 * Usage: node admin-console.js
 */

import readline from 'readline';
import chalk from 'chalk';
import figlet from 'figlet';
import Config from './app/config/config.js';
import dbConnection from './app/utils/engine/db.js';
import dbInitializer from './app/utils/engine/dbInitializer.js';

// Import all services
import {
    AuthService,
    UserService,
    EventService,
    VotingService,
    CandidateService,
    CacheService,
    FileService,
    CategoryService,
    ActivityService,
    CouponService,
    FormService,
    SlideService,
    PaymentService,
    EmailService
} from './app/services/index.js';

// Import models for direct database operations
import { User, Event, Vote, Candidate, Payment, Role } from './app/models/index.js';

class AdminConsole {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.cyan('itfy-admin> ')
        });

        this.isAuthenticated = false;
        this.adminUser = null;
        this.services = {
            auth: new AuthService(),
            user: new UserService(),
            event: new EventService(),
            voting: new VotingService(),
            candidate: new CandidateService(),
            cache: new CacheService(),
            file: new FileService(),
            category: new CategoryService(),
            activity: new ActivityService(),
            coupon: new CouponService(),
            form: new FormService(),
            slide: new SlideService(),
            payment: new PaymentService(),
            email: new EmailService()
        };

        this.commands = this.initializeCommands();
        this.commandHistory = [];
    }

    async init() {
        try {
            // Initialize database connection
            await dbConnection.connect();
            await dbInitializer.init();

            // Create default roles if they don't exist
            await this.createDefaultRoles();

            this.showWelcomeBanner();
            await this.authenticate();
            this.startConsole();
        } catch (error) {
            console.error(chalk.red('Failed to initialize admin console:', error.message));
            process.exit(1);
        }
    }

    showWelcomeBanner() {
        console.clear();
        console.log(chalk.cyan(figlet.textSync('ITFY Admin', { horizontalLayout: 'full' })));
        console.log(chalk.yellow('═'.repeat(80)));
        console.log(chalk.green('ITFY E-Voting System - Admin Console'));
        console.log(chalk.blue(`Version: ${Config.serverConfig.apiVersion}`));
        console.log(chalk.blue(`Environment: ${Config.serverConfig.environment}`));
        console.log(chalk.yellow('═'.repeat(80)));
        console.log();
    }

    async authenticate() {
        const devKey = '4673123';
        const isProduction = Config.serverConfig.environment === 'production';

        if (!isProduction) {
            console.log(chalk.yellow('🔓 Development Mode - Using default key: 4673123'));
        }

        return new Promise((resolve) => {
            this.rl.question(chalk.magenta('Enter admin access key: '), async (key) => {
                const adminEmail = process.env.ADMIN_EMAIL || 'admin@itfy.com';

                if (key === devKey || (!isProduction && key === devKey)) {
                    // Check if admin user exists, create if not
                    let admin = await User.findOne({ email: adminEmail }).populate('role');

                    if (!admin) {
                        console.log(chalk.yellow('🔨 Creating admin user profile...'));
                        admin = await this.createAdminUser(adminEmail);
                    }

                    this.isAuthenticated = true;
                    this.adminUser = admin;
                    console.log(chalk.green(`✅ Authentication successful! Welcome, ${admin.name || 'Admin'}`));
                    console.log(chalk.gray('Type "help" to see available commands\n'));
                    resolve();
                } else {
                    console.log(chalk.red('❌ Invalid access key'));
                    process.exit(1);
                }
            });
        });
    }

    async createDefaultRoles() {
        try {
            // Create Admin Role (Level 4)
            let adminRole = await Role.findOne({ name: 'admin' });
            if (!adminRole) {
                adminRole = new Role({
                    name: 'admin',
                    level: 4
                });
                await adminRole.save();
                console.log(chalk.blue('✅ Created admin role (Level 4)'));
            }

            // Create Default User Role (Level 1)
            let userRole = await Role.findOne({ name: 'user' });
            if (!userRole) {
                userRole = new Role({
                    name: 'user',
                    level: 1
                });
                await userRole.save();
                console.log(chalk.blue('✅ Created user role (Level 1)'));
            }

            // Store role references for easy access
            this.adminRole = adminRole;
            this.userRole = userRole;
        } catch (error) {
            console.error(chalk.red('Error creating default roles:', error.message));
            throw error;
        }
    }

    async createAdminUser(email) {
        try {
            // Get the admin role
            const adminRole = await Role.findOne({ name: 'admin' });
            if (!adminRole) {
                throw new Error('Admin role not found');
            }

            const adminData = {
                name: 'System Administrator',
                role: adminRole._id,
                email: email,
                password: 'admin123', // This will be hashed by the model
                bio: 'System Administrator Account',
                createdBy: 'system'
            };

            const admin = new User(adminData);
            await admin.save();

            // Populate the role for display
            await admin.populate('role');

            console.log(chalk.green('✅ Admin user created successfully'));
            console.log(chalk.yellow('🔑 Default password: admin123 (Please change this)'));
            return admin;
        } catch (error) {
            console.error(chalk.red('Failed to create admin user:', error.message));
            throw error;
        }
    }

    startConsole() {
        this.rl.prompt();

        this.rl.on('line', async (input) => {
            const trimmedInput = input.trim();

            if (trimmedInput) {
                this.commandHistory.push(trimmedInput);
                await this.executeCommand(trimmedInput);
            }

            this.rl.prompt();
        });

        this.rl.on('close', () => {
            console.log(chalk.yellow('\nGoodbye! Admin console closed.'));
            process.exit(0);
        });
    }

    async executeCommand(input) {
        const [command, ...args] = input.split(' ');
        const cmd = this.commands[command];

        if (cmd) {
            try {
                // Check authorization level
                if (!await this.checkPermission(cmd.requiredLevel || 1)) {
                    console.error(chalk.red(`❌ Access denied. Required level: ${cmd.requiredLevel}, Your level: ${this.adminUser.role?.level || 0}`));
                    return;
                }

                await cmd.handler(args);
            } catch (error) {
                console.error(chalk.red(`Error executing command: ${error.message}`));
            }
        } else {
            console.log(chalk.red(`Unknown command: ${command}. Type "help" for available commands.`));
        }
    }

    async checkPermission(requiredLevel) {
        if (!this.adminUser || !this.adminUser.role) {
            return false;
        }
        return this.adminUser.role.level >= requiredLevel;
    }

    initializeCommands() {
        return {
            // Help and utility commands
            help: {
                description: 'Show available commands',
                usage: 'help [command]',
                handler: this.helpCommand.bind(this),
                requiredLevel: 1
            },
            clear: {
                description: 'Clear the console',
                usage: 'clear',
                handler: () => console.clear(),
                requiredLevel: 1
            },
            exit: {
                description: 'Exit the admin console',
                usage: 'exit',
                handler: () => process.exit(0),
                requiredLevel: 1
            },
            history: {
                description: 'Show command history',
                usage: 'history',
                handler: () => {
                    console.log(chalk.cyan('Command History:'));
                    this.commandHistory.forEach((cmd, index) => {
                        console.log(chalk.gray(`${index + 1}: ${cmd}`));
                    });
                },
                requiredLevel: 1
            },

            // System commands
            status: {
                description: 'Show system status',
                usage: 'status',
                handler: this.statusCommand.bind(this),
                requiredLevel: 2
            },
            config: {
                description: 'Show configuration details',
                usage: 'config',
                handler: this.configCommand.bind(this),
                requiredLevel: 3
            },

            // Authentication commands
            'auth:login': {
                description: 'Login with email and password',
                usage: 'auth:login <email> <password>',
                handler: this.loginCommand.bind(this),
                requiredLevel: 1
            },
            'auth:register': {
                description: 'Register new admin user',
                usage: 'auth:register <email> <name> <password>',
                handler: this.registerAdminCommand.bind(this),
                requiredLevel: 4
            },
            'auth:change-password': {
                description: 'Change current user password',
                usage: 'auth:change-password <currentPassword> <newPassword>',
                handler: this.changePasswordCommand.bind(this),
                requiredLevel: 1
            },

            // User management commands
            'user:list': {
                description: 'List all users',
                usage: 'user:list [limit] [page]',
                handler: this.listUsersCommand.bind(this),
                requiredLevel: 2
            },
            'user:create': {
                description: 'Create a new user',
                usage: 'user:create <email> <name> <password> [roleName]',
                handler: this.createUserCommand.bind(this),
                requiredLevel: 3
            },
            'user:find': {
                description: 'Find user by email or ID',
                usage: 'user:find <email|id>',
                handler: this.findUserCommand.bind(this),
                requiredLevel: 2
            },
            'user:reset-password': {
                description: 'Reset user password',
                usage: 'user:reset-password <email>',
                handler: this.resetPasswordCommand.bind(this),
                requiredLevel: 3
            },
            'user:change-role': {
                description: 'Change user role',
                usage: 'user:change-role <email> <roleName>',
                handler: this.changeUserRoleCommand.bind(this),
                requiredLevel: 4
            },
            'user:delete': {
                description: 'Delete a user',
                usage: 'user:delete <email>',
                handler: this.deleteUserCommand.bind(this),
                requiredLevel: 4
            },

            // Role management commands
            'role:list': {
                description: 'List all roles',
                usage: 'role:list',
                handler: this.listRolesCommand.bind(this),
                requiredLevel: 2
            },
            'role:create': {
                description: 'Create a new role',
                usage: 'role:create <name> <level>',
                handler: this.createRoleCommand.bind(this),
                requiredLevel: 4
            },

            // Event management commands
            'event:list': {
                description: 'List all events',
                usage: 'event:list [limit] [page]',
                handler: this.listEventsCommand.bind(this),
                requiredLevel: 2
            },
            'event:create': {
                description: 'Create a new event',
                usage: 'event:create <name> <description> <startDate> <endDate> [location]',
                handler: this.createEventCommand.bind(this),
                requiredLevel: 3
            },
            'event:update': {
                description: 'Update an event',
                usage: 'event:update <eventId> <field> <value>',
                handler: this.updateEventCommand.bind(this),
                requiredLevel: 3
            },
            'event:start': {
                description: 'Start an event',
                usage: 'event:start <eventId>',
                handler: this.startEventCommand.bind(this),
                requiredLevel: 3
            },
            'event:end': {
                description: 'End an event',
                usage: 'event:end <eventId>',
                handler: this.endEventCommand.bind(this),
                requiredLevel: 3
            },
            'event:cancel': {
                description: 'Cancel an event',
                usage: 'event:cancel <eventId> [reason]',
                handler: this.cancelEventCommand.bind(this),
                requiredLevel: 3
            },
            'event:stats': {
                description: 'Show event statistics',
                usage: 'event:stats [eventId]',
                handler: this.eventStatsCommand.bind(this),
                requiredLevel: 2
            },

            // Candidate management commands
            'candidate:list': {
                description: 'List candidates',
                usage: 'candidate:list [eventId] [limit]',
                handler: this.listCandidatesCommand.bind(this),
                requiredLevel: 2
            },
            'candidate:create': {
                description: 'Create a candidate',
                usage: 'candidate:create <eventId> <name> <description>',
                handler: this.createCandidateCommand.bind(this),
                requiredLevel: 3
            },
            'candidate:update': {
                description: 'Update a candidate',
                usage: 'candidate:update <candidateId> <field> <value>',
                handler: this.updateCandidateCommand.bind(this),
                requiredLevel: 3
            },
            'candidate:delete': {
                description: 'Delete a candidate',
                usage: 'candidate:delete <candidateId>',
                handler: this.deleteCandidateCommand.bind(this),
                requiredLevel: 3
            },
            'candidate:stats': {
                description: 'Show candidate statistics',
                usage: 'candidate:stats <candidateId>',
                handler: this.candidateStatsCommand.bind(this),
                requiredLevel: 2
            },

            // Category management commands
            'category:list': {
                description: 'List categories',
                usage: 'category:list [eventId]',
                handler: this.listCategoriesCommand.bind(this),
                requiredLevel: 2
            },
            'category:create': {
                description: 'Create a category',
                usage: 'category:create <eventId> <name> <description>',
                handler: this.createCategoryCommand.bind(this),
                requiredLevel: 3
            },

            // Voting management commands
            'vote:stats': {
                description: 'Show voting statistics',
                usage: 'vote:stats [eventId]',
                handler: this.voteStatsCommand.bind(this),
                requiredLevel: 2
            },
            'vote:export': {
                description: 'Export voting data',
                usage: 'vote:export <eventId> [format]',
                handler: this.exportVotesCommand.bind(this),
                requiredLevel: 3
            },
            'vote:results': {
                description: 'Show voting results',
                usage: 'vote:results <eventId>',
                handler: this.voteResultsCommand.bind(this),
                requiredLevel: 2
            },

            // Email commands
            'email:send': {
                description: 'Send email to user(s)',
                usage: 'email:send <to> <subject> <body>',
                handler: this.sendEmailCommand.bind(this),
                requiredLevel: 3
            },
            'email:broadcast': {
                description: 'Broadcast email to all users',
                usage: 'email:broadcast <subject> <body>',
                handler: this.broadcastEmailCommand.bind(this),
                requiredLevel: 4
            },

            // Activity monitoring
            'activity:list': {
                description: 'List recent activities',
                usage: 'activity:list [limit] [userId]',
                handler: this.listActivitiesCommand.bind(this),
                requiredLevel: 2
            },
            'activity:stats': {
                description: 'Show activity statistics',
                usage: 'activity:stats',
                handler: this.activityStatsCommand.bind(this),
                requiredLevel: 2
            },

            // Cache management commands
            'cache:stats': {
                description: 'Show cache statistics',
                usage: 'cache:stats',
                handler: this.cacheStatsCommand.bind(this),
                requiredLevel: 2
            },
            'cache:clear': {
                description: 'Clear cache',
                usage: 'cache:clear [pattern]',
                handler: this.clearCacheCommand.bind(this),
                requiredLevel: 3
            },

            // Payment commands
            'payment:list': {
                description: 'List payments',
                usage: 'payment:list [limit] [status]',
                handler: this.listPaymentsCommand.bind(this),
                requiredLevel: 2
            },
            'payment:stats': {
                description: 'Show payment statistics',
                usage: 'payment:stats',
                handler: this.paymentStatsCommand.bind(this),
                requiredLevel: 2
            },

            // Coupon management
            'coupon:list': {
                description: 'List coupons',
                usage: 'coupon:list [eventId] [limit]',
                handler: this.listCouponsCommand.bind(this),
                requiredLevel: 2
            },
            'coupon:create': {
                description: 'Create a coupon',
                usage: 'coupon:create <eventId> <code> <discount> <expiresAt>',
                handler: this.createCouponCommand.bind(this),
                requiredLevel: 3
            },

            // File management
            'file:list': {
                description: 'List uploaded files',
                usage: 'file:list [type] [limit]',
                handler: this.listFilesCommand.bind(this),
                requiredLevel: 2
            },
            'file:cleanup': {
                description: 'Clean up unused files',
                usage: 'file:cleanup',
                handler: this.cleanupFilesCommand.bind(this),
                requiredLevel: 4
            },

            // Database commands
            'db:stats': {
                description: 'Show database statistics',
                usage: 'db:stats',
                handler: this.dbStatsCommand.bind(this),
                requiredLevel: 2
            },
            'db:backup': {
                description: 'Backup database',
                usage: 'db:backup [filename]',
                handler: this.backupDbCommand.bind(this),
                requiredLevel: 4
            },
            'db:optimize': {
                description: 'Optimize database performance',
                usage: 'db:optimize',
                handler: this.optimizeDbCommand.bind(this),
                requiredLevel: 4
            }
        };
    }

    async helpCommand(args) {
        if (args.length > 0) {
            const command = args[0];
            const cmd = this.commands[command];
            if (cmd) {
                console.log(chalk.cyan(`Command: ${command}`));
                console.log(chalk.white(`Description: ${cmd.description}`));
                console.log(chalk.gray(`Usage: ${cmd.usage}`));
                console.log(chalk.blue(`Required Level: ${cmd.requiredLevel || 1}`));
            } else {
                console.log(chalk.red(`Unknown command: ${command}`));
            }
        } else {
            console.log(chalk.cyan('Available Commands:'));
            console.log(chalk.yellow('═'.repeat(60)));

            const categories = {
                'System': ['help', 'clear', 'exit', 'history', 'status', 'config'],
                'Authentication': ['auth:login', 'auth:register', 'auth:change-password'],
                'User Management': ['user:list', 'user:create', 'user:find', 'user:reset-password', 'user:change-role', 'user:delete'],
                'Role Management': ['role:list', 'role:create'],
                'Event Management': ['event:list', 'event:create', 'event:update', 'event:start', 'event:end', 'event:cancel', 'event:stats'],
                'Candidate Management': ['candidate:list', 'candidate:create', 'candidate:update', 'candidate:delete', 'candidate:stats'],
                'Category Management': ['category:list', 'category:create'],
                'Voting': ['vote:stats', 'vote:export', 'vote:results'],
                'Email': ['email:send', 'email:broadcast'],
                'Activity': ['activity:list', 'activity:stats'],
                'Cache': ['cache:stats', 'cache:clear'],
                'Payment': ['payment:list', 'payment:stats'],
                'Coupon': ['coupon:list', 'coupon:create'],
                'File': ['file:list', 'file:cleanup'],
                'Database': ['db:stats', 'db:backup', 'db:optimize']
            };

            Object.entries(categories).forEach(([category, commands]) => {
                console.log(chalk.green(`\n${category}:`));
                commands.forEach(cmd => {
                    const command = this.commands[cmd];
                    if (command) {
                        const hasAccess = this.adminUser?.role?.level >= (command.requiredLevel || 1);
                        const accessIcon = hasAccess ? '✅' : '❌';
                        console.log(chalk.white(`  ${accessIcon} ${cmd.padEnd(25)} - ${command.description}`));
                    }
                });
            });

            console.log(chalk.gray('\nUse "help <command>" for detailed usage information.'));
            console.log(chalk.blue(`Your access level: ${this.adminUser?.role?.level || 0}`));
        }
    }

    // Authentication Commands
    async loginCommand(args) {
        if (args.length < 2) {
            console.log(chalk.red('Usage: auth:login <email> <password>'));
            return;
        }

        try {
            const [email, password] = args;
            const result = await this.services.auth.login(email, password);

            if (result.success) {
                const user = await User.findById(result.user.id).populate('role');

                // Check if user has admin privileges
                if (!user.role || user.role.level < 2) {
                    console.log(chalk.red('❌ Access denied. Admin privileges required.'));
                    return;
                }

                this.adminUser = user;
                console.log(chalk.green(`✅ Login successful! Welcome, ${user.name}`));
                console.log(chalk.blue(`Role: ${user.role.name} (Level ${user.role.level})`));
            } else {
                console.log(chalk.red('❌ Login failed: Invalid credentials'));
            }
        } catch (error) {
            console.error(chalk.red('Error during login:', error.message));
        }
    }

    async registerAdminCommand(args) {
        if (args.length < 3) {
            console.log(chalk.red('Usage: auth:register <email> <name> <password>'));
            return;
        }

        try {
            const [email, name, password] = args;

            // Get admin role
            const adminRole = await Role.findOne({ name: 'admin' });
            if (!adminRole) {
                console.log(chalk.red('Admin role not found'));
                return;
            }

            const userData = {
                email,
                name,
                password,
                role: adminRole._id,
                bio: 'Administrator Account'
            };

            const result = await this.services.auth.register(userData);

            if (result.success) {
                console.log(chalk.green(`✅ Admin user registered successfully: ${email}`));
                console.log(chalk.blue(`User ID: ${result.user.id}`));
            } else {
                console.log(chalk.red(`❌ Registration failed: ${result.message}`));
            }
        } catch (error) {
            console.error(chalk.red('Error during registration:', error.message));
        }
    }

    async changePasswordCommand(args) {
        if (args.length < 2) {
            console.log(chalk.red('Usage: auth:change-password <currentPassword> <newPassword>'));
            return;
        }

        try {
            const [currentPassword, newPassword] = args;

            const result = await this.services.auth.changePassword(
                this.adminUser._id,
                currentPassword,
                newPassword
            );

            if (result.success) {
                console.log(chalk.green('✅ Password changed successfully'));
            } else {
                console.log(chalk.red(`❌ Password change failed: ${result.message}`));
            }
        } catch (error) {
            console.error(chalk.red('Error changing password:', error.message));
        }
    }

    // Enhanced User Management Commands
    async deleteUserCommand(args) {
        if (args.length === 0) {
            console.log(chalk.red('Usage: user:delete <email>'));
            return;
        }

        try {
            const email = args[0];
            const user = await User.findOne({ email });

            if (!user) {
                console.log(chalk.red('User not found'));
                return;
            }

            // Prevent self-deletion
            if (user._id.toString() === this.adminUser._id.toString()) {
                console.log(chalk.red('❌ Cannot delete your own account'));
                return;
            }

            await User.findByIdAndDelete(user._id);
            console.log(chalk.green(`✅ User deleted successfully: ${email}`));
        } catch (error) {
            console.error(chalk.red('Error deleting user:', error.message));
        }
    }

    async statusCommand() {
        try {
            const dbHealth = await dbInitializer.checkHealth();
            const dbStats = await dbConnection.getConnectionStats();

            console.log(chalk.cyan('🖥️  System Status'));
            console.log(chalk.yellow('═'.repeat(40)));
            console.log(chalk.green(`✅ Server: Running on ${Config.serverConfig.host}:${Config.serverConfig.port}`));
            console.log(chalk.green(`✅ Environment: ${Config.serverConfig.environment}`));
            console.log(chalk.green(`✅ Database: ${dbHealth.status}`));
            console.log(chalk.blue(`📊 DB Connections: Active ${dbStats.activeConnections || 'N/A'}`));
            console.log(chalk.blue(`👤 Admin User: ${this.adminUser.email}`));
            console.log(chalk.blue(`⏰ Session Started: ${new Date().toLocaleString()}`));
        } catch (error) {
            console.error(chalk.red('Error getting system status:', error.message));
        }
    }

    async configCommand() {
        console.log(chalk.cyan('⚙️  Configuration'));
        console.log(chalk.yellow('═'.repeat(40)));
        console.log(chalk.blue('Server Configuration:'));
        console.log(`  Port: ${Config.serverConfig.port}`);
        console.log(`  Host: ${Config.serverConfig.host}`);
        console.log(`  API Version: ${Config.serverConfig.apiVersion}`);
        console.log(`  Environment: ${Config.serverConfig.environment}`);

        console.log(chalk.blue('\nEmail Configuration:'));
        console.log(`  From Email: ${process.env.FROM_EMAIL || 'Not configured'}`);
        console.log(`  Admin Email: ${process.env.ADMIN_EMAIL || 'Not configured'}`);
        console.log(`  Support Email: ${process.env.SUPPORT_EMAIL || 'Not configured'}`);
    }

    async listUsersCommand(args) {
        try {
            const limit = parseInt(args[0]) || 10;
            const page = parseInt(args[1]) || 1;
            const skip = (page - 1) * limit;

            const result = await this.services.user.getUsers({
                limit,
                skip,
                populate: ['role']
            });

            const users = result.data.items;
            const total = result.data.pagination.totalItems;

            console.log(chalk.cyan(`👥 Users (Page ${page}, Showing ${users.length} of ${total})`));
            console.log(chalk.yellow('═'.repeat(80)));

            users.forEach(user => {
                const roleInfo = user.role ? `${user.role.name} (L${user.role.level})` : 'No Role';
                const roleColor = user.role?.level >= 4 ? chalk.red : user.role?.level >= 2 ? chalk.yellow : chalk.blue;
                console.log(`${user.email.padEnd(30)} ${user.name.padEnd(25)} ${roleColor(roleInfo)}`);
            });
        } catch (error) {
            console.error(chalk.red('Error listing users:', error.message));
        }
    }

    async createUserCommand(args) {
        if (args.length < 3) {
            console.log(chalk.red('Usage: user:create <email> <name> <password> [roleName]'));
            return;
        }

        try {
            const [email, name, password, roleName = 'user'] = args;

            // Find the role
            let role = await Role.findOne({ name: roleName });
            if (!role) {
                console.log(chalk.yellow(`Role '${roleName}' not found, using default 'user' role`));
                role = await Role.findOne({ name: 'user' });
            }

            const userData = {
                email,
                name,
                password, // Will be hashed by the model
                role: role._id,
                bio: `Created by admin console`,
                createdBy: this.adminUser._id
            };

            const user = new User(userData);
            await user.save();
            await user.populate('role', 'name level');

            console.log(chalk.green(`✅ User created successfully: ${user.email}`));
            console.log(chalk.blue(`👤 Name: ${user.name}`));
            console.log(chalk.blue(`🎭 Role: ${user.role.name} (Level ${user.role.level})`));
            console.log(chalk.yellow(`🔑 Password: ${password} (User should change this)`));
        } catch (error) {
            console.error(chalk.red('Error creating user:', error.message));
        }
    }

    async findUserCommand(args) {
        if (args.length === 0) {
            console.log(chalk.red('Usage: user:find <email|id>'));
            return;
        }

        try {
            const query = args[0];
            let user;

            if (query.includes('@')) {
                user = await User.findOne({ email: query }).populate('role', 'name level');
            } else {
                user = await User.findById(query).populate('role', 'name level');
            }

            if (user) {
                console.log(chalk.cyan('👤 User Details'));
                console.log(chalk.yellow('═'.repeat(40)));
                console.log(`ID: ${user._id}`);
                console.log(`Email: ${user.email}`);
                console.log(`Name: ${user.name}`);
                console.log(`Role: ${user.role ? `${user.role.name} (Level ${user.role.level})` : 'No Role'}`);
                console.log(`Bio: ${user.bio || 'No bio'}`);
                console.log(`Created: ${user.createdAt}`);
                console.log(`Updated: ${user.updatedAt}`);
            } else {
                console.log(chalk.red('User not found'));
            }
        } catch (error) {
            console.error(chalk.red('Error finding user:', error.message));
        }
    }

    async resetPasswordCommand(args) {
        if (args.length === 0) {
            console.log(chalk.red('Usage: user:reset-password <email>'));
            return;
        }

        try {
            const email = args[0];
            const user = await User.findOne({ email });

            if (!user) {
                console.log(chalk.red('User not found'));
                return;
            }

            // Generate a temporary password
            const tempPassword = Math.random().toString(36).slice(-8);
            user.password = tempPassword;
            await user.save();

            console.log(chalk.green(`✅ Password reset for ${email}`));
            console.log(chalk.yellow(`🔑 New temporary password: ${tempPassword}`));
            console.log(chalk.gray('User should change this password immediately'));
        } catch (error) {
            console.error(chalk.red('Error resetting password:', error.message));
        }
    }

    async changeUserRoleCommand(args) {
        if (args.length < 2) {
            console.log(chalk.red('Usage: user:change-role <email> <roleName>'));
            return;
        }

        try {
            const [email, roleName] = args;

            const user = await User.findOne({ email }).populate('role');
            if (!user) {
                console.log(chalk.red('User not found'));
                return;
            }

            const newRole = await Role.findOne({ name: roleName });
            if (!newRole) {
                console.log(chalk.red(`Role '${roleName}' not found`));
                return;
            }

            const oldRoleName = user.role ? user.role.name : 'None';
            user.role = newRole._id;
            await user.save();
            await user.populate('role');

            console.log(chalk.green(`✅ User role changed for ${email}`));
            console.log(chalk.blue(`Old Role: ${oldRoleName}`));
            console.log(chalk.blue(`New Role: ${user.role.name} (Level ${user.role.level})`));
        } catch (error) {
            console.error(chalk.red('Error changing user role:', error.message));
        }
    }

    async listRolesCommand(args) {
        try {
            const limit = parseInt(args[0]) || 10;
            const page = parseInt(args[1]) || 1;
            const skip = (page - 1) * limit;

            const result = await Role.find({})
                .limit(limit)
                .skip(skip)
                .sort({ level: -1 });

            const total = await Role.countDocuments();

            console.log(chalk.cyan(`🎭 Roles (Page ${page}, Showing ${result.length} of ${total})`));
            console.log(chalk.yellow('═'.repeat(80)));

            result.forEach(role => {
                const levelColor = role.level >= 4 ? chalk.red : role.level >= 2 ? chalk.yellow : chalk.blue;
                console.log(`${levelColor(role.name.padEnd(15))} Level ${role.level}`);
            });
        } catch (error) {
            console.error(chalk.red('Error listing roles:', error.message));
        }
    }

    async createRoleCommand(args) {
        if (args.length < 2) {
            console.log(chalk.red('Usage: role:create <name> <level>'));
            return;
        }

        try {
            const [name, levelStr] = args;
            const level = parseInt(levelStr);

            if (isNaN(level) || level < 1 || level > 10) {
                console.log(chalk.red('Level must be a number between 1 and 10'));
                return;
            }

            const existingRole = await Role.findOne({ name });
            if (existingRole) {
                console.log(chalk.red(`Role '${name}' already exists`));
                return;
            }

            const role = new Role({ name, level });
            await role.save();

            console.log(chalk.green(`✅ Role created successfully: ${name}`));
            console.log(chalk.blue(`Level: ${level}`));
        } catch (error) {
            console.error(chalk.red('Error creating role:', error.message));
        }
    }

    async listEventsCommand(args) {
        try {
            const limit = parseInt(args[0]) || 10;
            const page = parseInt(args[1]) || 1;
            const skip = (page - 1) * limit;

            const result = await this.services.event.getEvents({
                limit,
                skip,
                populate: ['createdBy', 'updatedBy']
            });

            const events = result.data.items;
            const total = result.data.pagination.totalItems;

            console.log(chalk.cyan(`📅 Events (Page ${page}, Showing ${events.length} of ${total})`));
            console.log(chalk.yellow('═'.repeat(80)));

            events.forEach(event => {
                const status = event.status === 'active' ? chalk.green('🟢') : chalk.gray('⚪');
                console.log(`${status} ${event.id} ${event.name.padEnd(20)} ${event.status.padEnd(10)} ${event.startDate.toDateString()}`);
            });
        } catch (error) {
            console.error(chalk.red('Error listing events:', error.message));
        }
    }

    async sendEmailCommand(args) {
        if (args.length < 3) {
            console.log(chalk.red('Usage: email:send <to> <subject> <body>'));
            return;
        }

        try {
            const [to, subject, ...bodyParts] = args;
            const body = bodyParts.join(' ');

            await this.services.email.sendEmail({
                to,
                subject,
                html: `<p>${body}</p>`
            });

            console.log(chalk.green(`✅ Email sent to ${to}`));
        } catch (error) {
            console.error(chalk.red('Error sending email:', error.message));
        }
    }

    // Candidate Management Commands
    async listCandidatesCommand(args) {
        try {
            const eventId = args[0];
            const limit = parseInt(args[1]) || 10;
            const page = parseInt(args[2]) || 1;
            const skip = (page - 1) * limit;

            let result;
            if (eventId) {
                result = await this.services.candidate.getCandidatesByEvent(eventId, { limit, skip });
            } else {
                result = await this.services.candidate.getCandidates({
                    limit,
                    skip,
                    populate: ['eventId', 'userId']
                });
            }

            const candidates = result.data.items;
            const total = result.data.pagination.totalItems;

            console.log(chalk.cyan(`👥 Candidates (Page ${page}, Showing ${candidates.length} of ${total})`));
            console.log(chalk.yellow('═'.repeat(80)));

            candidates.forEach(candidate => {
                const eventName = candidate.eventId?.name || 'Unknown Event';
                console.log(`${candidate.name.padEnd(25)} ${eventName.padEnd(30)} ${candidate.voteCount || 0} votes`);
            });
        } catch (error) {
            console.error(chalk.red('Error listing candidates:', error.message));
        }
    }

    async createCandidateCommand(args) {
        if (args.length < 3) {
            console.log(chalk.red('Usage: candidate:create <eventId> <name> <description>'));
            return;
        }

        try {
            const [eventId, name, ...descriptionParts] = args;
            const description = descriptionParts.join(' ');

            const candidateData = {
                eventId,
                name,
                description
            };

            const candidate = await this.services.candidate.createCandidate(candidateData, this.adminUser._id);
            console.log(chalk.green(`✅ Candidate created successfully: ${candidate.name}`));
            console.log(chalk.blue(`Candidate ID: ${candidate._id}`));
        } catch (error) {
            console.error(chalk.red('Error creating candidate:', error.message));
        }
    }

    async updateCandidateCommand(args) {
        if (args.length < 3) {
            console.log(chalk.red('Usage: candidate:update <candidateId> <field> <value>'));
            return;
        }

        try {
            const [candidateId, field, ...valueParts] = args;
            const value = valueParts.join(' ');

            const updateData = { [field]: value };
            const candidate = await this.services.candidate.updateCandidate(candidateId, updateData, this.adminUser._id);

            console.log(chalk.green(`✅ Candidate updated successfully`));
            console.log(chalk.blue(`${field}: ${value}`));
        } catch (error) {
            console.error(chalk.red('Error updating candidate:', error.message));
        }
    }

    async deleteCandidateCommand(args) {
        if (args.length === 0) {
            console.log(chalk.red('Usage: candidate:delete <candidateId>'));
            return;
        }

        try {
            const candidateId = args[0];
            await this.services.candidate.deleteCandidate(candidateId, this.adminUser._id);
            console.log(chalk.green(`✅ Candidate deleted successfully`));
        } catch (error) {
            console.error(chalk.red('Error deleting candidate:', error.message));
        }
    }

    async candidateStatsCommand(args) {
        if (args.length === 0) {
            console.log(chalk.red('Usage: candidate:stats <candidateId>'));
            return;
        }

        try {
            const candidateId = args[0];
            const stats = await this.services.candidate.getCandidateStatistics(candidateId);

            console.log(chalk.cyan(`📊 Candidate Statistics`));
            console.log(chalk.yellow('═'.repeat(40)));
            console.log(`Name: ${stats.candidate.name}`);
            console.log(`Event: ${stats.candidate.eventId?.name || 'Unknown'}`);
            console.log(`Total Votes: ${stats.voteCount}`);
            console.log(`Vote Percentage: ${stats.votePercentage}%`);
            console.log(`Ranking: ${stats.ranking}`);
        } catch (error) {
            console.error(chalk.red('Error getting candidate stats:', error.message));
        }
    }

    // Category Management Commands
    async listCategoriesCommand(args) {
        try {
            const eventId = args[0];
            const limit = parseInt(args[1]) || 10;
            const page = parseInt(args[2]) || 1;
            const skip = (page - 1) * limit;

            let result;
            if (eventId) {
                result = await this.services.category.getCategoriesByEvent(eventId, { limit, skip });
            } else {
                result = await this.services.category.getCategories({ limit, skip });
            }

            const categories = result.data.items;
            const total = result.data.pagination.totalItems;

            console.log(chalk.cyan(`📂 Categories (Page ${page}, Showing ${categories.length} of ${total})`));
            console.log(chalk.yellow('═'.repeat(80)));

            categories.forEach(category => {
                const eventName = category.eventId?.name || 'Unknown Event';
                console.log(`${category.name.padEnd(25)} ${eventName.padEnd(30)} ${category.candidateCount || 0} candidates`);
            });
        } catch (error) {
            console.error(chalk.red('Error listing categories:', error.message));
        }
    }

    async createCategoryCommand(args) {
        try {
            if (args.length < 3) {
                console.log(chalk.red('Usage: category:create <eventId> <name> <description>'));
                return;
            }

            const [eventId, name, description] = args;

            // Check if event exists
            const event = await this.services.event.getById(eventId);
            if (!event) {
                console.log(chalk.red(`Event with ID ${eventId} not found`));
                return;
            }

            const category = await this.services.category.create({
                eventId: parseInt(eventId),
                name,
                description,
                isActive: true
            });

            if (category) {
                console.log(chalk.green(`Category created successfully`));
                console.log(chalk.cyan(`ID: ${category.id}`));
                console.log(chalk.cyan(`Name: ${category.name}`));
                console.log(chalk.cyan(`Description: ${category.description}`));
                console.log(chalk.cyan(`Event: ${event.name}`));
            } else {
                console.log(chalk.red('Failed to create category'));
            }
        } catch (error) {
            console.log(chalk.red(`Error creating category: ${error.message}`));
        }
    }

    // Voting Management Commands
    async voteResultsCommand(args) {
        if (args.length === 0) {
            console.log(chalk.red('Usage: vote:results <eventId>'));
            return;
        }

        try {
            const eventId = args[0];
            const results = await this.services.voting.getVotingResults(eventId);

            console.log(chalk.cyan(`🏆 Voting Results for Event: ${results.event.name}`));
            console.log(chalk.yellow('═'.repeat(60)));

            results.categories.forEach(category => {
                console.log(chalk.green(`\n📂 ${category.name}:`));
                category.results.forEach((result, index) => {
                    const position = index + 1;
                    const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '  ';
                    console.log(`  ${medal} ${result.candidate.name.padEnd(25)} ${result.votes} votes (${result.percentage}%)`);
                });
            });

            console.log(chalk.blue(`\nTotal Votes Cast: ${results.totalVotes}`));
            console.log(chalk.blue(`Total Voters: ${results.totalVoters}`));
        } catch (error) {
            console.error(chalk.red('Error getting vote results:', error.message));
        }
    }

    // Activity Management Commands
    async listActivitiesCommand(args) {
        try {
            const limit = parseInt(args[0]) || 20;
            const userId = args[1];

            const query = userId ? { userId } : {};
            const result = await this.services.activity.getActivities(query, {
                limit,
                sort: { createdAt: -1 },
                populate: ['userId']
            });

            const activities = result.data.items;
            const total = result.data.pagination.totalItems;

            console.log(chalk.cyan(`📋 Recent Activities (${total} found)`));
            console.log(chalk.yellow('═'.repeat(80)));

            activities.forEach(activity => {
                const userName = activity.user.name || 'Unknown User';
                const time = new Date(activity.timestamp).toLocaleString();
                console.log(`${time.padEnd(25)} | ${userName.padEnd(20)} | ${activity.targetType.padEnd(15)} | ${activity.action}`);
            });
        } catch (error) {
            console.error(chalk.red('Error listing activities:', error.message));
        }
    }

    async activityStatsCommand() {
        try {
            const results = await this.services.activity.getActivityStats();

            const stats = results.data;
            console.log(chalk.cyan('📊 Activity Statistics'));
            console.log(chalk.yellow('═'.repeat(40)));
            console.log(`Total Activities: ${stats.totalActivities}`);

            console.log(chalk.green('\nAction Breakdown:'));
            stats.actionBreakdown.forEach(item => {
                console.log(`  ${item.action.padEnd(20)} ${item.count} activities`);
            });

            console.log(chalk.green('\nTarget Type Breakdown:'));
            stats.targetTypeBreakdown.forEach(item => {
                console.log(`  ${item.targetType.padEnd(20)} ${item.count} activities`);
            });

            console.log(chalk.green('\nDaily Activities:'));
            stats.dailyActivities.forEach(item => {
                console.log(`  ${item.date.padEnd(20)} ${item.count} activities`);
            });

            console.log(chalk.green('\nMost Active Users:'));
            stats.mostActiveUsers.forEach(user => {
                console.log(`  ${user.name.padEnd(20)} (${user.email}) ${user.activityCount} activities`);
            });
        } catch (error) {
            console.error(chalk.red('Error getting activity stats:', error.message));
        }
    }

    // Cache Management Commands
    async cacheStatsCommand() {
        try {
            const stats = await this.services.cache.getStats();
            console.log(chalk.cyan('💾 Cache Statistics'));
            console.log(chalk.yellow('═'.repeat(40)));
            console.log(`Hits: ${stats.hits || 0}`);
            console.log(`Misses: ${stats.misses || 0}`);
            console.log(`Keys: ${stats.keys || 0}`);
            console.log(`Memory Usage: ${stats.memoryUsage || 'N/A'}`);
        } catch (error) {
            console.error(chalk.red('Error getting cache stats:', error.message));
        }
    }

    // Coupon Management Commands
    async listCouponsCommand(args) {
        try {
            const eventId = args[0];
            const limit = parseInt(args[1]) || 10;
            const page = parseInt(args[2]) || 1;
            const skip = (page - 1) * limit;

            let result;
            if (eventId) {
                result = await this.services.coupon.getCouponsByEvent(eventId, { limit, skip });
            } else {
                result = await this.services.coupon.getCoupons({ limit, skip });
            }

            const coupons = result.data.items;
            const total = result.data.pagination.totalItems;

            console.log(chalk.cyan(`🎫 Coupons (Page ${page}, Showing ${coupons.length} of ${total})`));
            console.log(chalk.yellow('═'.repeat(80)));

            coupons.forEach(coupon => {
                const status = coupon.isActive ? chalk.green('Active') : chalk.red('Inactive');
                const eventName = coupon.eventId?.name || 'All Events';
                console.log(`${coupon.code.padEnd(15)} ${coupon.discount}% ${status.padEnd(10)} ${eventName.padEnd(25)} ${coupon.usageCount || 0} uses`);
            });
        } catch (error) {
            console.error(chalk.red('Error listing coupons:', error.message));
        }
    }

    async createCouponCommand(args) {
        if (args.length < 4) {
            console.log(chalk.red('Usage: coupon:create <eventId> <code> <discount> <expiresAt>'));
            return;
        }

        try {
            const [eventId, code, discount, expiresAt] = args;

            const couponData = {
                eventId,
                code,
                discount: parseInt(discount),
                expiresAt: new Date(expiresAt),
                isActive: true
            };

            const coupon = await this.services.coupon.createCoupon(couponData, this.adminUser._id);
            console.log(chalk.green(`✅ Coupon created successfully: ${coupon.code}`));
            console.log(chalk.blue(`Discount: ${coupon.discount}%`));
            console.log(chalk.blue(`Expires: ${coupon.expiresAt.toDateString()}`));
        } catch (error) {
            console.error(chalk.red('Error creating coupon:', error.message));
        }
    }

    // File Management Commands
    async listFilesCommand(args) {
        try {
            const type = args[0];
            const limit = parseInt(args[1]) || 20;

            const result = await this.services.file.getFiles({ type, limit });

            const files = result.data.items;
            const total = result.data.pagination.totalItems;
            console.log(chalk.cyan(`📁 Files (${total} found)`));
            console.log(chalk.yellow('═'.repeat(80)));

            files.forEach(file => {
                const size = (file.size / 1024).toFixed(2) + ' KB';
                const uploadDate = new Date(file.createdAt).toDateString();
                console.log(`${file.filename.padEnd(30)} ${file.mimetype.padEnd(15)} ${size.padEnd(10)} ${uploadDate}`);
            });
        } catch (error) {
            console.error(chalk.red('Error listing files:', error.message));
        }
    }

    async cleanupFilesCommand() {
        try {
            console.log(chalk.yellow('🧹 Starting file cleanup...'));
            const result = await this.services.file.cleanupUnusedFiles();

            console.log(chalk.green(`✅ File cleanup completed`));
            console.log(chalk.blue(`Files removed: ${result.removedCount}`));
            console.log(chalk.blue(`Space freed: ${(result.spaceFreed / 1024 / 1024).toFixed(2)} MB`));
        } catch (error) {
            console.error(chalk.red('Error during file cleanup:', error.message));
        }
    }

    // Database Management Commands
    async optimizeDbCommand() {
        try {
            console.log(chalk.yellow('⚡ Optimizing database...'));

            // Run database optimization tasks
            const collections = ['users', 'events', 'votes', 'candidates', 'payments'];

            for (const collectionName of collections) {
                const Model = this.getModelByName(collectionName);
                if (Model) {
                    await Model.collection.reIndex();
                    console.log(chalk.blue(`✓ Reindexed ${collectionName}`));
                }
            }

            console.log(chalk.green('✅ Database optimization completed'));
        } catch (error) {
            console.error(chalk.red('Error optimizing database:', error.message));
        }
    }

    async createEventCommand(args) {
        if (args.length < 4) {
            console.log(chalk.red('Usage: event:create <name> <description> <startDate> <endDate> [location]'));
            return;
        }

        try {
            const [name, description, startDate, endDate, location = 'Online'] = args;
            const eventData = {
                name,
                description,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                location,
                createdBy: this.adminUser._id,
            };

            const event = await this.services.event.createEvent(eventData, this.adminUser._id);
            console.log(chalk.green(`✅ Event created successfully: ${event.name}`));
            console.log(chalk.blue(`Event ID: ${event._id}`));
            console.log(chalk.blue(`Location: ${event.location}`));
            console.log(chalk.blue(`Start Date: ${event.startDate}`));
            console.log(chalk.blue(`End Date: ${event.endDate}`));
        } catch (error) {
            console.error(chalk.red('Error creating event:', error.message));
        }
    }

    async updateEventCommand(args) {
        if (args.length < 3) {
            console.log(chalk.red('Usage: event:update <eventId> <field> <value>'));
            return;
        }

        try {
            const [eventId, field, ...valueParts] = args;
            const value = valueParts.join(' ');

            const updateData = { [field]: value };

            // Handle date fields
            if (field.includes('Date')) {
                updateData[field] = new Date(value);
            }

            const event = await this.services.event.updateEvent(eventId, updateData, this.adminUser._id);
            console.log(chalk.green(`✅ Event updated successfully`));
            console.log(chalk.blue(`${field}: ${value}`));
        } catch (error) {
            console.error(chalk.red('Error updating event:', error.message));
        }
    }

    async startEventCommand(args) {
        if (args.length === 0) {
            console.log(chalk.red('Usage: event:start <eventId>'));
            return;
        }

        try {
            const eventId = args[0];
            const event = await this.services.event.startEvent(eventId, this.adminUser._id);
            console.log(chalk.green(`✅ Event started successfully: ${event.name}`));
        } catch (error) {
            console.error(chalk.red('Error starting event:', error.message));
        }
    }

    async endEventCommand(args) {
        if (args.length === 0) {
            console.log(chalk.red('Usage: event:end <eventId>'));
            return;
        }

        try {
            const eventId = args[0];
            const event = await this.services.event.endEvent(eventId, this.adminUser._id);
            console.log(chalk.green(`✅ Event ended successfully: ${event.name}`));
        } catch (error) {
            console.error(chalk.red('Error ending event:', error.message));
        }
    }

    async cancelEventCommand(args) {
        if (args.length === 0) {
            console.log(chalk.red('Usage: event:cancel <eventId> [reason]'));
            return;
        }

        try {
            const [eventId, ...reasonParts] = args;
            const reason = reasonParts.join(' ') || 'Cancelled by admin';

            const event = await this.services.event.cancelEvent(eventId, this.adminUser._id, reason);
            console.log(chalk.green(`✅ Event cancelled successfully: ${event.name}`));
            console.log(chalk.yellow(`Reason: ${reason}`));
        } catch (error) {
            console.error(chalk.red('Error cancelling event:', error.message));
        }
    }

    async eventStatsCommand(args) {
        try {
            const eventId = args[0];

            if (eventId) {
                // Stats for specific event
                const event = await Event.findById(eventId);
                if (!event) {
                    console.log(chalk.red('Event not found'));
                    return;
                }

                const voteCount = await Vote.countDocuments({ eventId });
                const candidateCount = await Candidate.countDocuments({ eventId });

                console.log(chalk.cyan(`📊 Event Statistics: ${event.title}`));
                console.log(chalk.yellow('═'.repeat(50)));
                console.log(`Total Votes: ${voteCount}`);
                console.log(`Total Candidates: ${candidateCount}`);
                console.log(`Status: ${event.status}`);
                console.log(`Start Date: ${event.startDate.toDateString()}`);
                console.log(`End Date: ${event.endDate.toDateString()}`);
            } else {
                // General event stats
                const totalEvents = await Event.countDocuments();
                const activeEvents = await Event.countDocuments({ status: 'active' });
                const completedEvents = await Event.countDocuments({ status: 'completed' });
                const totalVotes = await Vote.countDocuments();

                console.log(chalk.cyan('📊 Overall Event Statistics'));
                console.log(chalk.yellow('═'.repeat(40)));
                console.log(`Total Events: ${totalEvents}`);
                console.log(`Active Events: ${activeEvents}`);
                console.log(`Completed Events: ${completedEvents}`);
                console.log(`Total Votes Cast: ${totalVotes}`);
            }
        } catch (error) {
            console.error(chalk.red('Error getting event stats:', error.message));
        }
    }

    async voteStatsCommand(args) {
        try {
            const eventId = args[0];

            if (eventId) {
                // Stats for specific event
                const votes = await Vote.find({ eventId }).populate('candidateId userId');
                const uniqueVoters = new Set(votes.map(v => v.userId.toString())).size;

                console.log(chalk.cyan(`🗳️  Voting Statistics for Event: ${eventId}`));
                console.log(chalk.yellow('═'.repeat(50)));
                console.log(`Total Votes: ${votes.length}`);
                console.log(`Unique Voters: ${uniqueVoters}`);

                // Vote distribution by candidate
                const candidateVotes = {};
                votes.forEach(vote => {
                    const candidateName = vote.candidateId.name || vote.candidateId._id;
                    candidateVotes[candidateName] = (candidateVotes[candidateName] || 0) + 1;
                });

                console.log('\nVote Distribution:');
                Object.entries(candidateVotes).forEach(([candidate, count]) => {
                    console.log(`  ${candidate}: ${count} votes`);
                });
            } else {
                // General voting stats
                const totalVotes = await Vote.countDocuments();
                const recentVotes = await Vote.countDocuments({
                    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                });

                console.log(chalk.cyan('🗳️  Overall Voting Statistics'));
                console.log(chalk.yellow('═'.repeat(40)));
                console.log(`Total Votes: ${totalVotes}`);
                console.log(`Votes in Last 24h: ${recentVotes}`);
            }
        } catch (error) {
            console.error(chalk.red('Error getting vote stats:', error.message));
        }
    }

    async exportVotesCommand(args) {
        if (args.length === 0) {
            console.log(chalk.red('Usage: vote:export <eventId> [format]'));
            return;
        }

        try {
            const [eventId, format = 'json'] = args;

            const votes = await Vote.find({ eventId })
                .populate('candidateId', 'name')
                .populate('userId', 'email firstName lastName')
                .sort({ createdAt: -1 });

            if (votes.length === 0) {
                console.log(chalk.yellow('No votes found for this event'));
                return;
            }

            const exportData = votes.map(vote => ({
                voteId: vote._id,
                candidate: vote.candidateId.name,
                voter: `${vote.userId.firstName} ${vote.userId.lastName}`,
                voterEmail: vote.userId.email,
                timestamp: vote.createdAt,
                verified: vote.isVerified || false
            }));

            const filename = `votes_${eventId}_${Date.now()}.${format}`;
            const fs = await import('fs');

            if (format === 'csv') {
                const headers = 'Vote ID,Candidate,Voter Name,Voter Email,Timestamp,Verified\n';
                const csvData = headers + exportData.map(row =>
                    `${row.voteId},${row.candidate},"${row.voter}",${row.voterEmail},${row.timestamp},${row.verified}`
                ).join('\n');

                fs.writeFileSync(filename, csvData);
            } else {
                fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
            }

            console.log(chalk.green(`✅ Votes exported to ${filename}`));
            console.log(chalk.blue(`Total records: ${exportData.length}`));
        } catch (error) {
            console.error(chalk.red('Error exporting votes:', error.message));
        }
    }

    async broadcastEmailCommand(args) {
        if (args.length < 2) {
            console.log(chalk.red('Usage: email:broadcast <subject> <body>'));
            return;
        }

        try {
            const [subject, ...bodyParts] = args;
            const body = bodyParts.join(' ');

            // Get all active users
            const users = await User.find({ isActive: true }).select('email firstName');

            console.log(chalk.yellow(`📧 Broadcasting email to ${users.length} users...`));

            let successCount = 0;
            let failureCount = 0;

            for (const user of users) {
                try {
                    await this.services.email.sendEmail({
                        to: user.email,
                        subject: subject,
                        html: `
                            <h2>Hello ${user.firstName || 'User'},</h2>
                            <p>${body}</p>
                            <br>
                            <p>Best regards,<br>ITFY E-Voting Team</p>
                        `
                    });
                    successCount++;
                } catch (error) {
                    console.error(chalk.red(`Failed to send to ${user.email}: ${error.message}`));
                    failureCount++;
                }

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log(chalk.green(`✅ Broadcast completed!`));
            console.log(chalk.blue(`Success: ${successCount}, Failures: ${failureCount}`));
        } catch (error) {
            console.error(chalk.red('Error broadcasting email:', error.message));
        }
    }

    async clearCacheCommand(args) {
        try {
            const pattern = args[0];

            if (pattern) {
                await this.services.cache.clearPattern(pattern);
                console.log(chalk.green(`✅ Cache cleared for pattern: ${pattern}`));
            } else {
                await this.services.cache.clearAll();
                console.log(chalk.green('✅ All cache cleared'));
            }
        } catch (error) {
            console.error(chalk.red('Error clearing cache:', error.message));
        }
    }

    async listPaymentsCommand(args) {
        try {
            const limit = parseInt(args[0]) || 10;
            const page = parseInt(args[1]) || 1;
            const skip = (page - 1) * limit;
            const status = args[2];

            let query = {};
            if (status) {
                query.status = status;
            }

            const result = await Payment.find(query)
                .populate('userId', 'email firstName lastName')
                .limit(limit)
                .skip(skip)
                .sort({ createdAt: -1 });

            const total = await Payment.countDocuments(query);

            console.log(chalk.cyan(`💰 Payments (Page ${page}, Showing ${result.length} of ${total})`));
            console.log(chalk.yellow('═'.repeat(80)));

            result.forEach(payment => {
                const statusColor = payment.status === 'success' ? chalk.green :
                    payment.status === 'failed' ? chalk.red : chalk.yellow;
                const user = payment.userId ? `${payment.userId.firstName} ${payment.userId.lastName}` : 'Unknown';

                console.log(`${statusColor(payment.status.padEnd(10))} ${payment.amount.toString().padEnd(10)} ${user.padEnd(25)} ${payment.createdAt.toDateString()}`);
            });
        } catch (error) {
            console.error(chalk.red('Error listing payments:', error.message));
        }
    }

    async paymentStatsCommand() {
        try {
            const totalPayments = await Payment.countDocuments();
            const successfulPayments = await Payment.countDocuments({ status: 'success' });
            const failedPayments = await Payment.countDocuments({ status: 'failed' });
            const pendingPayments = await Payment.countDocuments({ status: 'pending' });

            // Calculate total revenue
            const revenueData = await Payment.aggregate([
                { $match: { status: 'success' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

            console.log(chalk.cyan('💰 Payment Statistics'));
            console.log(chalk.yellow('═'.repeat(40)));
            console.log(`Total Payments: ${totalPayments}`);
            console.log(chalk.green(`Successful: ${successfulPayments}`));
            console.log(chalk.red(`Failed: ${failedPayments}`));
            console.log(chalk.yellow(`Pending: ${pendingPayments}`));
            console.log(`Total Revenue: GHS${totalRevenue.toLocaleString()}`);

            if (totalPayments > 0) {
                const successRate = ((successfulPayments / totalPayments) * 100).toFixed(2);
                console.log(`Success Rate: ${successRate}%`);
            }
        } catch (error) {
            console.error(chalk.red('Error getting payment stats:', error.message));
        }
    }

    async backupDbCommand(args) {
        try {
            const filename = args[0] || `backup_${Date.now()}.json`;

            console.log(chalk.yellow('🔄 Creating database backup...'));

            const collections = ['users', 'events', 'votes', 'candidates', 'payments', 'roles'];
            const backup = {};

            for (const collection of collections) {
                const Model = this.getModelByName(collection);
                if (Model) {
                    backup[collection] = await Model.find({}).lean();
                    console.log(chalk.blue(`✓ Backed up ${backup[collection].length} ${collection}`));
                }
            }

            const fs = await import('fs');
            fs.writeFileSync(filename, JSON.stringify(backup, null, 2));

            console.log(chalk.green(`✅ Database backup created: ${filename}`));
        } catch (error) {
            console.error(chalk.red('Error creating backup:', error.message));
        }
    }

    getModelByName(name) {
        const modelMap = {
            'users': User,
            'events': Event,
            'votes': Vote,
            'candidates': Candidate,
            'payments': Payment,
            'roles': Role
        };
        return modelMap[name];
    }

    async dbStatsCommand() {
        try {
            const stats = await dbConnection.getConnectionStats();
            console.log(chalk.cyan('🗄️  Database Statistics'));
            console.log(chalk.yellow('═'.repeat(40)));
            console.log(`Status: ${stats.status || 'Connected'}`);
            console.log(`Active Connections: ${stats.activeConnections || 'N/A'}`);

            // Get collection counts
            const userCount = await User.countDocuments();
            const eventCount = await Event.countDocuments();
            const voteCount = await Vote.countDocuments();
            const paymentCount = await Payment.countDocuments();
            const roleCount = await Role.countDocuments();

            console.log(`\nCollection Counts:`);
            console.log(`  Users: ${userCount}`);
            console.log(`  Events: ${eventCount}`);
            console.log(`  Votes: ${voteCount}`);
            console.log(`  Payments: ${paymentCount}`);
            console.log(`  Roles: ${roleCount}`);
        } catch (error) {
            console.error(chalk.red('Error getting database stats:', error.message));
        }
    }
}

// Install required packages if not present
async function checkAndInstallDependencies() {
    try {
        await import('chalk');
        await import('figlet');
    } catch (error) {
        console.log('Installing required dependencies...');
        const { exec } = await import('child_process');
        return new Promise((resolve, reject) => {
            exec('npm install chalk figlet', (error, stdout, stderr) => {
                if (error) {
                    console.error('Failed to install dependencies:', error);
                    reject(error);
                } else {
                    console.log('Dependencies installed successfully');
                    resolve();
                }
            });
        });
    }
}

// Main execution
async function main() {
    try {
        await checkAndInstallDependencies();
        const console = new AdminConsole();
        await console.init();
    } catch (error) {
        console.error('Failed to start admin console:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\nShutting down admin console...'));
    process.exit(0);
});

// Start the console if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default AdminConsole;