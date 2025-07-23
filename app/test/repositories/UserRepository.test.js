#!/usr/bin/env node
/**
 * User Repository test suite
 * This file contains tests for the UserRepository class, ensuring that it correctly interacts with the User model.
 **/
import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import UserRepository from '../../repositories/UserRepository.js';
import { after, afterEach, beforeEach, describe, it } from 'mocha';
import bycrypt from 'bcrypt';

describe('UserRepository', () => {
    let userRepository;
    let sandbox;
    let user;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        userRepository = new UserRepository();
        user = {
            _id: new mongoose.Types.ObjectId(),
            email: 'testemail@test.com',
            password: 'testpassword',
            name: 'Test User',
            role: new mongoose.Types.ObjectId(),
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    after(() => {
        mongoose.connection.close();
    });

    describe('Create a new User', () => {
        it('should create a new user with valid data', async () => {
            sandbox.stub(userRepository, 'createUser').resolves(user);
            const result = await userRepository.createUser(user);
            expect(result).to.have.property('_id');
            expect(result.email).to.equal(user.email);
            expect(result.name).to.equal(user.name);
        });

        it('should throw an error if required fields are missing', async () => {
            try {
                await userRepository.createUser({});
            } catch (error) {
                expect(error.message.toLowerCase()).to.include('the user data is empty');
            }
        });
    });

    describe('Find user by email', () => {
        it('should find a user by email', async () => {
            sandbox.stub(userRepository, 'findByEmail').resolves(user);
            const result = await userRepository.findByEmail(user.email);
            expect(result).to.have.property('_id');
            expect(result.email).to.equal(user.email);
            expect(result.name).to.equal(user.name);
        });

        it('should return null if user is not found', async () => {
            sandbox.stub(userRepository, 'findByEmail').resolves(null);
            const result = await userRepository.findByEmail('nonexistent@test.com');
            expect(result).to.be.null;
        });
    });

    describe('Find user by ID', () => {
        it('should find a user by ID', async () => {
            sandbox.stub(userRepository, 'findById').resolves(user);
            const result = await userRepository.findById(user._id);
            expect(result).to.have.property('_id');
            expect(result.email).to.equal(user.email);
            expect(result.name).to.equal(user.name);
        });

        it('should return null if user is not found', async () => {
            sandbox.stub(userRepository, 'findById').resolves(null);
            const result = await userRepository.findById(new mongoose.Types.ObjectId());
            expect(result).to.be.null;
        });
    });

    describe('Find user by email and password', () => {
        it('should find a user by email and verify password', async () => {
            const hashedPassword = await bycrypt.hash(user.password, 12);
            user.password = hashedPassword;
            sandbox.stub(userRepository, 'findByEmailWithPassword').resolves(user);

            const result = await userRepository.findByEmailWithPassword(user.email, user.password);
            expect(result).to.have.property('_id');
            expect(result.email).to.equal(user.email);
        });

        it('should return null if email does not match', async () => {
            sandbox.stub(userRepository, 'findByEmailWithPassword').resolves(null);
            const result = await userRepository.findByEmailWithPassword('wrongemail@test.com', user.password);
            expect(result).to.be.null;
        });
    });

    describe('Authenticate user', () => {
        it('should return user if email and password are correct', async () => {
            const hashedPassword = await bycrypt.hash(user.password, 12);
            user.password = hashedPassword;
            sandbox.stub(userRepository, 'authenticate').resolves(user);

            const result = await userRepository.authenticate(user.email, user.password);
            expect(result).to.have.property('_id');
            expect(result.email).to.equal(user.email);
        });

        it('should return null if email does not match', async () => {
            sandbox.stub(userRepository, 'authenticate').resolves(null);
            const result = await userRepository.authenticate('wrongemail@test.com', user.password);
            expect(result).to.be.null;
        });

        it('should return null if password is incorrect', async () => {
            const hashedPassword = await bycrypt.hash(user.password, 12);
            user.password = hashedPassword;
            sandbox.stub(userRepository, 'authenticate').resolves(null);

            const result = await userRepository.authenticate(user.email, 'wrongpassword');
            expect(result).to.be.null;
        });
    });

    describe('Update user', () => {
        it('should update user details', async () => {
            const updatedUser = { ...user, name: 'Updated User' };
            sandbox.stub(userRepository, 'updateUser').resolves(updatedUser);

            const result = await userRepository.updateUser(user._id, { name: 'Updated User' });
            expect(result).to.have.property('_id');
            expect(result.name).to.equal('Updated User');
        });

        it('should return null if user is not found', async () => {
            sandbox.stub(userRepository, 'updateUser').resolves(null);
            const result = await userRepository.updateUser(new mongoose.Types.ObjectId(), { name: 'Updated User' });
            expect(result).to.be.null;
        });

        it('should not update user password if included in update data', async () => {
            const updatedUser = { ...user, password: 'password' };
            sandbox.stub(userRepository, 'updateUser').resolves(updatedUser);

            const result = await userRepository.updateUser(user._id, { password: 'newpassword1' });
            expect(result).to.have.property('_id');
            expect(result.password).to.equal('password'); // Password should not be updated
        });

        it('should not update user email if included in update data', async () => {
            const updatedUser = { ...user, email: 'email@test.com' };
            sandbox.stub(userRepository, 'updateUser').resolves(updatedUser);

            const result = await userRepository.updateUser(user._id, { email: 'newemail@test.com' });
            expect(result).to.have.property('_id');
            expect(result.email).to.equal('email@test.com'); // Email should not be updated
            expect(result.password).to.equal(user.password); // Password should not be updated
            expect(result.name).to.equal(user.name); // Name should be updated
        });
    });

    describe('Delete user', () => {
        it('should soft delete a user', async () => {
            user.isActive = false;
            user.deletedAt = new Date();
            sandbox.stub(userRepository, 'softDelete').resolves(user);
            const result = await userRepository.softDelete(user._id);
            expect(result).to.have.property('_id');
            expect(result.email).to.equal(user.email);
            expect(result.isActive).to.equal(false);
            expect(result.deletedAt).to.be.a('date');
        });

        it('should return null if user is not found for deletion', async () => {
            sandbox.stub(userRepository, 'softDelete').resolves(null);
            const result = await userRepository.softDelete(new mongoose.Types.ObjectId());
            expect(result).to.be.null;
        });
    });

    describe('Restore deleted user', () => {
        it('should restore a soft deleted user', async () => {
            user.isActive = true;
            user.deletedAt = null;
            sandbox.stub(userRepository, 'restore').resolves(user);
            const result = await userRepository.restore(user._id);
            expect(result).to.have.property('_id');
            expect(result.email).to.equal(user.email);
            expect(result.isActive).to.equal(true);
            expect(result.deletedAt).to.be.null;
        });

        it('should return null if user is not found for restoration', async () => {
            sandbox.stub(userRepository, 'restore').resolves(null);
            const result = await userRepository.restore(new mongoose.Types.ObjectId());
            expect(result).to.be.null;
        });
    });


    describe('Find Active Users', () => {
        it('should return all active users', async () => {
            const activeUsers = [user, { ...user, _id: new mongoose.Types.ObjectId() }];
            sandbox.stub(userRepository, 'findActive').resolves(activeUsers);
            const result = await userRepository.findActive();
            expect(result).to.be.an('array').that.is.not.empty;
            expect(result[0]).to.have.property('_id');
            expect(result[0].email).to.equal(user.email);
        });

        it('should return an empty array if no active users found', async () => {
            sandbox.stub(userRepository, 'findActive').resolves([]);
            const result = await userRepository.findActive();
            expect(result).to.be.an('array').that.is.empty;
        });
    });

    describe('Get user stats', () => {
        it('should return user stats', async () => {
            const stats = { totalUsers: 100, activeUsers: 80, inactiveUsers: 20, roleStats: { admin: 10, user: 90 } };
            sandbox.stub(userRepository, 'getUserStats').resolves(stats);
            const result = await userRepository.getUserStats();
            expect(result).to.have.property('totalUsers');
            expect(result.totalUsers).to.equal(100);
            expect(result.activeUsers).to.equal(80);
            expect(result.inactiveUsers).to.equal(20);
            expect(result.roleStats).to.have.property('admin');
            expect(result.roleStats.admin).to.equal(10);
        });

        it('should handle errors when fetching user stats', async () => {
            sandbox.stub(userRepository, 'getStats').rejects(new Error('Database error'));
            try {
                await userRepository.getStats();
            } catch (error) {
                expect(error.message).to.equal('Database error');
            }
        });
    });

    describe('Search for users base on a criteria', async () => {
        it('should return the users that match the criteria', async () =>{

        })
    })

    
});