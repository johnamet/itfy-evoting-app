#!/usr/bin/env node
/**
 * Database Seeding Script
 * 
 * This script populates the database with test data for development and testing purposes.
 * It creates roles, users, events, categories, candidates, vote bundles, coupons, payments, and votes.
 * Updated to include detailed speaker data for events with all Speaker interface fields (name, title, company, location, image, bio, expertise, socialLinks, achievements, speakingTopic) for both speaker and guest types.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import models
import User from './app/models/User.js';
import Role from './app/models/Role.js';
import Event from './app/models/Event.js';
import Category from './app/models/Category.js';
import Candidate from './app/models/Candidate.js';
import Vote from './app/models/Vote.js';
import VoteBundle from './app/models/VoteBundle.js';
import Payment from './app/models/Payment.js';
import Coupon from './app/models/Coupon.js';
import e from 'cors';

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/itfy-evoting';

class DatabaseSeeder {
    constructor() {
        this.createdData = {
            roles: [],
            users: [],
            events: [],
            categories: [],
            candidates: [],
            voteBundles: [],
            coupons: [],
            payments: [],
            votes: []
        };
    }

    async connect() {
        try {
            await mongoose.connect(MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('✅ Connected to MongoDB');
        } catch (error) {
            console.error('❌ MongoDB connection error:', error);
            process.exit(1);
        }
    }

    async disconnect() {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }

    async clearDatabase() {
        console.log('🧹 Clearing existing data...');
        
        try {
            await Vote.deleteMany({});
            await Payment.deleteMany({});
            await VoteBundle.deleteMany({});
            await Coupon.deleteMany({});
            await Candidate.deleteMany({});
            await Category.deleteMany({});
            await Event.deleteMany({});
            await User.deleteMany({});
            await Role.deleteMany({});
            
            console.log('✅ Database cleared');
        } catch (error) {
            console.error('❌ Error clearing database:', error);
            throw error;
        }
    }

    async seedRoles() {
        console.log('👥 Seeding roles...');
        
        const roles = [
            { name: 'Super Admin', level: 4 },
            { name: 'Admin', level: 3 },
            { name: 'Event Manager', level: 2 },
            { name: 'Moderator', level: 1 },
        ];

        for (const roleData of roles) {
            const role = new Role(roleData);
            const savedRole = await role.save();
            this.createdData.roles.push(savedRole);
            console.log(`  ✓ Created role: ${roleData.name} (Level: ${roleData.level})`);
        }
    }

    async seedUsers() {
        console.log('👤 Seeding users...');
        
        const saltRounds = 12;
        const defaultPassword = await bcrypt.hash('password123', saltRounds);
        
        const users = [
            {
                name: 'Super Administrator',
                email: 'superadmin@itfy.com',
                password: defaultPassword,
                role: this.createdData.roles.find(r => r.name === 'Super Admin')._id,
                isActive: true,
                bio: 'System super administrator with full access'
            },
            {
                name: 'Kwame Nkrumah',
                email: 'admin@itfy.com',
                password: defaultPassword,
                role: this.createdData.roles.find(r => r.name === 'Admin')._id,
                isActive: true,
                bio: 'System administrator based in Accra'
            },
            {
                name: 'Akosua Mensah',
                email: 'manager@itfy.com',
                password: defaultPassword,
                role: this.createdData.roles.find(r => r.name === 'Event Manager')._id,
                isActive: true,
                bio: 'Event management specialist from Kumasi'
            },
            {
                name: 'Kofi Annan',
                email: 'moderator@itfy.com',
                password: defaultPassword,
                role: this.createdData.roles.find(r => r.name === 'Moderator')._id,
                isActive: true,
                bio: 'Content moderator based in Tamale'
            },
            {
                name: 'Ama Boateng',
                email: 'ama@example.com',
                password: defaultPassword,
                role: this.createdData.roles.find(r => r.name === 'Moderator')._id,
                isActive: true,
                bio: 'Test voter account from Accra'
            },
            {
                name: 'Yaw Osei',
                email: 'yaw@example.com',
                password: defaultPassword,
                role: this.createdData.roles.find(r => r.name === 'Moderator')._id,
                isActive: true,
                bio: 'Test voter account from Cape Coast'
            }
        ];

        for (const userData of users) {
            const user = new User(userData);
            const savedUser = await user.save();
            this.createdData.users.push(savedUser);
            console.log(`  ✓ Created user: ${userData.name} (${userData.email})`);
        }
    }

    async seedEvents() {
        console.log('📅 Seeding events...');
        
        const adminUser = this.createdData.users.find(u => u.email === 'admin@itfy.com');
        const managerUser = this.createdData.users.find(u => u.email === 'manager@itfy.com');
        
        const events = [
            {
                name: 'Ghana Tech Awards 2025',
                description: 'The Ghana Tech Awards 2025 is a premier event celebrating the vibrant technology ecosystem in Ghana. This annual gathering brings together innovators, entrepreneurs, and tech enthusiasts to honor outstanding achievements in web development, mobile apps, AI, and more. Hosted in Accra, the event features keynote speeches, panel discussions, and a prestigious awards ceremony recognizing Ghana’s top tech talent. Attendees will network with industry leaders, explore cutting-edge innovations, and enjoy cultural performances that highlight Ghana’s rich heritage. The event aims to inspire the next generation of tech professionals and foster collaboration across the African tech landscape.',
                startDate: new Date('2025-09-15T09:00:00Z'),
                endDate: new Date('2025-09-15T18:00:00Z'),
                location: {
                    name: 'Accra International Conference Centre',
                    address: 'Independence Avenue',
                    city: 'Accra',
                    coordinates: { lat: 5.5536, lng: -0.2002 },
                    country: 'Ghana',
                    zipCode: 'GA-001',
                    website: 'https://www.aicc.com.gh',
                    phone: '+233-302-123456',
                    venueInfo: ['Modern conference facilities', 'Free Wi-Fi', 'Catering services', 'Air-conditioned halls'],
                    directions: ['15 minutes from Kotoka Airport', 'Trotro from Circle to Ridge', 'Parking available at venue']
                },
                gallery: [
                    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0', // Tech conference image
                    'https://images.unsplash.com/photo-1516321310762-479e750e4b92' // Event venue image
                ],
                isActive: true,
                isDeleted: false,
                createdBy: adminUser._id,
                updatedBy: adminUser._id,
                speakers: [
                    {
                        id: 1,
                        name: 'Dr. Nii Quaynor',
                        title: 'Internet Pioneer',
                        company: 'Ghana Dot Com',
                        location: 'Accra, Ghana',
                        image: 'https://via.placeholder.com/64?text=Nii+Quaynor',
                        bio: 'Dr. Nii Quaynor is a pioneer of internet development in Africa, known for establishing Ghana’s first internet service provider and advancing digital infrastructure.',
                        expertise: ['Internet Infrastructure', 'Network Engineering', 'ICT Policy'],
                        socialLinks: {
                            linkedin: 'https://linkedin.com/in/nii-quaynor',
                            twitter: 'https://twitter.com/nii_quaynor',
                        },
                        achievements: [
                            'Inducted into the Internet Hall of Fame 2012',
                            'Founded Ghana’s first ISP',
                            'Advised on Africa’s ICT policies',
                        ],
                        speakingTopic: 'The Future of Internet Connectivity in Africa',
                        type: 'speaker',
                    },
                    {
                        id: 2,
                        name: 'Esi Ansah',
                        title: 'CEO',
                        company: 'Axis Human Capital',
                        location: 'Accra, Ghana',
                        image: 'https://via.placeholder.com/64?text=Esi+Ansah',
                        bio: 'Esi Ansah is a leading HR and tech entrepreneur, driving workforce innovation and supporting tech talent development in Ghana.',
                        expertise: ['Human Resources', 'Tech Entrepreneurship', 'Talent Development'],
                        socialLinks: {
                            linkedin: 'https://linkedin.com/in/esi-ansah',
                            website: 'https://axishumancapital.com',
                        },
                        achievements: [
                            'Founded Axis Human Capital',
                            'Recognized as a Top Female Entrepreneur 2023',
                            'Mentored 100+ tech professionals',
                        ],
                        speakingTopic: 'Building a Tech Talent Pipeline in Ghana',
                        type: 'speaker',
                    },
                    {
                        id: 3,
                        name: 'Kwesi Appiah',
                        title: 'Minister of Digitalization',
                        company: 'Government of Ghana',
                        location: 'Accra, Ghana',
                        image: 'https://via.placeholder.com/64?text=Kwesi+Appiah',
                        bio: 'Kwesi Appiah oversees Ghana’s digital transformation initiatives, promoting policies to advance technology adoption nationwide.',
                        expertise: ['Digital Policy', 'Public Administration', 'Tech Advocacy'],
                        socialLinks: {
                            twitter: 'https://twitter.com/kwesi_appiah',
                        },
                        achievements: [
                            'Launched Ghana’s Digital Agenda 2024',
                            'Increased broadband access by 25% in Ghana',
                        ],
                        type: 'guest',
                    },
                ],
                relatedEvents: [], // Will be updated after all events are created
                categories: [], // Will be updated after categories are created
                status: 'active',
                timeline: [
                    {
                        title: 'Opening Ceremony',
                        description: 'Welcome address by dignitaries, followed by a cultural performance showcasing Ghanaian traditions.',
                        time: new Date('2025-09-15T09:00:00Z')
                    },
                    {
                        title: 'Keynote Speech',
                        description: 'Dr. Nii Quaynor discusses the future of internet technology in Africa.',
                        time: new Date('2025-09-15T10:00:00Z')
                    },
                    {
                        title: 'Awards Ceremony',
                        description: 'Honoring Ghana’s top tech innovators with awards in multiple categories.',
                        time: new Date('2025-09-15T15:00:00Z')
                    }
                ],
                maxParticipants: 1200,
                registrationFee: 150, // In GHS
                organizers: [adminUser._id, managerUser._id],
                sponsors: [
                    {
                        name: 'MTN Ghana',
                        logo: 'https://tse3.mm.bing.net/th/id/OIP.uXyjGhsonJpZgpg551b-nAHaE8',
                        level: 'platinum',
                        website: 'https://mtn.com.gh'
                    },
                    {
                        name: 'Vodafone Ghana',
                        logo: 'https://w7.pngwing.com/pngs/360/700/png-transparent-vodafone-mobile-phones-ono-mobile-phone-signal-broadband-others-text-trademark-logo.png',
                        level: 'gold',
                        website: 'https://vodafone.com.gh'
                    }
                ],
                requirements: ['Business attire', 'Pre-registration required', 'ID verification'],
                registrationDeadline: new Date('2025-09-10T23:59:59Z'),
                eventType: 'voting',
                tags: ['technology', 'awards', 'Ghana', 'innovation', 'networking'],
                socialLinks: {
                    website: 'https://ghanatechawards.com',
                    facebook: 'https://facebook.com/ghanatechawards',
                    twitter: 'https://twitter.com/ghanatech',
                    linkedin: 'https://linkedin.com/company/ghanatechawards',
                    youtube: 'https://youtube.com/channel/ghanatechawards'
                }
            },
            {
                name: 'Ashanti Innovation Summit 2025',
                description: 'The Ashanti Innovation Summit 2025 is a dynamic platform showcasing technological advancements and startup ecosystems in the Ashanti Region. Held in Kumasi, this summit brings together entrepreneurs, developers, and investors to explore emerging trends in mobile apps, AI, and fintech. The event includes startup pitches, workshops, and networking sessions aimed at fostering collaboration and innovation. Attendees will experience the vibrant tech scene of Kumasi, with opportunities to connect with local talent and learn from industry leaders. Cultural displays and local cuisine will enhance the experience, celebrating the rich heritage of the Ashanti Region while driving forward Ghana’s tech agenda.',
                startDate: new Date('2025-10-20T10:00:00Z'),
                endDate: new Date('2025-10-20T16:00:00Z'),
                location: {
                    name: 'Baba Yara Sports Stadium Conference Hall',
                    address: 'Otumfuo Road',
                    city: 'Kumasi',
                    coordinates: { lat: 6.6885, lng: -1.6240 },
                    country: 'Ghana',
                    zipCode: 'AK-039',
                    website: 'https://babayara.com',
                    phone: '+233-322-987654',
                    venueInfo: ['Spacious event halls', 'On-site catering', 'Ample parking', 'Accessible facilities'],
                    directions: ['Near Baba Yara Stadium', 'Trotro from Kejetia Market', 'Accessible via Uber/Bolt']
                },
                gallery: [
                    'https://images.unsplash.com/photo-1542744094-3ea9c1f8b5e8', // Startup event image
                    'https://images.unsplash.com/photo-1753808645481-070fba323120' // Conference venue image
                ],
                isActive: true,
                isDeleted: false,
                createdBy: managerUser._id,
                updatedBy: managerUser._id,
                speakers: [
                    {
                        id: 4,
                        name: 'Kwasi Agyeman',
                        title: 'Tech Entrepreneur',
                        company: 'Kumasi Tech Hub',
                        location: 'Kumasi, Ghana',
                        image: 'https://via.placeholder.com/64?text=Kwasi+Agyeman',
                        bio: 'Kwasi Agyeman is the founder of Kumasi Tech Hub, driving innovation and supporting startups in the Ashanti Region with a focus on agritech and fintech.',
                        expertise: ['Agritech', 'Fintech', 'Startup Incubation'],
                        socialLinks: {
                            linkedin: 'https://linkedin.com/in/kwasi-agyeman',
                            website: 'https://kumasitechhub.org',
                        },
                        achievements: [
                            'Founded Kumasi Tech Hub',
                            'Secured $1M for agritech startups',
                            'Mentored 50+ entrepreneurs in Ashanti',
                        ],
                        speakingTopic: 'Fostering Innovation in Ghana’s Startup Ecosystem',
                        type: 'speaker',
                    },
                    {
                        id: 5,
                        name: 'Akosua Yeboah',
                        title: 'Product Manager',
                        company: 'Zipline Ghana',
                        location: 'Kumasi, Ghana',
                        image: 'https://via.placeholder.com/64?text=Akosua+Yeboah',
                        bio: 'Akosua Yeboah leads product development for drone delivery systems at Zipline, enhancing healthcare logistics in Ghana.',
                        expertise: ['Product Management', 'Drone Technology', 'Healthcare Logistics'],
                        socialLinks: {
                            linkedin: 'https://linkedin.com/in/akosua-yeboah',
                            twitter: 'https://twitter.com/akosua_yeboah',
                        },
                        achievements: [
                            'Scaled Zipline’s delivery to 150+ hospitals',
                            'Won Product Innovation Award 2024',
                        ],
                        speakingTopic: 'Drones for Healthcare Delivery in Africa',
                        type: 'speaker',
                    },
                    {
                        id: 6,
                        name: 'Nana Adomako',
                        title: 'Regional Governor',
                        company: 'Ashanti Regional Administration',
                        location: 'Kumasi, Ghana',
                        image: 'https://via.placeholder.com/64?text=Nana+Adomako',
                        bio: 'Nana Adomako oversees regional development, including tech initiatives to empower youth in the Ashanti Region.',
                        expertise: ['Public Policy', 'Regional Development', 'Tech Advocacy'],
                        socialLinks: {
                            twitter: 'https://twitter.com/nana_adomako',
                        },
                        achievements: [
                            'Launched Ashanti Tech Incubator',
                            'Supported 30+ startups in Kumasi',
                        ],
                        type: 'guest',
                    },
                ],
                relatedEvents: [], // Will be updated after all events are created
                categories: [], // Will be updated after categories are created
                status: 'active',
                timeline: [
                    {
                        title: 'Startup Showcase',
                        description: 'Pitching session by Ashanti-based tech startups to investors and industry experts.',
                        time: new Date('2025-10-20T10:00:00Z')
                    },
                    {
                        title: 'Fintech Workshop',
                        description: 'Interactive session on building scalable fintech solutions for Ghana’s market.',
                        time: new Date('2025-10-20T12:00:00Z')
                    }
                ],
                maxParticipants: 800,
                registrationFee: 100, // In GHS
                organizers: [managerUser._id],
                sponsors: [
                    {
                        name: 'Asaase Radio',
                        logo: 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Asaase_Radio_logo.png',
                        level: 'silver',
                        website: 'https://asaaseradio.com'
                    }
                ],
                requirements: ['Laptop recommended', 'Registration required', 'Smart casual attire'],
                registrationDeadline: new Date('2025-10-15T23:59:59Z'),
                eventType: 'conference',
                tags: ['startups', 'innovation', 'Ashanti', 'technology', 'fintech'],
                socialLinks: {
                    website: 'https://ashantiinnovationsummit.com',
                    twitter: 'https://twitter.com/ashantisummit',
                    linkedin: 'https://linkedin.com/company/ashantisummit'
                }
            },
            {
                name: 'Northern Tech Community Awards',
                description: 'The Northern Tech Community Awards 2025 is a landmark event recognizing the contributions of tech professionals and community leaders in Northern Ghana. Held in Tamale, this event celebrates achievements in AI, education technology, and community-driven tech initiatives. It features an awards ceremony, panel discussions on tech for social impact, and networking opportunities with local innovators. The event aims to highlight the growing tech ecosystem in Northern Ghana, empower youth through technology, and showcase solutions addressing regional challenges like agriculture and healthcare. Attendees will enjoy cultural performances and local cuisine, making it a vibrant celebration of Northern Ghana’s tech and cultural heritage.',
                startDate: new Date('2025-11-10T08:00:00Z'),
                endDate: new Date('2025-11-10T20:00:00Z'),
                location: {
                    name: 'Tamale Convention Center',
                    address: 'Tamale-Daboya Road',
                    city: 'Tamale',
                    coordinates: { lat: 9.4034, lng: -0.8422 },
                    country: 'Ghana',
                    zipCode: 'NT-001',
                    website: 'https://tamaleconvention.com',
                    phone: '+233-372-000000',
                    venueInfo: ['Modern conference spaces', 'Free Wi-Fi', 'Accessible facilities'],
                    directions: ['Near Tamale Teaching Hospital', 'Trotro from Tamale Central', 'Parking available']
                },
                gallery: [
                    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4', // Community event image
                    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e' // Venue exterior
                ],
                isActive: true,
                isDeleted: false,
                createdBy: adminUser._id,
                updatedBy: adminUser._id,
                speakers: [
                    {
                        id: 7,
                        name: 'Fatima Yakubu',
                        title: 'Community Leader',
                        company: 'Northern Tech Initiative',
                        location: 'Tamale, Ghana',
                        image: 'https://via.placeholder.com/64?text=Fatima+Yakubu',
                        bio: 'Fatima Yakubu is an advocate for tech education and community development, leading initiatives to empower youth in Northern Ghana.',
                        expertise: ['Tech Education', 'Community Development', 'Social Impact'],
                        socialLinks: {
                            linkedin: 'https://linkedin.com/in/fatima-yakubu',
                            twitter: 'https://twitter.com/fatima_yakubu',
                        },
                        achievements: [
                            'Founded Northern Tech Initiative',
                            'Trained 1000+ youth in coding',
                            'Received Community Impact Award 2023',
                        ],
                        speakingTopic: 'Empowering Northern Ghana Through Technology',
                        type: 'speaker',
                    },
                    {
                        id: 8,
                        name: 'Idris Mohammed',
                        title: 'AI Researcher',
                        company: 'Vodafone Ghana',
                        location: 'Tamale, Ghana',
                        image: 'https://via.placeholder.com/64?text=Idris+Mohammed',
                        bio: 'Idris Mohammed develops AI-driven solutions for telecom analytics, focusing on predictive modeling for customer engagement.',
                        expertise: ['Artificial Intelligence', 'Data Science', 'Predictive Analytics'],
                        socialLinks: {
                            linkedin: 'https://linkedin.com/in/idris-mohammed',
                            website: 'https://idrismohammed.ai',
                        },
                        achievements: [
                            'Optimized Vodafone’s customer retention model',
                            'Published 3 papers on AI in telecom',
                        ],
                        speakingTopic: 'AI for Telecom Innovation in Ghana',
                        type: 'speaker',
                    },
                    {
                        id: 9,
                        name: 'Aminu Alhassan',
                        title: 'Regional Director',
                        company: 'Northern Regional Administration',
                        location: 'Tamale, Ghana',
                        image: 'https://via.placeholder.com/64?text=Aminu+Alhassan',
                        bio: 'Aminu Alhassan promotes tech-driven development in Northern Ghana, supporting community-led innovation projects.',
                        expertise: ['Public Policy', 'Regional Development', 'Community Engagement'],
                        socialLinks: {
                            twitter: 'https://twitter.com/aminu_alhassan',
                        },
                        achievements: [
                            'Launched Tamale Tech Hub',
                            'Supported 20+ community tech projects',
                        ],
                        type: 'guest',
                    },
                ],
                relatedEvents: [], // Will be updated after all events are created
                categories: [], // Will be updated after categories are created
                status: 'active',
                timeline: [
                    {
                        title: 'Community Awards Ceremony',
                        description: 'Honoring local tech contributors with awards and recognition.',
                        time: new Date('2025-11-10T08:00:00Z')
                    },
                    {
                        title: 'Tech for Social Impact Panel',
                        description: 'Discussion on leveraging technology for agriculture and healthcare in Northern Ghana.',
                        time: new Date('2025-11-10T10:00:00Z')
                    }
                ],
                maxParticipants: 500,
                registrationFee: 50, // In GHS
                organizers: [adminUser._id],
                sponsors: [
                    {
                        name: 'NITA Ghana',
                        logo: 'https://th.bing.com/th/id/R.0058dd040ee4a22c08df1b9d2146dd39?rik=MJXEiNRVfDIZHQ&pid=ImgRaw&r=0',
                        level: 'bronze',
                        website: 'https://nita.gov.gh'
                    }
                ],
                requirements: ['Smart casual attire', 'Free registration', 'ID verification'],
                registrationDeadline: new Date('2025-11-09T23:59:59Z'),
                eventType: 'voting',
                tags: ['community', 'awards', 'Northern Ghana', 'technology', 'social impact'],
                socialLinks: {
                    website: 'https://northerntechawards.com',
                    youtube: 'https://youtube.com/northerntech',
                    twitter: 'https://twitter.com/northerntechawards'
                }
            }
        ];

        for (const eventData of events) {
            const event = new Event(eventData);
            const savedEvent = await event.save();
            this.createdData.events.push(savedEvent);
            console.log(`  ✓ Created event: ${eventData.name}`);
        }

        // Update relatedEvents and categories after all events are created
        const savedEvents = this.createdData.events;
        await Event.findByIdAndUpdate(savedEvents[0]._id, {
            relatedEvents: [savedEvents[1]._id, savedEvents[2]._id],
            categories: this.createdData.categories.filter(c => c.event.toString() === savedEvents[0]._id.toString()).map(c => c._id)
        });
        await Event.findByIdAndUpdate(savedEvents[1]._id, {
            relatedEvents: [savedEvents[0]._id, savedEvents[2]._id],
            categories: this.createdData.categories.filter(c => c.event.toString() === savedEvents[1]._id.toString()).map(c => c._id)
        });
        await Event.findByIdAndUpdate(savedEvents[2]._id, {
            relatedEvents: [savedEvents[0]._id, savedEvents[1]._id],
            categories: this.createdData.categories.filter(c => c.event.toString() === savedEvents[2]._id.toString()).map(c => c._id)
        });
    }

    async seedCategories() {
        console.log('🏷️ Seeding categories...');
        
        const adminUser = this.createdData.users.find(u => u.email === 'admin@itfy.com');
        const event = this.createdData.events[0]; // Ghana Tech Awards 2025
        const event2 = this.createdData.events[1]; // Ashanti Innovation Summit 2025
        const event3 = this.createdData.events[2]; // Northern Tech Community Awards
        const categories = [
            {
                name: 'Best Ghanaian Web Developer',
                description: 'Recognizing excellence in web development across Ghana',
                icon: '🌐',
                event: event._id,
                createdBy: adminUser._id,
                updatedBy: adminUser._id,
                status: 'active',
                isActive: true,
                maxVotesPerUser: 5,
                votingStartDate: '2025-09-01T00:00:00Z',
                votingEndDate: '2025-09-15T23:59:59Z',
                order: 1,
                color: '#1E90FF',
                criteria: ['Code quality', 'Innovation', 'Impact'],
                isPublic: true,
                allowMultipleVotes: true,
                requirePayment: true,
                minVoteBundle: 1
            },
            {
                name: 'Best Mobile App Developer',
                description: 'Outstanding mobile application development in Ghana',
                icon: '📱',
                event: event2._id,
                createdBy: adminUser._id,
                updatedBy: adminUser._id,
                status: 'active',
                isActive: true,
                maxVotesPerUser: 3,
                votingStartDate: '2025-10-01T00:00:00Z',
                votingEndDate: '2025-10-20T23:59:59Z',
                order: 2,
                color: '#FF4500',
                criteria: ['App performance', 'User experience', 'Innovation'],
                isPublic: true,
                allowMultipleVotes: true,
                requirePayment: true,
                minVoteBundle: 1
            },
            {
                name: 'Best AI/ML Innovator',
                description: 'Innovation in AI and machine learning in Northern Ghana',
                icon: '🤖',
                event: event3._id,
                createdBy: adminUser._id,
                updatedBy: adminUser._id,
                status: 'active',
                isActive: true,
                maxVotesPerUser: 10,
                votingStartDate: '2025-11-01T00:00:00Z',
                votingEndDate: '2025-11-10T23:59:59Z',
                order: 3,
                color: '#32CD32',
                criteria: ['Model accuracy', 'Innovation', 'Community impact'],
                isPublic: true,
                allowMultipleVotes: true,
                requirePayment: false,
                minVoteBundle: 0
            },
            {
                name: 'Best DevOps Engineer',
                description: 'Excellence in DevOps practices in Ghana',
                icon: '⚙️',
                event: event._id,
                createdBy: adminUser._id,
                updatedBy: adminUser._id,
                status: 'active',
                isActive: true,
                maxVotesPerUser: 5,
                votingStartDate: '2025-09-01T00:00:00Z',
                votingEndDate: '2025-09-15T23:59:59Z',
                order: 4,
                color: '#FFD700',
                criteria: ['Automation', 'Reliability', 'Efficiency'],
                isPublic: true,
                allowMultipleVotes: true,
                requirePayment: true,
                minVoteBundle: 1
            },
            {
                name: 'Best UI/UX Designer',
                description: 'Outstanding UI/UX design in Ghana’s tech industry',
                icon: '🎨',
                event: event._id,
                createdBy: adminUser._id,
                updatedBy: adminUser._id,
                status: 'active',
                isActive: true,
                maxVotesPerUser: 5,
                votingStartDate: '2025-09-01T00:00:00Z',
                votingEndDate: '2025-09-15T23:59:59Z',
                order: 5,
                color: '#FF69B4',
                criteria: ['Design aesthetics', 'Usability', 'Innovation'],
                isPublic: true,
                allowMultipleVotes: true,
                requirePayment: true,
                minVoteBundle: 1
            },
            {
                name: 'Best Data Scientist',
                description: 'Excellence in data science and analytics in Ghana',
                icon: '📊',
                event: event2._id,
                createdBy: adminUser._id,
                updatedBy: adminUser._id,
                status: 'active',
                isActive: true,
                maxVotesPerUser: 3,
                votingStartDate: '2025-10-01T00:00:00Z',
                votingEndDate: '2025-10-20T23:59:59Z',
                order: 6,
                color: '#4682B4',
                criteria: ['Data insights', 'Methodology', 'Impact'],
                isPublic: true,
                allowMultipleVotes: true,
                requirePayment: true,
                minVoteBundle: 1
            }
        ];

        for (const categoryData of categories) {
            const category = new Category(categoryData);
            const savedCategory = await category.save();
            this.createdData.categories.push(savedCategory);
            console.log(`  ✓ Created category: ${categoryData.name}`);
        }
        event2.categories = this.createdData.categories.filter(c => c.event === event2._id).map(c => c._id);
        event3.categories = this.createdData.categories.filter(c => c.event === event3._id).map(c => c._id);
        await event2.save();
        await event3.save();
        event.categories = this.createdData.categories.filter(c => c.event === event._id).map(c => c._id);
        await event.save();
        console.log('✅ Categories seeded successfully', this.createdData.categories.filter(c => c.event === event._id));
    }

    async seedCandidates() {
        console.log('🏆 Seeding candidates...');
        
        const events = this.createdData.events;
        const categories = this.createdData.categories;
        
        const candidates = [
            // Web Developer candidates
            {
                name: 'Abena Serwaa',
                title: 'Senior Full-Stack Developer',
                bio: 'Expert in building scalable web applications with React and Django.',
                location: 'Accra, Ghana',
                cId: 'CAND001',
                nominatedBy: 'Ghana Tech Hub',
                event: events[0]._id,
                categories: [categories.find(c => c.name === 'Best Ghanaian Web Developer')._id],
                skills: ['React', 'Django', 'TypeScript', 'AWS', 'MongoDB'],
                socialLinks: {
                    github: 'https://github.com/abenaserwaa',
                    linkedin: 'https://linkedin.com/in/abenaserwaa',
                    twitter: 'https://twitter.com/abena_dev'
                },
                education: {
                    degree: 'BSc Computer Science',
                    university: 'University of Ghana',
                    year: '2016'
                },
                experience: {
                    current: 'Senior Developer at Ghana Tech Hub',
                    years: 8,
                    previousRoles: ['Junior Developer', 'Web Developer']
                },
                achievements: {
                    awards: ['Ghana Tech Innovation Award 2023', 'Web Developer of the Year 2022'],
                    projects: ['E-voting Platform', 'Ghana Health Portal']
                },
                photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
                status: 'approved',
                isActive: true
            },
            {
                name: 'Kofi Mensah',
                title: 'Frontend Architect',
                bio: 'Specializes in modern JavaScript frameworks and UI optimization.',
                location: 'Kumasi, Ghana',
                cId: 'CAND002',
                nominatedBy: 'Kumasi Tech Collective',
                event: events[0]._id,
                categories: [categories.find(c => c.name === 'Best Ghanaian Web Developer')._id],
                skills: ['Vue.js', 'React', 'JavaScript', 'Tailwind CSS', 'Webpack'],
                socialLinks: {
                    github: 'https://github.com/kofimensah',
                    linkedin: 'https://linkedin.com/in/kofimensah'
                },
                education: {
                    degree: 'MSc Software Engineering',
                    university: 'KNUST',
                    year: '2018'
                },
                experience: {
                    current: 'Frontend Architect at Kumasi Tech Collective',
                    years: 6,
                    previousRoles: ['Frontend Developer', 'UI Developer']
                },
                achievements: {
                    awards: ['Ashanti Tech Excellence Award 2023'],
                    projects: ['Educational Dashboard', 'E-commerce Platform']
                },
                photo: 'https://images.unsplash.com/photo-1506794778202-cbfcc65c5967',
                status: 'approved',
                isActive: true
            },
            // Mobile App Developer candidates
            {
                name: 'Efia Owusu',
                title: 'Mobile Development Lead',
                bio: 'Expert in cross-platform mobile apps with a focus on user experience.',
                location: 'Accra, Ghana',
                cId: 'CAND003',
                nominatedBy: 'MobileTech Ghana',
                event: events[1]._id,
                categories: [categories.find(c => c.name === 'Best Mobile App Developer')._id],
                skills: ['React Native', 'Flutter', 'Kotlin', 'Swift', 'Firebase'],
                socialLinks: {
                    github: 'https://github.com/efiaowusu',
                    linkedin: 'https://linkedin.com/in/efiaowusu'
                },
                education: {
                    degree: 'BSc Mobile Computing',
                    university: 'Ashesi University',
                    year: '2019'
                },
                experience: {
                    current: 'Mobile Lead at MobileTech Ghana',
                    years: 5,
                    previousRoles: ['Mobile Developer', 'Junior Android Developer']
                },
                achievements: {
                    awards: ['Mobile Innovation Award 2024'],
                    projects: ['GhanaPay App', 'Health Monitoring App']
                },
                photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
                status: 'approved',
                isActive: true
            },
            // AI/ML Innovator candidates
            {
                name: 'Dr. Aminu Ibrahim',
                title: 'AI Researcher',
                bio: 'PhD in AI with focus on machine learning for agriculture in Northern Ghana.',
                location: 'Tamale, Ghana',
                cId: 'CAND004',
                nominatedBy: 'Northern Tech Initiative',
                event: events[2]._id,
                categories: [categories.find(c => c.name === 'Best AI/ML Innovator')._id],
                skills: ['Python', 'TensorFlow', 'PyTorch', 'Computer Vision', 'NLP'],
                socialLinks: {
                    github: 'https://github.com/aminuibrahim',
                    linkedin: 'https://linkedin.com/in/aminuibrahim'
                },
                education: {
                    degree: 'PhD Artificial Intelligence',
                    university: 'University for Development Studies',
                    year: '2020'
                },
                experience: {
                    current: 'AI Researcher at Northern Tech Initiative',
                    years: 7,
                    previousRoles: ['Data Scientist', 'ML Engineer']
                },
                achievements: {
                    awards: ['Northern Innovation Award 2023'],
                    projects: ['Crop Yield Prediction System', 'Health Diagnostics AI']
                },
                photo: 'https://images.unsplash.com/photo-1517841902196-19c36708386b',
                status: 'approved',
                isActive: true
            }
        ];

        for (const candidateData of candidates) {
            const candidate = new Candidate(candidateData);
            const savedCandidate = await candidate.save();
            this.createdData.candidates.push(savedCandidate);
            
            // Update category with candidate reference
            const category = await Category.findById(candidateData.categories[0]);
            category.candidates.push(savedCandidate._id);
            await category.save();
            
            console.log(`  ✓ Created candidate: ${candidateData.name} (${candidateData.title})`);
        }
    }

    async seedCoupons() {
        console.log('🎫 Seeding coupons...');
        
        const adminUser = this.createdData.users.find(u => u.email === 'admin@itfy.com');
        const events = this.createdData.events;
        const categories = this.createdData.categories;
        
        const coupons = [
            {
                code: 'GHANA2025',
                description: 'Discount for Ghana Tech Awards 2025',
                discountType: 'percentage',
                discount: 20,
                isActive: true,
                expiryDate: new Date('2025-12-31T23:59:59Z'),
                maxUses: 100,
                usedCount: 10,
                minOrderAmount: 50,
                eventApplicable: events[0]._id,
                categoriesApplicable: [
                    categories.find(c => c.name === 'Best Ghanaian Web Developer')._id,
                    categories.find(c => c.name === 'Best DevOps Engineer')._id,
                    categories.find(c => c.name === 'Best UI/UX Designer')._id
                ],
                createdBy: adminUser._id
            },
            {
                code: 'ASHANTI50',
                description: 'Student discount for Ashanti Innovation Summit',
                discountType: 'percentage',
                discount: 50,
                isActive: true,
                expiryDate: new Date('2025-12-31T23:59:59Z'),
                maxUses: 50,
                usedCount: 5,
                minOrderAmount: 30,
                eventApplicable: events[1]._id,
                categoriesApplicable: [
                    categories.find(c => c.name === 'Best Mobile App Developer')._id,
                    categories.find(c => c.name === 'Best Data Scientist')._id
                ],
                createdBy: adminUser._id
            },
            {
                code: 'NORTHERN10',
                description: 'Welcome bonus for Northern Tech Awards',
                discountType: 'fixed',
                discount: 10,
                isActive: true,
                expiryDate: new Date('2025-12-31T23:59:59Z'),
                maxUses: 200,
                usedCount: 20,
                minOrderAmount: 20,
                eventApplicable: events[2]._id,
                categoriesApplicable: [
                    categories.find(c => c.name === 'Best AI/ML Innovator')._id
                ],
                createdBy: adminUser._id
            }
        ];

        for (const couponData of coupons) {
            const coupon = new Coupon(couponData);
            const savedCoupon = await coupon.save();
            this.createdData.coupons.push(savedCoupon);
            console.log(`  ✓ Created coupon: ${couponData.code} (${couponData.discount}${couponData.discountType === 'percentage' ? '%' : ' GHS'} off)`);
        }
    }

    async seedVoteBundles() {
        console.log('📦 Seeding vote bundles...');
        
        const adminUser = this.createdData.users.find(u => u.email === 'admin@itfy.com');
        const events = this.createdData.events;
        const categories = this.createdData.categories;
        const coupons = this.createdData.coupons;
        
        const bundles = [
            {
                name: 'Standard Voting Bundle',
                description: 'Includes 10 votes for any candidate in the event',
                price: 20,
                currency: 'GHS',
                features: ['10 votes', 'Access to all categories'],
                applicableEvents: [events[0]._id, events[1]._id],
                applicableCategories: categories.map(c => c._id),
                applicableCoupons: [coupons[0]._id, coupons[1]._id],
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                votes: 10,
                createdBy: adminUser._id,
                validityPeriod: 30,
                popular: true
            },
            {
                name: 'Premium Voting Bundle',
                description: 'Includes 50 votes for any candidate in the event',
                price: 80,
                currency: 'GHS',
                features: ['50 votes', 'Access to all categories', 'Priority support'],
                applicableEvents: [events[0]._id, events[1]._id],
                applicableCoupons: [coupons[0]._id, coupons[2]._id],
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                votes: 50,
                createdBy: adminUser._id,
                validityPeriod: 60,
                popular: true
            },
            {
                name: 'Basic Voting Bundle',
                description: 'Includes 5 votes for any candidate in the event',
                price: 10,
                currency: 'GHS',
                features: ['5 votes', 'Access to all categories'],
                applicableEvents: [events[2]._id],
                applicableCategories: categories.map(c => c._id),
                applicableCoupons: [coupons[1]._id],
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                votes: 5,
                createdBy: adminUser._id,
                validityPeriod: 15,
                popular: false
            }
        ];

        for (const bundleData of bundles) {
            const bundle = new VoteBundle(bundleData);
            const savedBundle = await bundle.save();
            this.createdData.voteBundles.push(savedBundle);
            console.log(`  ✓ Created vote bundle: ${bundleData.name} (${bundleData.votes} votes, ${bundleData.price} ${bundleData.currency})`);
        }
    }

    async seedPayments() {
        console.log('💳 Seeding payments...');
        
        const voters = [
            { name: 'Ama Boateng', email: 'ama@example.com', ipAddress: '192.168.1.1' },
            { name: 'Yaw Osei', email: 'yaw@example.com', ipAddress: '192.168.1.2' },
            { name: 'Esi Adom', email: 'esi@example.com', ipAddress: '192.168.1.3' },
            { name: 'Kojo Mensah', email: 'kojo@example.com', ipAddress: '192.168.1.4' }
        ];
        
        const candidates = this.createdData.candidates;
        const events = this.createdData.events;
        const categories = this.createdData.categories;
        const voteBundles = this.createdData.voteBundles;
        const coupons = this.createdData.coupons;
        
        const payments = [
            {
                reference: `PAY_${Date.now()}_AMA1`,
                voter: voters[0],
                voteBundles: [voteBundles[0]._id],
                event: events[0]._id,
                category: categories.find(c => c.name === 'Best Ghanaian Web Developer')._id,
                coupon: coupons.find(c => c.code === 'GHANA2025')._id,
                originalAmount: 20,
                discountAmount: 4,
                finalAmount: 16,
                currency: 'GHS',
                votesRemaining: 10,
                votesData: [
                    {
                        candidate: candidates.find(c => c.name === 'Abena Serwaa')._id,
                        votesUsed: 8
                    },
                    {
                        candidate: candidates.find(c => c.name === 'Kofi Mensah')._id,
                        votesUsed: 2
                    }
                ],
                status: 'success',
                paidAt: new Date(),
                paystackData: {
                    transaction_id: 'txn_1234567890',
                    authorization_url: 'https://paystack.com/pay/test1',
                    access_code: 'test_access_code_1',
                    gateway_response: 'Payment successful',
                    channel: 'card',
                    fees: 0.5,
                    customer: { email: voters[0].email }
                },
                metadata: {
                    fraud_check: { passed: true, reasons: [] }
                }
            },
            {
                reference: `PAY_${Date.now()}_YAW1`,
                voter: voters[1],
                voteBundles: [voteBundles[1]._id],
                event: events[1]._id,
                category: categories.find(c => c.name === 'Best Mobile App Developer')._id,
                coupon: null,
                originalAmount: 80,
                discountAmount: 0,
                finalAmount: 80,
                currency: 'GHS',
                votesRemaining: 50,
                votesData: [
                    {
                        candidate: candidates.find(c => c.name === 'Efia Owusu')._id,
                        votesUsed: 50
                    }
                ],
                status: 'success',
                paidAt: new Date(),
                paystackData: {
                    transaction_id: 'txn_0987654321',
                    authorization_url: 'https://paystack.com/pay/test2',
                    access_code: 'test_access_code_2',
                    gateway_response: 'Payment successful',
                    channel: 'card',
                    fees: 1.2,
                    customer: { email: voters[1].email }
                },
                metadata: {
                    fraud_check: { passed: true, reasons: [] }
                }
            },
            {
                reference: `PAY_${Date.now()}_ESI1`,
                voter: voters[2],
                voteBundles: [voteBundles[2]._id],
                event: events[2]._id,
                category: categories.find(c => c.name === 'Best AI/ML Innovator')._id,
                coupon: coupons.find(c => c.code === 'NORTHERN10')._id,
                originalAmount: 10,
                discountAmount: 2,
                finalAmount: 8,
                currency: 'GHS',
                votesRemaining: 5,
                votesData: [
                    {
                        candidate: candidates.find(c => c.name === 'Dr. Aminu Ibrahim')._id,
                        votesUsed: 5
                    }
                ],
                status: 'pending',
                paidAt: new Date(),
                paystackData: {
                    transaction_id: 'txn_1122334455',
                    authorization_url: 'https://paystack.com/pay/test3',
                    access_code: 'test_access_code_3',
                    gateway_response: 'Pending',
                    channel: 'bank_transfer'
                },
                metadata: {
                    fraud_check: { passed: true, reasons: [] }
                }
            }
        ];

        for (const paymentData of payments) {
            const payment = new Payment(paymentData);
            const savedPayment = await payment.save();
            this.createdData.payments.push(savedPayment);
            console.log(`  ✓ Created payment: ${paymentData.reference} (${paymentData.finalAmount} ${paymentData.currency})`);
        }
        console.log(`  ✓ Total payments created: ${this.createdData.payments.length}`);
        console.log(`  • Successful payments: ${this.createdData.payments.filter(p => p.status === 'success').length}`);
        console.log(`  • Pending payments: ${this.createdData.payments.filter(p => p.status === 'pending').length}`);
        console.log(`  • Failed payments: ${this.createdData.payments.filter(p => p.status === 'failed').length}`);
        console.log(`  • Total votes remaining: ${this.createdData.payments.reduce((sum, p) => sum + p.votesRemaining, 0)}`);
        console.log(`  • Total votes data: ${this.createdData.payments.reduce((sum, p) => sum + p.votesData.reduce((vSum, v) => vSum + v.votesUsed, 0), 0)}`);
    }

    async seedVotes() {
        console.log('🗳️ Seeding votes...');
        
        const payments = this.createdData.payments.filter(p => p.status === 'success');
        
        for (const payment of payments) {
            const candidateId = payment.votesData[0].candidate;
            const voteCount = payment.votesRemaining;
            
            for (let i = 0; i < voteCount; i++) {
                const vote = new Vote({
                    voter: payment.voter,
                    candidate: candidateId,
                    event: payment.event,
                    category: payment.category,
                    voteBundles: payment.voteBundles,
                    isValid: true,
                    votedAt: new Date(),
                    ipAddress: `192.168.1.${100 + this.createdData.votes.length}`,
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                });

                console.log(`  • Creating vote for ${payment.voter.name} on candidate ${candidateId} (Payment: ${payment.reference})`);
                
                const savedVote = await vote.save();
                this.createdData.votes.push(savedVote);
                
                // Update candidate's votes array
                const candidate = await Candidate.findById(candidateId);
                candidate.votes.push(savedVote._id);
                await candidate.save();
                
                // Update payment's votesRemaining
                payment.votesRemaining -= 1;
                await payment.save();
            }
        }

        console.log(`  ✓ Total votes created: ${this.createdData.votes.length}`);
    }

    async run() {
        console.log('🚀 Starting database seeding...\n');
        
        try {
            await this.connect();
            await this.clearDatabase();
            
            await this.seedRoles();
            await this.seedUsers();
            await this.seedEvents();
            await this.seedCategories();
            await this.seedCandidates();
            await this.seedCoupons();
            await this.seedVoteBundles();
            await this.seedPayments();
            await this.seedVotes();
            
            console.log('\n✅ Database seeding completed successfully!');
            console.log('\n📊 Summary:');
            console.log(`  • Roles: ${this.createdData.roles.length}`);
            console.log(`  • Users: ${this.createdData.users.length}`);
            console.log(`  • Events: ${this.createdData.events.length}`);
            console.log(`  • Categories: ${this.createdData.categories.length}`);
            console.log(`  • Candidates: ${this.createdData.candidates.length}`);
            console.log(`  • Coupons: ${this.createdData.coupons.length}`);
            console.log(`  • Vote Bundles: ${this.createdData.voteBundles.length}`);
            console.log(`  • Payments: ${this.createdData.payments.length}`);
            console.log(`  • Votes: ${this.createdData.votes.length}`);
            
            console.log('\n🔑 Test Login Credentials:');
            console.log('  Super Admin: superadmin@itfy.com / password123');
            console.log('  Admin: admin@itfy.com / password123');
            console.log('  Manager: manager@itfy.com / password123');
            console.log('  Moderator: moderator@itfy.com / password123');
            console.log('  Voter 1: ama@example.com / password123');
            console.log('  Voter 2: yaw@example.com / password123');
            
        } catch (error) {
            console.error('❌ Error during seeding:', error);
            process.exit(1);
        } finally {
            await this.disconnect();
        }
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const seeder = new DatabaseSeeder();
    seeder.run();
}

export default DatabaseSeeder;