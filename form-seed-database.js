#!/usr/bin/env node
/**
 * Database Seeding Script
 * 
 * Populates the database with development data:
 * - Roles
 * - Users
 * - Events
 * - Categories
 * - Candidates
 * - Coupons
 * - Vote Bundles
 * - Forms
 * - Slides
 * 
 * NOTE: Payments and Votes are excluded in this version.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import models
import User from './app/models/User.js';
import Role from './app/models/Role.js';
import Event from './app/models/Event.js';
import Category from './app/models/Category.js';
import Candidate from './app/models/Candidate.js';
import VoteBundle from './app/models/VoteBundle.js';
import Coupon from './app/models/Coupon.js';
import Form from './app/models/Form.js';
import Slide from './app/models/Slide.js';

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
            forms: [],
            slides: []
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
        console.log('🧹 Clearing old data...');
        await Promise.all([
            User.deleteMany({}),
            Role.deleteMany({}),
            Event.deleteMany({}),
            Category.deleteMany({}),
            Candidate.deleteMany({}),
            Coupon.deleteMany({}),
            VoteBundle.deleteMany({}),
            Form.deleteMany({}),
            Slide.deleteMany({})
        ]);
        console.log('✅ Database cleared');
    }

    async seedRoles() {
        console.log('👥 Seeding roles...');
        const roles = [
            { name: 'Super Admin', level: 4 },
            { name: 'Admin', level: 3 },
            { name: 'Event Manager', level: 2 },
            { name: 'Moderator', level: 1 }
        ];
        for (const roleData of roles) {
            const role = new Role(roleData);
            const savedRole = await role.save();
            this.createdData.roles.push(savedRole);
            console.log(`  ✓ Role: ${savedRole.name}`);
        }
    }

    async seedUsers() {
        console.log('👤 Seeding users...');
        const defaultPassword = 'password123';

        const users = [
            {
                name: 'Super Admin',
                email: 'superadmin@platform.com',
                password: defaultPassword,
                role: this.createdData.roles.find(r => r.name === 'Super Admin')._id,
                bio: 'System owner and overall administrator with unrestricted access',
                phone: '+233244123456',
                location: 'Accra, Ghana',
                image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e',
                isActive: true,
                status: 'active',
                lastLogin: null,
                lastLoginIP: null,
                lastLoginLocation: null,
                passwordResetToken: null,
                passwordResetExpires: null
            },
            {
                name: 'Kojo Antwi',
                email: 'admin@platform.com',
                password: defaultPassword,
                role: this.createdData.roles.find(r => r.name === 'Admin')._id,
                bio: 'Tech administrator in Accra overseeing platform operations',
                phone: '+233244234567',
                location: 'Accra, Ghana',
                image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
                isActive: true,
                status: 'active',
                lastLogin: null,
                lastLoginIP: null,
                lastLoginLocation: null,
                passwordResetToken: null,
                passwordResetExpires: null
            },
            {
                name: 'Abena Asante',
                email: 'manager@platform.com',
                password: defaultPassword,
                role: this.createdData.roles.find(r => r.name === 'Event Manager')._id,
                bio: 'Experienced event coordinator and innovation advocate',
                phone: '+233244345678',
                location: 'Kumasi, Ghana',
                image: 'https://images.unsplash.com/photo-1494790108755-2616b612b1ad',
                isActive: true,
                status: 'active',
                lastLogin: null,
                lastLoginIP: null,
                lastLoginLocation: null,
                passwordResetToken: null,
                passwordResetExpires: null
            },
            {
                name: 'Yaw Boateng',
                email: 'moderator@platform.com',
                password: defaultPassword,
                role: this.createdData.roles.find(r => r.name === 'Moderator')._id,
                bio: 'Volunteer moderator focused on content quality and fairness',
                phone: '+233244456789',
                location: 'Takoradi, Ghana',
                image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
                isActive: false,
                status: 'inactive',
                lastLogin: null,
                lastLoginIP: null,
                lastLoginLocation: null,
                passwordResetToken: null,
                passwordResetExpires: null
            }
        ];

        for (const u of users) {
            const user = new User(u);
            const saved = await user.save();
            this.createdData.users.push(saved);
            console.log(`  ✓ User: ${saved.name}`);
        }
    }

    async seedEvents() {
        console.log('📅 Seeding events...');
        const admin = this.createdData.users.find(u => u.email === 'admin@platform.com');
        const manager = this.createdData.users.find(u => u.email === 'manager@platform.com');

        const events = [
            {
                name: 'Accra Startup Festival 2025',
                description: 'A national festival celebrating Ghanaian startups with pitch competitions, keynote sessions, and innovation showcases.',
                startDate: new Date('2025-09-20T09:00:00Z'),
                endDate: new Date('2025-09-22T18:00:00Z'),
                location: {
                    name: 'National Theatre, Accra',
                    city: 'Accra',
                    country: 'Ghana',
                    address: 'South Liberia Road',
                    coordinates: { lat: 5.5600, lng: -0.1969 }
                },
                gallery: [
                    'https://images.unsplash.com/photo-1551836022-4c4c79ecde16',
                    'https://images.unsplash.com/photo-1498050108023-c5249f4df085'
                ],
                createdBy: admin._id,
                updatedBy: manager._id,
                isActive: true,
                isDeleted: false,
                status: 'active',
                requirements: ['Valid government ID', 'Mobile phone for verification'],
                timeline: [
                    {
                        title: 'Registration Opens',
                        description: 'Early bird registration with discounted rates',
                        time: new Date('2025-08-01T09:00:00Z')
                    },
                    {
                        title: 'Pitch Competition',
                        description: 'Startup founders present their ideas',
                        time: new Date('2025-09-20T10:00:00Z')
                    },
                    {
                        title: 'Awards Ceremony',
                        description: 'Recognition of outstanding startups',
                        time: new Date('2025-09-22T17:00:00Z')
                    }
                ],
                speakers: [
                    {
                        name: 'Mawuena Trebarh',
                        title: 'Startup Advocate',
                        company: 'Ghana Angel Investors Network',
                        location: 'Accra, Ghana',
                        image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f82',
                        bio: 'Mawuena has been instrumental in connecting Ghanaian startups with global investors.',
                        expertise: ['Investment', 'Startups', 'Mentorship'],
                        socialLinks: { linkedin: 'https://linkedin.com/in/mawuena' },
                        achievements: ['Pioneered Ghana Angel Investors Network', 'Mentored 200+ startups'],
                        speakingTopic: 'Attracting Capital for African Startups',
                        type: 'speaker'
                    }
                ],
                organizers: [admin._id, manager._id],
                relatedEvents: [],
                categories: [],
                sponsors: [
                    {
                        name: 'MTN Ghana',
                        logo: 'https://upload.wikimedia.org/wikipedia/commons/7/79/MTN-Logo.jpg',
                        level: 'platinum',
                        website: 'https://mtn.com.gh'
                    }
                ],
                form: null
            },
            {
                name: 'Volta Digital Expo 2025',
                description: 'A regional tech exhibition highlighting digital products, innovation labs, and e-commerce in Volta Region.',
                startDate: new Date('2025-10-10T09:00:00Z'),
                endDate: new Date('2025-10-11T18:00:00Z'),
                location: {
                    address: 'Ho, Volta Region',
                    name: 'Ho Technical University Hall',
                    city: 'Ho',
                    country: 'Ghana',
                    coordinates: { lat: 6.6000, lng: 0.4667 }
                },
                gallery: [
                    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f',
                    'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70'
                ],
                createdBy: manager._id,
                updatedBy: manager._id,
                isActive: true,
                isDeleted: false,
                status: 'active',
                requirements: ['Student ID or professional credentials', 'Tech portfolio submission'],
                timeline: [
                    {
                        title: 'Expo Setup',
                        description: 'Exhibitors set up their displays',
                        time: new Date('2025-10-10T08:00:00Z')
                    },
                    {
                        title: 'Digital Product Showcase',
                        description: 'Live demonstrations of innovative products',
                        time: new Date('2025-10-10T14:00:00Z')
                    },
                    {
                        title: 'Networking Session',
                        description: 'Connect with industry professionals',
                        time: new Date('2025-10-11T16:00:00Z')
                    }
                ],
                speakers: [
                    {
                        name: 'Selorm Adadevoh',
                        title: 'CEO',
                        company: 'MTN Ghana',
                        location: 'Accra, Ghana',
                        image: 'https://images.unsplash.com/photo-1603415526960-f8f0a1f0a2d2',
                        bio: 'Leader in telecom innovation and digitalization across Ghana.',
                        expertise: ['Telecom', 'Digitalization', 'Leadership'],
                        socialLinks: { twitter: 'https://twitter.com/selorm_adadevoh' },
                        achievements: ['Rolled out 4G+ nationwide', 'Launched MTN Ayoba platform'],
                        speakingTopic: 'Building Digital Economies',
                        type: 'speaker'
                    }
                ],
                organizers: [manager._id],
                relatedEvents: [],
                categories: [],
                sponsors: [
                    {
                        name: 'Vodafone Ghana',
                        logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Vodafone_icon.svg',
                        level: 'gold',
                        website: 'https://vodafone.com.gh'
                    }
                ],
                form: null
            },
            {
                name: 'Cape Coast Innovation Challenge 2025',
                description: 'A coastal innovation event promoting youth-driven projects in sustainability, edtech, and green tech.',
                startDate: new Date('2025-11-05T09:00:00Z'),
                endDate: new Date('2025-11-06T17:00:00Z'),
                location: {
                    name: 'University of Cape Coast Auditorium',
                    city: 'Cape Coast',
                    country: 'Ghana',
                    address: 'University of Cape Coast, Cape Coast',
                    coordinates: { lat: 5.1036, lng: -1.2795 }
                },
                gallery: [
                    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d',
                    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f'
                ],
                createdBy: admin._id,
                updatedBy: admin._id,
                isActive: true,
                isDeleted: false,
                status: 'active',
                requirements: ['University affiliation or STEM background', 'Project proposal submission'],
                timeline: [
                    {
                        title: 'Challenge Launch',
                        description: 'Innovation challenge officially begins',
                        time: new Date('2025-11-05T09:00:00Z')
                    },
                    {
                        title: 'Project Presentations',
                        description: 'Teams present their solutions',
                        time: new Date('2025-11-05T13:00:00Z')
                    },
                    {
                        title: 'Winner Announcement',
                        description: 'Best innovations are recognized',
                        time: new Date('2025-11-06T16:00:00Z')
                    }
                ],
                speakers: [
                    {
                        name: 'Dr. Elsie Kaufmann',
                        title: 'Dean',
                        company: 'University of Ghana Engineering',
                        location: 'Accra, Ghana',
                        image: 'https://images.unsplash.com/photo-1595152772835-219674b2a8a6',
                        bio: 'STEM education champion and founder of the NSMQ.',
                        expertise: ['STEM Education', 'Engineering', 'Innovation'],
                        socialLinks: { linkedin: 'https://linkedin.com/in/elsie-kaufmann' },
                        achievements: ['Host of NSMQ', 'Advocate for girls in STEM'],
                        speakingTopic: 'STEM Innovation for Ghana’s Future',
                        type: 'speaker'
                    }
                ],
                organizers: [admin._id],
                relatedEvents: [],
                categories: [],
                sponsors: [
                    {
                        name: 'Asaase Radio',
                        logo: 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Asaase_Radio_logo.png',
                        level: 'silver',
                        website: 'https://asaaseradio.com'
                    }
                ],
                form: null
            }
        ];

        for (const e of events) {
            const event = new Event(e);
            const saved = await event.save();
            this.createdData.events.push(saved);
            console.log(`  ✓ Event: ${saved.name}`);
        }
    }

    async seedCategories() {
        console.log('🏷️ Seeding categories...');
        const admin = this.createdData.users.find(u => u.email === 'admin@platform.com');
        const [event1, event2, event3] = this.createdData.events;

        const categories = [
            {
                name: 'Best Startup Founder',
                description: 'Recognizing Ghana\'s most outstanding startup founder',
                event: event1._id,
                createdBy: admin._id,
                status: 'active',
                isActive: true,
                isDeleted: false,
                votingDeadline: new Date('2025-12-31'),
                isVotingOpen: true,
                icon: '🚀',
                candidates: []
            },
            {
                name: 'Best E-Commerce Platform',
                description: 'Award for outstanding e-commerce platform in Ghana',
                event: event2._id,
                createdBy: admin._id,
                status: 'active',
                isActive: true,
                isDeleted: false,
                votingDeadline: new Date('2026-12-31'),
                isVotingOpen: true,
                icon: '🛒',
                candidates: []
            },
            {
                name: 'Best Green Tech Project',
                description: 'Award for sustainability and eco-friendly innovations',
                event: event3._id,
                createdBy: admin._id,
                status: 'active',
                isActive: true,
                isDeleted: false,
                votingDeadline: new Date('2025-11-30'),
                isVotingOpen: true,
                icon: '🌱',
                candidates: []
            }
        ];

        for (const c of categories) {
            const cat = new Category(c);
            const saved = await cat.save();
            this.createdData.categories.push(saved);
            console.log(`  ✓ Category: ${saved.name}`);
        }

        for (const c of this.createdData.categories){
            for (const e of this.createdData.events){
                if (c.event.toString() === e._id.toString()){
                    e.categories.push(c._id);
                    await e.save();
                }
            }
        }
    }

    async seedCandidates() {
        console.log('🏆 Seeding candidates...');
        const [cat1, cat2, cat3] = this.createdData.categories;
        const events = this.createdData.events;

        const candidates = [
            {
                name: 'Efua Mensah',
                email: 'efua.mensah@example.com',
                title: 'CEO',
                bio: 'Founder of AgriTech Ghana, using AI to boost smallholder farming productivity.',
                location: 'Accra, Ghana',
                cId: 'CAND101',
                event: events[0]._id,
                categories: [cat1._id],
                skills: ['AI', 'Agriculture', 'Leadership'],
                socialLinks: {
                    linkedin: 'https://linkedin.com/in/efua-mensah'
                },
                education: {
                    degree: 'MSc Computer Science',
                    university: 'University of Ghana',
                    year: 2020
                },
                experience: {
                    years: 5,
                    companies: ['AgriTech Ghana', 'TechStart Incubator']
                },
                achievements: {
                    awards: ['Startup of the Year 2024'],
                    projects: ['AI Crop Yield Prediction']
                },
                projects: [
                    {
                        name: 'Smart Farm Assistant',
                        description: 'AI-powered farming advisor for smallholder farmers',
                        year: 2024
                    }
                ],
                photo: 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe',
                status: 'approved',
                isActive: true,
                isDeleted: false,
                votes: [],
                nominatedBy: "John Mensah",
                password: 'candidate123'
            },
            {
                name: 'Kwame Owusu',
                email: 'kwame.owusu@example.com',
                title: 'CTO',
                bio: 'Co-founder of ShopEasy, a fast-growing e-commerce platform.',
                location: 'Ho, Ghana',
                cId: 'CAND102',
                event: events[1]._id,
                categories: [cat2._id],
                skills: ['E-commerce', 'Software Engineering', 'UI/UX'],
                socialLinks: { 
                    github: 'https://github.com/kwameowusu',
                    twitter: 'https://twitter.com/kwametech'
                },
                education: {
                    degree: 'BSc Information Technology',
                    university: 'Ho Technical University',
                    year: 2019
                },
                experience: {
                    years: 6,
                    companies: ['ShopEasy Ghana', 'Digital Solutions Ltd']
                },
                achievements: {
                    awards: ['Best Tech Entrepreneur 2023'],
                    projects: ['ShopEasy Ghana']
                },
                projects: [
                    {
                        name: 'ShopEasy Mobile App',
                        description: 'E-commerce platform for Ghanaian businesses',
                        year: 2023
                    }
                ],
                photo: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e',
                status: 'approved',
                isActive: true,
                isDeleted: false,
                votes: [],
                nominatedBy: "Jane Doe",
                password: 'candidate123'
            },
            {
                name: 'Akua Addo',
                email: 'akua.addo@example.com',
                title: 'Engineer',
                bio: 'Sustainability advocate building solar-powered irrigation systems.',
                location: 'Cape Coast, Ghana',
                cId: 'CAND103',
                event: events[2]._id,
                categories: [cat3._id],
                skills: ['Green Tech', 'Renewable Energy', 'STEM'],
                socialLinks: { 
                    twitter: 'https://twitter.com/akua_addo',
                    linkedin: 'https://linkedin.com/in/akua-addo'
                },
                education: {
                    degree: 'BEng Electrical Engineering',
                    university: 'University of Cape Coast',
                    year: 2021
                },
                experience: {
                    years: 4,
                    companies: ['GreenTech Solutions', 'Sustainable Energy Ghana']
                },
                achievements: {
                    awards: ['Green Innovation Award 2024'],
                    projects: ['Solar Irrigation for Cocoa Farmers']
                },
                projects: [
                    {
                        name: 'Solar Irrigation System',
                        description: 'Affordable solar-powered irrigation for rural farmers',
                        year: 2024
                    }
                ],
                photo: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e',
                status: 'approved',
                isActive: true,
                isDeleted: false,
                votes: [],
                nominatedBy: "John Mensah",
                password: 'candidate123'
            }
        ];

        for (const cand of candidates) {
            const candidate = new Candidate(cand);
            const saved = await candidate.save();
            this.createdData.candidates.push(saved);
            console.log(`  ✓ Candidate: ${saved.name}`);
        }
    }

    async seedCoupons() {
        console.log('🎫 Seeding coupons...');
        const events = this.createdData.events;
        const categories = this.createdData.categories;
        const bundles = this.createdData.voteBundles;

        const coupons = [
            {
                code: 'ACCSTART25',
                description: '25% discount for Accra Startup Festival',
                discountType: 'percentage',
                discount: 25,
                expiryDate: new Date('2025-12-31T23:59:59Z'),
                eventApplicable: events[0]._id,
                categoriesApplicable: [categories[0]._id],
                bundlesApplicable: bundles.length > 0 ? [bundles[0]._id] : [],
                maxUses: 100,
                usedCount: 0,
                minOrderAmount: 0,
                isActive: true
            },
            {
                code: 'VOLTADIGI10',
                description: '10 GHS off Volta Digital Expo',
                discountType: 'fixed',
                discount: 10,
                expiryDate: new Date('2025-12-31T23:59:59Z'),
                eventApplicable: events[1]._id,
                categoriesApplicable: [categories[1]._id],
                bundlesApplicable: bundles.length > 1 ? [bundles[1]._id] : [],
                maxUses: 50,
                usedCount: 0,
                minOrderAmount: 20,
                isActive: true
            }
        ];

        for (const cp of coupons) {
            const coupon = new Coupon(cp);
            const saved = await coupon.save();
            this.createdData.coupons.push(saved);
            console.log(`  ✓ Coupon: ${saved.code}`);
        }
    }

    async seedVoteBundles() {
        console.log('📦 Seeding vote bundles...');
        const events = this.createdData.events;
        const categories = this.createdData.categories;
        const admin = this.createdData.users.find(u => u.email === 'admin@platform.com');

        const bundles = [
            {
                name: 'Basic Pack',
                description: '5 votes for any category',
                price: 10,
                currency: 'GHS',
                applicableEvents: [events[0]._id, events[1]._id],
                applicableCategories: [categories[0]._id, categories[1]._id],
                votes: 5,
                features: ['5 votes', 'Basic support', 'Email notifications'],
                popular: false,
                createdBy: admin._id,
                isActive: true
            },
            {
                name: 'Standard Pack',
                description: '20 votes for wider participation',
                price: 30,
                currency: 'GHS',
                applicableEvents: [events[0]._id, events[2]._id],
                applicableCategories: [categories[0]._id, categories[2]._id],
                votes: 20,
                features: ['20 votes', 'Priority support', 'SMS + Email notifications', 'Early results access'],
                popular: true,
                createdBy: admin._id,
                isActive: true
            },
            {
                name: 'Premium Pack',
                description: '50 votes with bonus perks',
                price: 70,
                currency: 'GHS',
                applicableEvents: events.map(e => e._id),
                applicableCategories: categories.map(c => c._id),
                votes: 50,
                features: ['50 votes', 'VIP support', 'All notifications', 'Real-time results', 'Certificate of participation'],
                popular: true,
                createdBy: admin._id,
                isActive: true
            }
        ];

        for (const b of bundles) {
            const bundle = new VoteBundle(b);
            const saved = await bundle.save();
            this.createdData.voteBundles.push(saved);
            console.log(`  ✓ Bundle: ${saved.name}`);
        }
    }

    async seedForm() {
        console.log('📝 Seeding forms...');
        const admin = this.createdData.users.find(u => u.email === 'admin@platform.com');
        const cat1 = this.createdData.categories[0];

        const forms = [
            {
                title: `${cat1.name} Nomination`,
                description: 'Form for nominating candidates for the Best Startup Founder category',
                model: 'Category',
                modelId: cat1._id,
                fields: [
                    { label: 'Nominee Full Name', type: 'text', required: true, options: [] },
                    { label: 'Nominee Email', type: 'email', required: true, options: [] },
                    { label: 'Reason for Nomination', type: 'textarea', required: true, options: [] },
                    { label: 'Nominator Name', type: 'text', required: true, options: [] },
                    { label: 'Nominator Email', type: 'email', required: true, options: [] }
                ],
                createdBy: admin._id,
                updatedBy: admin._id,
                isActive: true,
                isDeleted: false,
                submissionCount: 0,
                submissions: [],
                maxSubmissions: 1000
            }
        ];

        for (const f of forms) {
            const form = new Form(f);
            const saved = await form.save();
            this.createdData.forms.push(saved);
            console.log(`  ✓ Form: ${saved.title}`);
        }
    }

    async seedSlides() {
        console.log('🎠 Seeding slides...');
        const slides = [
            {
                title: 'Empowering Ghanaian Startups',
                subtitle: 'Join the Accra Startup Festival 2025',
                image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d',
                button: {
                    label: 'Register Now',
                    link: '/events/accra-startup-festival-2025'
                },
                isActive: true,
                published: true,
                settings: {
                    autoSlide: true,
                    duration: 5000
                },
                order: 1
            },
            {
                title: 'Digital Future of Volta',
                subtitle: 'Explore opportunities at Volta Digital Expo',
                image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7',
                button: {
                    label: 'Learn More',
                    link: '/events/volta-digital-expo-2025'
                },
                isActive: true,
                published: true,
                settings: {
                    autoSlide: true,
                    duration: 5000
                },
                order: 2
            }
        ];

        for (const s of slides) {
            const slide = new Slide(s);
            const saved = await slide.save();
            this.createdData.slides.push(saved);
            console.log(`  ✓ Slide: ${saved.title}`);
        }
    }

    async run() {
        console.log('🚀 Starting database seeding...\n');
        await this.connect();
        await this.clearDatabase();

        await this.seedRoles();
        await this.seedUsers();
        await this.seedEvents();
        await this.seedCategories();
        await this.seedCandidates();
        await this.seedVoteBundles();
        await this.seedCoupons();
        await this.seedForm();
        await this.seedSlides();

        console.log('\n✅ Seeding completed successfully!');
        console.log(`Roles: ${this.createdData.roles.length}`);
        console.log(`Users: ${this.createdData.users.length}`);
        console.log(`Events: ${this.createdData.events.length}`);
        console.log(`Categories: ${this.createdData.categories.length}`);
        console.log(`Candidates: ${this.createdData.candidates.length}`);
        console.log(`Coupons: ${this.createdData.coupons.length}`);
        console.log(`Vote Bundles: ${this.createdData.voteBundles.length}`);
        console.log(`Forms: ${this.createdData.forms.length}`);
        console.log(`Slides: ${this.createdData.slides.length}`);

        await this.disconnect();
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const seeder = new DatabaseSeeder();
    seeder.run();
}

export default DatabaseSeeder;
