# Database Seeding Guide

This guide explains how to populate your ITFY E-Voting database with test data for development and testing purposes.

## Quick Start

1. **Ensure MongoDB is running** on your system
2. **Set up your environment variables** by copying from `email-config.env` to `.env`
3. **Run the seeding script**:
   ```bash
   npm run seed
   ```

## What Gets Created

The seeding script creates the following test data:

### 👥 Roles (6 roles)
- Super Admin (Level 100)
- Admin (Level 80)
- Event Manager (Level 60)
- Moderator (Level 40)
- User (Level 20)
- Voter (Level 10)

### 👤 Users (8 users)
- **superadmin@itfy.com** - Super Administrator
- **admin@itfy.com** - System Administrator
- **manager@itfy.com** - Event Manager
- **moderator@itfy.com** - Content Moderator
- **alice@example.com** - Regular User
- **bob@example.com** - Voter
- **carol@example.com** - Voter
- **david@example.com** - User

**Default Password for all users**: `password123`

### 📅 Events (3 events)
- ITFY Tech Awards 2025
- Best Developer Recognition 2025
- Community Choice Awards

### 🏷️ Categories (6 categories)
- Best Web Developer
- Best Mobile App Developer
- Best AI/ML Engineer
- Best DevOps Engineer
- Best UI/UX Designer
- Best Data Scientist

### 🏆 Candidates (4 candidates)
- Emily Rodriguez - Senior Full-Stack Developer
- James Chen - Frontend Architect
- Sarah Kim - Mobile Development Lead
- Dr. Michael Zhang - Principal AI Researcher

### 🎫 Coupons (3 coupons)
- **EARLY2025** - 25% off early bird discount
- **STUDENT50** - 50% off student discount
- **WELCOME10** - $10 off welcome bonus

### 🗳️ Votes & 💳 Payments
- Sample votes from various users
- Sample payment records with different statuses

## Advanced Usage

### Clear Database Only
To clear all existing data without seeding new data:
```bash
# This will be implemented if needed
node seed-database.js --clear-only
```

### Custom Environment
If you're using a different MongoDB URI or environment:
```bash
MONGODB_URI=mongodb://localhost:27017/custom-db npm run seed
```

## Testing the Seeded Data

After seeding, you can test the system with these login credentials:

### Administrative Access
```
Email: superadmin@itfy.com
Password: password123
Role: Super Admin (Full Access)
```

### Regular Testing
```
Email: alice@example.com
Password: password123
Role: User
```

### Voting Testing
```
Email: bob@example.com
Password: password123
Role: Voter
```

## Environment Setup

Make sure your `.env` file contains at least:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/itfy-evoting

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d

# Email (if testing email features)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running: `mongod` or `brew services start mongodb/brew/mongodb-community`
   - Check your MONGODB_URI in `.env`

2. **Permission Errors**
   - Make sure the script has execute permissions: `chmod +x seed-database.js`

3. **Missing Dependencies**
   - Run: `npm install`

4. **Seeding Fails Partially**
   - Clear the database and try again: `npm run seed`
   - Check MongoDB logs for specific errors

### Verification

After seeding, you can verify the data by:

1. **Using MongoDB Compass** or **mongo shell**:
   ```bash
   mongo itfy-evoting
   db.users.count()
   db.events.count()
   db.candidates.count()
   ```

2. **Using the application**:
   - Start the server: `npm start`
   - Login with test credentials
   - Browse events, candidates, and vote

## Development Notes

- The script automatically clears existing data before seeding
- All passwords are hashed using bcrypt with 12 salt rounds
- Candidates are automatically linked to categories and events
- Sample votes are created to simulate real usage
- All timestamps use realistic dates in 2025

## Contributing

When adding new seed data:

1. Follow the existing patterns in `seed-database.js`
2. Ensure all required fields are provided
3. Test the seeding process thoroughly
4. Update this README if you add new data types

---

**Need help?** Check the application logs or contact the development team.
