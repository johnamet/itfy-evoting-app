#!/usr/bin/env node
/**
 * User Model Test Suite
 */

import mongoose from 'mongoose';
import User from '../../models/User.js';
import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import Sinon from 'sinon';
import bcrypt from 'bcrypt';

describe('User Model', () => {
    let user;

    beforeEach(() => {
        user = new User({
            name: 'Test User',
            role: new mongoose.Types.ObjectId(),
            email: 'test@gmail.com',
            password: 'password123',
        });
    });

    afterEach(() => {
        Sinon.restore();
    });

    describe('Create User', () => {
        it('should create a user successfully', async () => {
            const saveStub = Sinon.stub(user, 'save').resolves(user);
            const result = await user.save();
            expect(result).to.equal(user);
            expect(saveStub.calledOnce).to.be.true;
        });

        it('should require name field', () => {
            user.name = undefined;
            const error = user.validateSync();
            expect(error.errors.name).to.exist;
            expect(error.errors.name.message).to.include('required');
        });

        it('should require email field', () => {
            user.email = undefined;
            const error = user.validateSync();
            expect(error.errors.email).to.exist;
            expect(error.errors.email.message).to.include('required');
        });

        it('should require password field', () => {
            user.password = undefined;
            const error = user.validateSync();
            expect(error.errors.password).to.exist;
            expect(error.errors.password.message).to.include('required');
        });

        it('should require role field', () => {
            user.role = undefined;
            const error = user.validateSync();
            expect(error.errors.role).to.exist;
            expect(error.errors.role.message).to.include('required');
        });
    });

    describe('Email Validation', () => {
        it('should accept valid email addresses', () => {
            const validEmails = [
                'test@example.com',
                'user.name@domain.co.uk',
                'user+tag@example.org',
                'firstname.lastname@company.com'
            ];

            validEmails.forEach(email => {
                user.email = email;
                const error = user.validateSync();
                expect(error?.errors?.email).to.not.exist;
            });
        });

        it('should reject invalid email addresses', () => {
            const invalidEmails = [
                'invalid-email',
                '@domain.com',
                'user@',
                'user..name@domain.com',
                'user@domain',
                ''
            ];

            invalidEmails.forEach(email => {
                user.email = email;
                const error = user.validateSync();
                expect(error?.errors?.email).to.exist;
            });
        });

        it('should convert email to lowercase', () => {
            user.email = 'TEST@EXAMPLE.COM';
            expect(user.email).to.equal('test@example.com');
        });

        it('should trim whitespace from email', () => {
            user.email = '  test@example.com  ';
            expect(user.email).to.equal('test@example.com');
        });
    });

    describe('Password Validation', () => {
        it('should accept valid passwords', () => {
            const validPasswords = [
                'password123',
                'MySecureP@ssw0rd',
                'simple6char',
                'a'.repeat(100) // exactly 100 characters
            ];

            validPasswords.forEach(password => {
                user.password = password;
                const error = user.validateSync();
                expect(error?.errors?.password).to.not.exist;
            });
        });

        it('should reject passwords shorter than 6 characters', () => {
            user.password = '12345';
            const error = user.validateSync();
            expect(error.errors.password).to.exist;
            expect(error.errors.password.message).to.include('at least 6 characters');
        });

        it('should reject passwords longer than 100 characters', () => {
            user.password = 'a'.repeat(101);
            const error = user.validateSync();
            expect(error.errors.password).to.exist;
        });

        it('should reject passwords with only whitespace', () => {
            user.password = '      ';
            const error = user.validateSync();
            expect(error.errors.password).to.exist;
        });
    });

    describe('Password Encryption', () => {
        it('should hash password before saving', async () => {
            const originalPassword = 'plainTextPassword';
            user.password = originalPassword;

            const hashStub = Sinon.stub(bcrypt, 'hash').resolves('hashedPassword');
            const saveStub = Sinon.stub(user, 'save').callsFake(async function () {
                // Simulate the pre-save middleware
                if (this.isModified('password')) {
                    this.password = await bcrypt.hash(this.password, 12);
                }
                return this;
            });

            const savedUser = await user.save();

            expect(saveStub.calledOnce).to.be.true;
            expect(savedUser.password).to.equal('hashedPassword');
            expect(hashStub.calledOnce).to.be.true;
            expect(hashStub.calledWith(originalPassword, 12)).to.be.true;
        });

        it('should not rehash password if not modified', async () => {
            const hashedPassword = 'alreadyHashedPassword';
            user.password = hashedPassword;

            const hashStub = Sinon.stub(bcrypt, 'hash');
            const isModifiedStub = Sinon.stub(user, 'isModified').returns(false);
            const saveStub = Sinon.stub(user, 'save').resolves(user);

            await user.save();


            expect(hashStub.called).to.be.false;
            expect(isModifiedStub.calledWith('password')).to.be.false;
            expect(saveStub.calledOnce).to.be.true;
            expect(user.password).to.equal(hashedPassword); // Ensure password unchanged
        });
    });

    describe('Password Verification', () => {
        it('should verify correct password', async () => {
            const compareStub = Sinon.stub(bcrypt, 'compare').resolves(true);

            const result = await user.verifyPassword('correctPassword');

            expect(result).to.be.true;
            expect(compareStub.calledOnce).to.be.true;
            expect(compareStub.calledWith('correctPassword', user.password)).to.be.true;
        });

        it('should reject incorrect password', async () => {
            const compareStub = Sinon.stub(bcrypt, 'compare').resolves(false);

            const result = await user.verifyPassword('wrongPassword');

            expect(result).to.be.false;
            expect(compareStub.calledOnce).to.be.true;
        });
    });

    describe('Find By Email and Password', () => {
        it('should return user when email and password are correct', async () => {
            const mockUser = {
                email: 'test@example.com',
                verifyPassword: Sinon.stub().resolves(true)
            };

            const findOneStub = Sinon.stub(User, 'findOne').resolves(mockUser);

            const result = await User.findByEmailAndPassword('test@example.com', 'correctPassword');

            expect(result).to.equal(mockUser);
            expect(findOneStub.calledWith({ email: 'test@example.com' })).to.be.true;
            expect(mockUser.verifyPassword.calledWith('correctPassword')).to.be.true;
        });

        it('should return null when user not found', async () => {
            const findOneStub = Sinon.stub(User, 'findOne').resolves(null);

            const result = await User.findByEmailAndPassword('nonexistent@example.com', 'password');

            expect(result).to.be.null;
            expect(findOneStub.calledOnce).to.be.true;
        });

        it('should return null when password is incorrect', async () => {
            const mockUser = {
                email: 'test@example.com',
                verifyPassword: Sinon.stub().resolves(false)
            };

            const findOneStub = Sinon.stub(User, 'findOne').resolves(mockUser);

            const result = await User.findByEmailAndPassword('test@example.com', 'wrongPassword');

            expect(result).to.be.null;
            expect(findOneStub.calledWith({ email: 'test@example.com' })).to.be.true;
            expect(mockUser.verifyPassword.calledWith('wrongPassword')).to.be.true;
        });

        it('should convert email to lowercase when searching', async () => {
            const findOneStub = Sinon.stub(User, 'findOne').resolves(null);

            await User.findByEmailAndPassword('TEST@EXAMPLE.COM', 'password');

            expect(findOneStub.calledWith({ email: 'test@example.com' })).to.be.true;
        });
    });

    describe('JSON Serialization', () => {
        it('should exclude password from JSON output', () => {
            user.password = 'hashedPassword';

            const json = user.toJSON();

            expect(json.password).to.be.undefined;
            expect(json.name).to.equal(user.name);
            expect(json.email).to.equal(user.email);
            expect(json.role).to.equal(user.role);
        });

        it('should exclude __v from JSON output', () => {
            user.__v = 0;

            const json = user.toJSON();

            expect(json.__v).to.be.undefined;
        });

        it('should include other fields in JSON output', () => {
            const json = user.toJSON();

            expect(json.name).to.equal(user.name);
            expect(json.email).to.equal(user.email);
            expect(json.role).to.equal(user.role);
            expect(json._id).to.equal(user._id);
        });
    });



    describe('Timestamps', () => {
        it('should have createdAt field', () => {
            expect(user.createdAt).to.exist;
            expect(user.createdAt).to.be.a('date');
        });

        it('should have updatedAt field', () => {
            expect(user.updatedAt).to.exist;
            expect(user.updatedAt).to.be.a('date');
        });
    });

    describe('Schema Constraints', () => {
            it('should have unique constraint on email field', () => {
                const schema = User.schema;
                const emailPath = schema.paths.email;

                expect(emailPath.options.unique).to.be.true;
            });
        });
});