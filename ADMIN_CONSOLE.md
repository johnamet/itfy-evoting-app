# ITFY E-Voting Admin Console

A comprehensive command-line interface for managing the ITFY E-Voting application. This bash-like console provides administrators with powerful tools to manage users, events, voting data, payments, and system operations.

## Features

- 🔐 **Secure Authentication**: Key-based access with auto-creation of admin user profiles
- 👥 **User Management**: Complete CRUD operations for user accounts
- 📅 **Event Management**: Create, view, and manage voting events
- 🗳️ **Voting Operations**: Monitor votes, export data, and generate statistics
- 📧 **Email System**: Send individual emails or broadcast to all users
- 💰 **Payment Management**: View payment records and statistics
- 💾 **Cache Management**: Monitor and clear application cache
- 🗄️ **Database Operations**: View statistics and perform backups
- 📊 **Real-time Statistics**: Comprehensive system monitoring

## Installation

1. Install required dependencies:
```bash
npm install chalk figlet
```

2. Ensure your `.env` file has the required configuration:
```env
ADMIN_EMAIL=admin@itfy.com
JWT_SECRET=your-super-secret-jwt-key-here
MONGODB_URI=mongodb://localhost:27017/itfy-evoting
# ... other configurations
```

## Usage

### Starting the Console

```bash
# Using npm script
npm run admin

# Direct execution
node admin-console.js
```

### Authentication

- **Development**: Use the key `4673123`
- **Production**: A key will be sent to the admin email configured in `.env`

On first login, an admin user profile is automatically created.

## Available Commands

### System Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `help` | Show available commands | `help [command]` |
| `clear` | Clear the console | `clear` |
| `exit` | Exit the admin console | `exit` |
| `history` | Show command history | `history` |
| `status` | Show system status | `status` |
| `config` | Show configuration details | `config` |

### User Management

| Command | Description | Usage |
|---------|-------------|-------|
| `user:list` | List all users | `user:list [limit] [page]` |
| `user:create` | Create a new user | `user:create <email> <name> <password> [roleName]` |
| `user:find` | Find user by email or ID | `user:find <email\|id>` |
| `user:reset-password` | Reset user password | `user:reset-password <email>` |
| `user:change-role` | Change user role | `user:change-role <email> <roleName>` |

### Role Management

| Command | Description | Usage |
|---------|-------------|-------|
| `role:list` | List all roles | `role:list` |
| `role:create` | Create a new role | `role:create <name> <level>` |

### Event Management

| Command | Description | Usage |
|---------|-------------|-------|
| `event:list` | List all events | `event:list [limit] [page]` |
| `event:create` | Create a new event | `event:create <title> <description> <startDate> <endDate>` |
| `event:stats` | Show event statistics | `event:stats [eventId]` |

### Voting Operations

| Command | Description | Usage |
|---------|-------------|-------|
| `vote:stats` | Show voting statistics | `vote:stats [eventId]` |
| `vote:export` | Export voting data | `vote:export <eventId> [format]` |

### Email Management

| Command | Description | Usage |
|---------|-------------|-------|
| `email:send` | Send email to user(s) | `email:send <to> <subject> <body>` |
| `email:broadcast` | Broadcast email to all users | `email:broadcast <subject> <body>` |

### Cache Management

| Command | Description | Usage |
|---------|-------------|-------|
| `cache:stats` | Show cache statistics | `cache:stats` |
| `cache:clear` | Clear cache | `cache:clear [pattern]` |

### Payment Management

| Command | Description | Usage |
|---------|-------------|-------|
| `payment:list` | List payments | `payment:list [limit] [status]` |
| `payment:stats` | Show payment statistics | `payment:stats` |

### Database Operations

| Command | Description | Usage |
|---------|-------------|-------|
| `db:stats` | Show database statistics | `db:stats` |
| `db:backup` | Backup database | `db:backup [filename]` |

## Example Usage

### Creating a New User
```bash
itfy-admin> user:create john.doe@example.com "John Doe" temp123 admin
✅ User created successfully: john.doe@example.com
� Name: John Doe
🎭 Role: admin (Level 4)
🔑 Password: temp123 (User should change this)
```

### Listing Users
```bash
itfy-admin> user:list 5
👥 Users (Page 1, Showing 5 of 23)
════════════════════════════════════════════════════════════════════════════════
admin@itfy.com                System Administrator           admin (L4)
john.doe@example.com          John Doe                       user (L1)
jane.smith@example.com        Jane Smith                     user (L1)
```

### Managing Roles
```bash
itfy-admin> role:list
🎭 Available Roles
════════════════════════════════════════════════════
admin           Level 4
user            Level 1

itfy-admin> role:create moderator 2
✅ Role created successfully: moderator
Level: 2
```

### Sending Email
```bash
itfy-admin> email:send john.doe@example.com "Welcome" "Welcome to ITFY E-Voting!"
✅ Email sent to john.doe@example.com
```

### Getting Database Statistics
```bash
itfy-admin> db:stats
🗄️  Database Statistics
═══════════════════════════════════════════════════
Status: Connected
Active Connections: 1

Collection Counts:
  Users: 23
  Events: 5
  Votes: 1247
  Payments: 89
  Roles: 4
```

## Security Features

- 🔐 **Key-based Authentication**: Secure access control
- 👤 **Admin User Creation**: Automatic admin profile setup
- 🔒 **Permission Checking**: Role-based access control
- 📝 **Audit Logging**: Command history tracking
- 🛡️ **Environment Awareness**: Different behavior in dev/production

## Error Handling

The console includes comprehensive error handling:
- Database connection failures
- Invalid command syntax
- Permission denied operations
- Network connectivity issues
- Data validation errors

## Development

### Adding New Commands

1. Add command definition to `initializeCommands()` method
2. Implement the handler method
3. Update help documentation
4. Test the command functionality

### Command Structure

```javascript
'command:name': {
    description: 'Command description',
    usage: 'command:name <required> [optional]',
    handler: this.commandNameHandler.bind(this)
}
```

## Troubleshooting

### Connection Issues
```bash
# Check database connection
itfy-admin> status

# Verify configuration
itfy-admin> config
```

### Permission Errors
- Ensure admin user has proper permissions
- Check role assignments in database
- Verify JWT configuration

### Email Issues
- Verify SMTP configuration in `.env`
- Check email service credentials
- Test with `email:send` command

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add new commands or improvements
4. Test thoroughly
5. Submit a pull request

## License

This admin console is part of the ITFY E-Voting application and follows the same license terms.

## Support

For issues or questions about the admin console:
- Check the troubleshooting section
- Review command usage with `help <command>`
- Contact the development team

---

**Note**: Always use the admin console responsibly and ensure proper backups before performing bulk operations.
