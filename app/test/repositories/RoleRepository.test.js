#!/usr/bin/env node
/**
 * Role Repository test suite
 * This file contains tests for the RoleRepository class, ensuring that it correctly manages role operations.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import RoleRepository from '../../repositories/RoleRepository.js';
import { after, afterEach, beforeEach, describe, it } from 'mocha';

describe('RoleRepository', () => {
    let roleRepository;
    let sandbox;
    let role;
    let roleId;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        roleRepository = new RoleRepository();
        
        roleId = new mongoose.Types.ObjectId();
        
        role = {
            _id: roleId,
            name: 'Admin',
            level: 100,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    after(() => {
        mongoose.connection.close();
    });

    describe('Create role', () => {
        it('should create a role with valid data', async () => {
            const roleData = {
                name: 'Super Admin',
                level: 200
            };

            sandbox.stub(roleRepository, 'findByName').resolves(null);
            sandbox.stub(roleRepository, 'findByLevel').resolves(null);
            sandbox.stub(roleRepository, 'createRole').resolves({
                ...role,
                name: roleData.name,
                level: roleData.level
            });
            
            const result = await roleRepository.createRole(roleData);
            
            expect(result).to.have.property('_id');
            expect(result.name).to.equal('Super Admin');
            expect(result.level).to.equal(200);
        });

        it('should throw error when creating role with existing name', async () => {
            const roleData = {
                name: 'Admin',
                level: 150
            };

            sandbox.stub(roleRepository, 'findByName').resolves(role);
            sandbox.stub(roleRepository, 'createRole').throws(new Error("Role with name 'Admin' already exists"));
            
            try {
                await roleRepository.createRole(roleData);
            } catch (error) {
                expect(error.message).to.include("Role with name 'Admin' already exists");
            }
        });

        it('should throw error when creating role with existing level', async () => {
            const roleData = {
                name: 'Manager',
                level: 100
            };

            sandbox.stub(roleRepository, 'findByName').resolves(null);
            sandbox.stub(roleRepository, 'findByLevel').resolves(role);
            sandbox.stub(roleRepository, 'createRole').throws(new Error("Role with level '100' already exists"));
            
            try {
                await roleRepository.createRole(roleData);
            } catch (error) {
                expect(error.message).to.include("Role with level '100' already exists");
            }
        });

        it('should trim role name before creation', async () => {
            const roleData = {
                name: '  Moderator  ',
                level: 50
            };

            sandbox.stub(roleRepository, 'findByName').resolves(null);
            sandbox.stub(roleRepository, 'findByLevel').resolves(null);
            sandbox.stub(roleRepository, 'createRole').resolves({
                ...role,
                name: 'Moderator',
                level: 50
            });
            
            const result = await roleRepository.createRole(roleData);
            
            expect(result.name).to.equal('Moderator');
        });
    });

    describe('Find role by name', () => {
        it('should find role by exact name', async () => {
            sandbox.stub(roleRepository, 'findByName').resolves(role);
            
            const result = await roleRepository.findByName('Admin');
            
            expect(result).to.have.property('_id');
            expect(result.name).to.equal('Admin');
        });

        it('should return null for non-existent role name', async () => {
            sandbox.stub(roleRepository, 'findByName').resolves(null);
            
            const result = await roleRepository.findByName('NonExistent');
            
            expect(result).to.be.null;
        });

        it('should handle name trimming when searching', async () => {
            sandbox.stub(roleRepository, 'findByName').resolves(role);
            
            const result = await roleRepository.findByName('  Admin  ');
            
            expect(result).to.have.property('name', 'Admin');
        });

        it('should be case sensitive', async () => {
            sandbox.stub(roleRepository, 'findByName').resolves(null);
            
            const result = await roleRepository.findByName('admin');
            
            expect(result).to.be.null;
        });
    });

    describe('Find role by level', () => {
        it('should find role by exact level', async () => {
            sandbox.stub(roleRepository, 'findByLevel').resolves(role);
            
            const result = await roleRepository.findByLevel(100);
            
            expect(result).to.have.property('_id');
            expect(result.level).to.equal(100);
        });

        it('should return null for non-existent level', async () => {
            sandbox.stub(roleRepository, 'findByLevel').resolves(null);
            
            const result = await roleRepository.findByLevel(999);
            
            expect(result).to.be.null;
        });

        it('should handle zero level', async () => {
            const zeroLevelRole = { ...role, level: 0 };
            sandbox.stub(roleRepository, 'findByLevel').resolves(zeroLevelRole);
            
            const result = await roleRepository.findByLevel(0);
            
            expect(result.level).to.equal(0);
        });
    });

    describe('Get roles by level ordering', () => {
        it('should get all roles ordered by level ascending', async () => {
            const roles = [
                { ...role, name: 'User', level: 10 },
                { ...role, name: 'Moderator', level: 50 },
                { ...role, name: 'Admin', level: 100 }
            ];
            
            sandbox.stub(roleRepository, 'getAllRolesByLevel').resolves(roles);
            
            const result = await roleRepository.getAllRolesByLevel('asc');
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(3);
            expect(result[0].level).to.equal(10);
            expect(result[1].level).to.equal(50);
            expect(result[2].level).to.equal(100);
        });

        it('should get all roles ordered by level descending', async () => {
            const roles = [
                { ...role, name: 'Admin', level: 100 },
                { ...role, name: 'Moderator', level: 50 },
                { ...role, name: 'User', level: 10 }
            ];
            
            sandbox.stub(roleRepository, 'getAllRolesByLevel').resolves(roles);
            
            const result = await roleRepository.getAllRolesByLevel('desc');
            
            expect(result).to.be.an('array');
            expect(result[0].level).to.equal(100);
            expect(result[1].level).to.equal(50);
            expect(result[2].level).to.equal(10);
        });

        it('should default to ascending order', async () => {
            const roles = [
                { ...role, name: 'User', level: 10 },
                { ...role, name: 'Admin', level: 100 }
            ];
            
            sandbox.stub(roleRepository, 'getAllRolesByLevel').resolves(roles);
            
            const result = await roleRepository.getAllRolesByLevel();
            
            expect(result[0].level).to.be.lessThan(result[1].level);
        });
    });

    describe('Get roles by level range', () => {
        it('should get roles within specified level range', async () => {
            const roles = [
                { ...role, name: 'Moderator', level: 50 },
                { ...role, name: 'Manager', level: 75 },
                { ...role, name: 'Admin', level: 100 }
            ];
            
            sandbox.stub(roleRepository, 'getRolesByLevelRange').resolves(roles);
            
            const result = await roleRepository.getRolesByLevelRange(50, 100);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(3);
            expect(result.every(r => r.level >= 50 && r.level <= 100)).to.be.true;
        });

        it('should return empty array when no roles in range', async () => {
            sandbox.stub(roleRepository, 'getRolesByLevelRange').resolves([]);
            
            const result = await roleRepository.getRolesByLevelRange(200, 300);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });

        it('should handle single level range', async () => {
            sandbox.stub(roleRepository, 'getRolesByLevelRange').resolves([role]);
            
            const result = await roleRepository.getRolesByLevelRange(100, 100);
            
            expect(result).to.have.length(1);
            expect(result[0].level).to.equal(100);
        });
    });

    describe('Get roles above level', () => {
        it('should get roles above specified level', async () => {
            const roles = [
                { ...role, name: 'Super Admin', level: 200 },
                { ...role, name: 'System Admin', level: 300 }
            ];
            
            sandbox.stub(roleRepository, 'getRolesAboveLevel').resolves(roles);
            
            const result = await roleRepository.getRolesAboveLevel(100);
            
            expect(result).to.be.an('array');
            expect(result.every(r => r.level > 100)).to.be.true;
        });

        it('should return empty array when no roles above level', async () => {
            sandbox.stub(roleRepository, 'getRolesAboveLevel').resolves([]);
            
            const result = await roleRepository.getRolesAboveLevel(1000);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });
    });

    describe('Get roles below level', () => {
        it('should get roles below specified level', async () => {
            const roles = [
                { ...role, name: 'User', level: 10 },
                { ...role, name: 'Moderator', level: 50 }
            ];
            
            sandbox.stub(roleRepository, 'getRolesBelowLevel').resolves(roles);
            
            const result = await roleRepository.getRolesBelowLevel(100);
            
            expect(result).to.be.an('array');
            expect(result.every(r => r.level < 100)).to.be.true;
        });

        it('should return empty array when no roles below level', async () => {
            sandbox.stub(roleRepository, 'getRolesBelowLevel').resolves([]);
            
            const result = await roleRepository.getRolesBelowLevel(0);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });
    });

    describe('Update role by name', () => {
        it('should update role with valid data', async () => {
            const updateData = {
                level: 150
            };

            const updatedRole = { ...role, level: 150 };
            
            sandbox.stub(roleRepository, 'findByName').resolves(role);
            sandbox.stub(roleRepository, 'findByLevel').resolves(null);
            sandbox.stub(roleRepository, 'updateRoleByName').resolves(updatedRole);
            
            const result = await roleRepository.updateRoleByName('Admin', updateData);
            
            expect(result.level).to.equal(150);
        });

        it('should throw error when role not found', async () => {
            sandbox.stub(roleRepository, 'updateRoleByName').throws(new Error("Role with name 'NonExistent' not found"));
            
            try {
                await roleRepository.updateRoleByName('NonExistent', { level: 200 });
            } catch (error) {
                expect(error.message).to.include("Role with name 'NonExistent' not found");
            }
        });

        it('should throw error when updating to existing name', async () => {
            const updateData = { name: 'ExistingRole' };
            
            sandbox.stub(roleRepository, 'updateRoleByName').throws(new Error("Role with name 'ExistingRole' already exists"));
            
            try {
                await roleRepository.updateRoleByName('Admin', updateData);
            } catch (error) {
                expect(error.message).to.include("Role with name 'ExistingRole' already exists");
            }
        });

        it('should throw error when updating to existing level', async () => {
            const updateData = { level: 200 };
            
            sandbox.stub(roleRepository, 'updateRoleByName').throws(new Error("Role with level '200' already exists"));
            
            try {
                await roleRepository.updateRoleByName('Admin', updateData);
            } catch (error) {
                expect(error.message).to.include("Role with level '200' already exists");
            }
        });
    });

    describe('Delete role by name', () => {
        it('should delete role successfully', async () => {
            sandbox.stub(roleRepository, 'findByName').resolves(role);
            sandbox.stub(roleRepository, 'deleteRoleByName').resolves(role);
            
            const result = await roleRepository.deleteRoleByName('Admin');
            
            expect(result).to.have.property('_id');
            expect(result.name).to.equal('Admin');
        });

        it('should throw error when role not found', async () => {
            sandbox.stub(roleRepository, 'deleteRoleByName').throws(new Error("Role with name 'NonExistent' not found"));
            
            try {
                await roleRepository.deleteRoleByName('NonExistent');
            } catch (error) {
                expect(error.message).to.include("Role with name 'NonExistent' not found");
            }
        });
    });

    describe('Get highest and lowest level roles', () => {
        it('should get highest level role', async () => {
            const highestRole = { ...role, name: 'Super Admin', level: 1000 };
            sandbox.stub(roleRepository, 'getHighestLevelRole').resolves(highestRole);
            
            const result = await roleRepository.getHighestLevelRole();
            
            expect(result.level).to.equal(1000);
            expect(result.name).to.equal('Super Admin');
        });

        it('should get lowest level role', async () => {
            const lowestRole = { ...role, name: 'Guest', level: 0 };
            sandbox.stub(roleRepository, 'getLowestLevelRole').resolves(lowestRole);
            
            const result = await roleRepository.getLowestLevelRole();
            
            expect(result.level).to.equal(0);
            expect(result.name).to.equal('Guest');
        });

        it('should return null when no roles exist for highest', async () => {
            sandbox.stub(roleRepository, 'getHighestLevelRole').resolves(null);
            
            const result = await roleRepository.getHighestLevelRole();
            
            expect(result).to.be.null;
        });

        it('should return null when no roles exist for lowest', async () => {
            sandbox.stub(roleRepository, 'getLowestLevelRole').resolves(null);
            
            const result = await roleRepository.getLowestLevelRole();
            
            expect(result).to.be.null;
        });
    });

    describe('Search roles by name', () => {
        it('should find roles matching pattern', async () => {
            const matchingRoles = [
                { ...role, name: 'Admin' },
                { ...role, name: 'System Admin' }
            ];
            
            sandbox.stub(roleRepository, 'searchRolesByName').resolves(matchingRoles);
            
            const result = await roleRepository.searchRolesByName('Admin');
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(2);
            expect(result.every(r => r.name.includes('Admin'))).to.be.true;
        });

        it('should return empty array when no matches', async () => {
            sandbox.stub(roleRepository, 'searchRolesByName').resolves([]);
            
            const result = await roleRepository.searchRolesByName('NonExistent');
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });

        it('should be case insensitive', async () => {
            const matchingRoles = [{ ...role, name: 'Admin' }];
            sandbox.stub(roleRepository, 'searchRolesByName').resolves(matchingRoles);
            
            const result = await roleRepository.searchRolesByName('admin');
            
            expect(result).to.have.length(1);
            expect(result[0].name).to.equal('Admin');
        });
    });

    describe('Role statistics', () => {
        it('should return comprehensive role statistics', async () => {
            const stats = {
                totalRoles: 5,
                minLevel: 0,
                maxLevel: 1000,
                avgLevel: 200,
                levelRange: 1000,
                roles: [
                    { name: 'Guest', level: 0 },
                    { name: 'User', level: 10 },
                    { name: 'Moderator', level: 50 },
                    { name: 'Admin', level: 100 },
                    { name: 'Super Admin', level: 1000 }
                ]
            };
            
            sandbox.stub(roleRepository, 'getRoleStatistics').resolves(stats);
            
            const result = await roleRepository.getRoleStatistics();
            
            expect(result).to.have.property('totalRoles', 5);
            expect(result).to.have.property('minLevel', 0);
            expect(result).to.have.property('maxLevel', 1000);
            expect(result).to.have.property('avgLevel', 200);
            expect(result).to.have.property('levelRange', 1000);
            expect(result.roles).to.be.an('array');
            expect(result.roles).to.have.length(5);
        });

        it('should return default statistics when no roles exist', async () => {
            const defaultStats = {
                totalRoles: 0,
                minLevel: null,
                maxLevel: null,
                avgLevel: null,
                levelRange: null,
                roles: []
            };
            
            sandbox.stub(roleRepository, 'getRoleStatistics').resolves(defaultStats);
            
            const result = await roleRepository.getRoleStatistics();
            
            expect(result.totalRoles).to.equal(0);
            expect(result.minLevel).to.be.null;
            expect(result.maxLevel).to.be.null;
            expect(result.avgLevel).to.be.null;
            expect(result.levelRange).to.be.null;
            expect(result.roles).to.be.an('array');
            expect(result.roles).to.have.length(0);
        });
    });

    describe('Role data validation', () => {
        it('should validate correct role data', async () => {
            const validData = {
                name: 'Manager',
                level: 75
            };
            
            sandbox.stub(roleRepository, 'validateRoleData').resolves(true);
            
            const result = await roleRepository.validateRoleData(validData);
            
            expect(result).to.be.true;
        });

        it('should throw error for missing name', async () => {
            const invalidData = {
                level: 75
            };
            
            sandbox.stub(roleRepository, 'validateRoleData').throws(new Error('Validation errors: Role name is required and must be a string'));
            
            try {
                await roleRepository.validateRoleData(invalidData);
            } catch (error) {
                expect(error.message).to.include('Role name is required');
            }
        });

        it('should throw error for invalid name type', async () => {
            const invalidData = {
                name: 123,
                level: 75
            };
            
            sandbox.stub(roleRepository, 'validateRoleData').throws(new Error('Validation errors: Role name is required and must be a string'));
            
            try {
                await roleRepository.validateRoleData(invalidData);
            } catch (error) {
                expect(error.message).to.include('Role name is required and must be a string');
            }
        });

        it('should throw error for short name', async () => {
            const invalidData = {
                name: 'A',
                level: 75
            };
            
            sandbox.stub(roleRepository, 'validateRoleData').throws(new Error('Validation errors: Role name must be at least 2 characters long'));
            
            try {
                await roleRepository.validateRoleData(invalidData);
            } catch (error) {
                expect(error.message).to.include('Role name must be at least 2 characters long');
            }
        });

        it('should throw error for long name', async () => {
            const invalidData = {
                name: 'A'.repeat(51),
                level: 75
            };
            
            sandbox.stub(roleRepository, 'validateRoleData').throws(new Error('Validation errors: Role name must be less than 50 characters'));
            
            try {
                await roleRepository.validateRoleData(invalidData);
            } catch (error) {
                expect(error.message).to.include('Role name must be less than 50 characters');
            }
        });

        it('should throw error for missing level', async () => {
            const invalidData = {
                name: 'Manager'
            };
            
            sandbox.stub(roleRepository, 'validateRoleData').throws(new Error('Validation errors: Role level is required'));
            
            try {
                await roleRepository.validateRoleData(invalidData);
            } catch (error) {
                expect(error.message).to.include('Role level is required');
            }
        });

        it('should throw error for non-integer level', async () => {
            const invalidData = {
                name: 'Manager',
                level: 75.5
            };
            
            sandbox.stub(roleRepository, 'validateRoleData').throws(new Error('Validation errors: Role level must be an integer'));
            
            try {
                await roleRepository.validateRoleData(invalidData);
            } catch (error) {
                expect(error.message).to.include('Role level must be an integer');
            }
        });

        it('should throw error for negative level', async () => {
            const invalidData = {
                name: 'Manager',
                level: -10
            };
            
            sandbox.stub(roleRepository, 'validateRoleData').throws(new Error('Validation errors: Role level must be non-negative'));
            
            try {
                await roleRepository.validateRoleData(invalidData);
            } catch (error) {
                expect(error.message).to.include('Role level must be non-negative');
            }
        });

        it('should throw error for level above maximum', async () => {
            const invalidData = {
                name: 'Manager',
                level: 1001
            };
            
            sandbox.stub(roleRepository, 'validateRoleData').throws(new Error('Validation errors: Role level must be less than or equal to 1000'));
            
            try {
                await roleRepository.validateRoleData(invalidData);
            } catch (error) {
                expect(error.message).to.include('Role level must be less than or equal to 1000');
            }
        });
    });

    describe('Bulk create roles', () => {
        it('should create multiple roles successfully', async () => {
            const rolesData = [
                { name: 'Manager', level: 75 },
                { name: 'Supervisor', level: 60 }
            ];

            const bulkResult = {
                success: [
                    { ...role, name: 'Manager', level: 75 },
                    { ...role, name: 'Supervisor', level: 60 }
                ],
                errors: [],
                successCount: 2,
                errorCount: 0
            };
            
            sandbox.stub(roleRepository, 'bulkCreateRoles').resolves(bulkResult);
            
            const result = await roleRepository.bulkCreateRoles(rolesData);
            
            expect(result.successCount).to.equal(2);
            expect(result.errorCount).to.equal(0);
            expect(result.success).to.have.length(2);
            expect(result.errors).to.have.length(0);
        });

        it('should handle partial failures in bulk creation', async () => {
            const rolesData = [
                { name: 'Manager', level: 75 },
                { name: 'Invalid', level: -10 }
            ];

            const bulkResult = {
                success: [
                    { ...role, name: 'Manager', level: 75 }
                ],
                errors: [
                    {
                        roleData: { name: 'Invalid', level: -10 },
                        error: 'Validation errors: Role level must be non-negative'
                    }
                ],
                successCount: 1,
                errorCount: 1
            };
            
            sandbox.stub(roleRepository, 'bulkCreateRoles').resolves(bulkResult);
            
            const result = await roleRepository.bulkCreateRoles(rolesData);
            
            expect(result.successCount).to.equal(1);
            expect(result.errorCount).to.equal(1);
            expect(result.success).to.have.length(1);
            expect(result.errors).to.have.length(1);
            expect(result.errors[0]).to.have.property('error');
        });

        it('should handle all failures in bulk creation', async () => {
            const rolesData = [
                { name: 'A', level: 75 },
                { name: 'Invalid', level: -10 }
            ];

            const bulkResult = {
                success: [],
                errors: [
                    {
                        roleData: { name: 'A', level: 75 },
                        error: 'Validation errors: Role name must be at least 2 characters long'
                    },
                    {
                        roleData: { name: 'Invalid', level: -10 },
                        error: 'Validation errors: Role level must be non-negative'
                    }
                ],
                successCount: 0,
                errorCount: 2
            };
            
            sandbox.stub(roleRepository, 'bulkCreateRoles').resolves(bulkResult);
            
            const result = await roleRepository.bulkCreateRoles(rolesData);
            
            expect(result.successCount).to.equal(0);
            expect(result.errorCount).to.equal(2);
            expect(result.success).to.have.length(0);
            expect(result.errors).to.have.length(2);
        });
    });

    describe('Pagination', () => {
        it('should return paginated roles', async () => {
            const paginatedResult = {
                roles: [
                    { ...role, name: 'User', level: 10 },
                    { ...role, name: 'Moderator', level: 50 }
                ],
                pagination: {
                    currentPage: 1,
                    totalPages: 3,
                    totalItems: 5,
                    itemsPerPage: 2,
                    hasNextPage: true,
                    hasPrevPage: false
                }
            };
            
            sandbox.stub(roleRepository, 'getRolesWithPagination').resolves(paginatedResult);
            
            const result = await roleRepository.getRolesWithPagination(1, 2);
            
            expect(result.roles).to.have.length(2);
            expect(result.pagination.currentPage).to.equal(1);
            expect(result.pagination.totalPages).to.equal(3);
            expect(result.pagination.totalItems).to.equal(5);
            expect(result.pagination.hasNextPage).to.be.true;
            expect(result.pagination.hasPrevPage).to.be.false;
        });

        it('should handle middle page pagination', async () => {
            const paginatedResult = {
                roles: [
                    { ...role, name: 'Admin', level: 100 }
                ],
                pagination: {
                    currentPage: 2,
                    totalPages: 3,
                    totalItems: 5,
                    itemsPerPage: 2,
                    hasNextPage: true,
                    hasPrevPage: true
                }
            };
            
            sandbox.stub(roleRepository, 'getRolesWithPagination').resolves(paginatedResult);
            
            const result = await roleRepository.getRolesWithPagination(2, 2);
            
            expect(result.pagination.currentPage).to.equal(2);
            expect(result.pagination.hasNextPage).to.be.true;
            expect(result.pagination.hasPrevPage).to.be.true;
        });

        it('should handle last page pagination', async () => {
            const paginatedResult = {
                roles: [
                    { ...role, name: 'Super Admin', level: 1000 }
                ],
                pagination: {
                    currentPage: 3,
                    totalPages: 3,
                    totalItems: 5,
                    itemsPerPage: 2,
                    hasNextPage: false,
                    hasPrevPage: true
                }
            };
            
            sandbox.stub(roleRepository, 'getRolesWithPagination').resolves(paginatedResult);
            
            const result = await roleRepository.getRolesWithPagination(3, 2);
            
            expect(result.pagination.currentPage).to.equal(3);
            expect(result.pagination.hasNextPage).to.be.false;
            expect(result.pagination.hasPrevPage).to.be.true;
        });

        it('should apply filters in pagination', async () => {
            const filter = { level: { $gte: 50 } };
            const paginatedResult = {
                roles: [
                    { ...role, name: 'Moderator', level: 50 },
                    { ...role, name: 'Admin', level: 100 }
                ],
                pagination: {
                    currentPage: 1,
                    totalPages: 1,
                    totalItems: 2,
                    itemsPerPage: 10,
                    hasNextPage: false,
                    hasPrevPage: false
                }
            };
            
            sandbox.stub(roleRepository, 'getRolesWithPagination').resolves(paginatedResult);
            
            const result = await roleRepository.getRolesWithPagination(1, 10, filter);
            
            expect(result.roles.every(r => r.level >= 50)).to.be.true;
        });
    });

    describe('Error handling', () => {
        it('should handle database errors gracefully in createRole', async () => {
            const roleData = {
                name: 'Manager',
                level: 75
            };
            
            sandbox.stub(roleRepository, 'createRole').throws(new Error('Database connection error'));
            
            try {
                await roleRepository.createRole(roleData);
            } catch (error) {
                expect(error.message).to.include('Database connection error');
            }
        });

        it('should handle invalid ObjectId errors', async () => {
            sandbox.stub(roleRepository, 'findByLevel').throws(new Error('Invalid ObjectId'));
            
            try {
                await roleRepository.findByLevel('invalid-id');
            } catch (error) {
                expect(error.message).to.include('Invalid ObjectId');
            }
        });

        it('should handle aggregation pipeline errors', async () => {
            sandbox.stub(roleRepository, 'getRoleStatistics').throws(new Error('Aggregation failed'));
            
            try {
                await roleRepository.getRoleStatistics();
            } catch (error) {
                expect(error.message).to.include('Aggregation failed');
            }
        });

        it('should handle network timeouts gracefully', async () => {
            sandbox.stub(roleRepository, 'findByName').throws(new Error('Network timeout'));
            
            try {
                await roleRepository.findByName('Admin');
            } catch (error) {
                expect(error.message).to.include('Network timeout');
            }
        });
    });

    describe('Edge cases', () => {
        it('should handle role with maximum allowed level', async () => {
            const maxLevelRole = { ...role, level: 1000 };
            sandbox.stub(roleRepository, 'createRole').resolves(maxLevelRole);
            
            const roleData = { name: 'Maximum', level: 1000 };
            const result = await roleRepository.createRole(roleData);
            
            expect(result.level).to.equal(1000);
        });

        it('should handle role with minimum allowed level', async () => {
            const minLevelRole = { ...role, level: 0 };
            sandbox.stub(roleRepository, 'createRole').resolves(minLevelRole);
            
            const roleData = { name: 'Minimum', level: 0 };
            const result = await roleRepository.createRole(roleData);
            
            expect(result.level).to.equal(0);
        });

        it('should handle role with special characters in name', async () => {
            const specialRole = { ...role, name: 'Role-With_Special@Chars' };
            sandbox.stub(roleRepository, 'createRole').resolves(specialRole);
            
            const roleData = { name: 'Role-With_Special@Chars', level: 50 };
            const result = await roleRepository.createRole(roleData);
            
            expect(result.name).to.equal('Role-With_Special@Chars');
        });

        it('should handle empty search results', async () => {
            sandbox.stub(roleRepository, 'searchRolesByName').resolves([]);
            
            const result = await roleRepository.searchRolesByName('NonExistentPattern');
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });

        it('should handle single role in system', async () => {
            const stats = {
                totalRoles: 1,
                minLevel: 100,
                maxLevel: 100,
                avgLevel: 100,
                levelRange: 0,
                roles: [{ name: 'Admin', level: 100 }]
            };
            
            sandbox.stub(roleRepository, 'getRoleStatistics').resolves(stats);
            
            const result = await roleRepository.getRoleStatistics();
            
            expect(result.totalRoles).to.equal(1);
            expect(result.minLevel).to.equal(result.maxLevel);
            expect(result.levelRange).to.equal(0);
        });
    });
});
