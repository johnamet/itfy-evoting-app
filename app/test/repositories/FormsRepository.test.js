#!/usr/bin/env node
/**
 * Forms Repository test suite
 * This file contains tests for the FormsRepository class, ensuring that it correctly interacts with the Form model.
 **/
import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import FormsRepository from '../../repositories/FormsRepository.js';
import { after, afterEach, beforeEach, describe, it } from 'mocha';

describe('FormsRepository', () => {
    let formsRepository;
    let sandbox;
    let sampleForm;
    let sampleUser;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        formsRepository = new FormsRepository();
        
        sampleUser = new mongoose.Types.ObjectId();
        
        sampleForm = {
            _id: new mongoose.Types.ObjectId(),
            modelId: new mongoose.Types.ObjectId(),
            model: 'User',
            fields: [
                {
                    name: 'firstName',
                    label: 'First Name',
                    type: 'text',
                    required: true,
                    placeholder: 'Enter your first name'
                },
                {
                    name: 'email',
                    label: 'Email Address',
                    type: 'email',
                    required: true,
                    placeholder: 'Enter your email'
                }
            ],
            isActive: true,
            isDeleted: false,
            createdBy: sampleUser,
            updatedBy: sampleUser,
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

    describe('Constructor', () => {
        it('should create FormsRepository instance with Form model', () => {
            expect(formsRepository).to.be.instanceOf(FormsRepository);
            expect(formsRepository.model).to.exist;
        });
    });

    describe('createForm', () => {
        it('should create a new form with valid data', async () => {
            const createStub = sandbox.stub(formsRepository, 'create').resolves({
                ...sampleForm,
                toJSON: () => sampleForm
            });
            
            sandbox.stub(formsRepository, 'findByModelIdAndModel').resolves(null);

            const result = await formsRepository.createForm(sampleForm);
            
            expect(createStub.calledOnce).to.be.true;
            expect(result).to.deep.equal(sampleForm);
        });

        it('should throw error if form data is empty', async () => {
            try {
                await formsRepository.createForm({});
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('The Form Data is Empty');
            }
        });

        it('should throw error if form for model already exists', async () => {
            sandbox.stub(formsRepository, 'findByModelIdAndModel').resolves(sampleForm);

            try {
                await formsRepository.createForm(sampleForm);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('already exists');
            }
        });
    });

    describe('findByModelIdAndModel', () => {
        it('should find form by modelId and model name', async () => {
            const findOneStub = sandbox.stub(formsRepository, 'findOne').resolves(sampleForm);

            const result = await formsRepository.findByModelIdAndModel(sampleForm.modelId, sampleForm.model);

            expect(findOneStub.calledOnce).to.be.true;
            expect(findOneStub.calledWith({
                modelId: sampleForm.modelId,
                model: sampleForm.model,
                isDeleted: false
            })).to.be.true;
            expect(result).to.deep.equal(sampleForm);
        });

        it('should return null if form not found', async () => {
            sandbox.stub(formsRepository, 'findOne').resolves(null);

            const result = await formsRepository.findByModelIdAndModel(sampleForm.modelId, sampleForm.model);

            expect(result).to.be.null;
        });
    });

    describe('findByModel', () => {
        it('should find forms by model name', async () => {
            const forms = [sampleForm];
            const findStub = sandbox.stub(formsRepository, 'find').resolves(forms);

            const result = await formsRepository.findByModel('User');

            expect(findStub.calledOnce).to.be.true;
            expect(findStub.calledWith({
                model: 'User',
                isDeleted: false
            })).to.be.true;
            expect(result).to.deep.equal(forms);
        });
    });

    describe('findActiveForms', () => {
        it('should find active forms', async () => {
            const forms = [sampleForm];
            const findStub = sandbox.stub(formsRepository, 'find').resolves(forms);

            const result = await formsRepository.findActiveForms();

            expect(findStub.calledOnce).to.be.true;
            expect(findStub.calledWith({
                isActive: true,
                isDeleted: false
            })).to.be.true;
            expect(result).to.deep.equal(forms);
        });

        it('should find active forms with additional criteria', async () => {
            const forms = [sampleForm];
            const findStub = sandbox.stub(formsRepository, 'find').resolves(forms);
            const additionalCriteria = { model: 'User' };

            const result = await formsRepository.findActiveForms(additionalCriteria);

            expect(findStub.calledOnce).to.be.true;
            expect(findStub.calledWith({
                isActive: true,
                isDeleted: false,
                model: 'User'
            })).to.be.true;
            expect(result).to.deep.equal(forms);
        });
    });

    describe('findFormsWithPagination', () => {
        it('should find forms with pagination', async () => {
            const paginatedResult = {
                docs: [sampleForm],
                total: 1,
                page: 1,
                limit: 10,
                pages: 1,
                hasNext: false,
                hasPrev: false
            };
            
            const findWithPaginationStub = sandbox.stub(formsRepository, 'findWithPagination').resolves(paginatedResult);

            const result = await formsRepository.findFormsWithPagination();

            expect(findWithPaginationStub.calledOnce).to.be.true;
            expect(result).to.deep.equal(paginatedResult);
        });
    });

    describe('updateForm', () => {
        it('should update form by ID', async () => {
            const updateData = { model: 'UpdatedModel' };
            const updatedForm = { ...sampleForm, ...updateData };
            
            const updateByIdStub = sandbox.stub(formsRepository, 'updateById').resolves(updatedForm);

            const result = await formsRepository.updateForm(sampleForm._id, updateData);

            expect(updateByIdStub.calledOnce).to.be.true;
            expect(result).to.deep.equal(updatedForm);
        });
    });

    describe('softDeleteForm', () => {
        it('should soft delete form', async () => {
            const deletedForm = { ...sampleForm, isDeleted: true, isActive: false };
            const updateByIdStub = sandbox.stub(formsRepository, 'updateById').resolves(deletedForm);

            const result = await formsRepository.softDeleteForm(sampleForm._id, sampleUser);

            expect(updateByIdStub.calledOnce).to.be.true;
            expect(result).to.deep.equal(deletedForm);
        });
    });

    describe('restoreForm', () => {
        it('should restore soft deleted form', async () => {
            const restoredForm = { ...sampleForm, isDeleted: false, isActive: true };
            const updateByIdStub = sandbox.stub(formsRepository, 'updateById').resolves(restoredForm);

            const result = await formsRepository.restoreForm(sampleForm._id, sampleUser);

            expect(updateByIdStub.calledOnce).to.be.true;
            expect(result).to.deep.equal(restoredForm);
        });
    });

    describe('toggleActiveStatus', () => {
        it('should toggle form active status', async () => {
            const findByIdStub = sandbox.stub(formsRepository, 'findById').resolves(sampleForm);
            const toggledForm = { ...sampleForm, isActive: false };
            const updateByIdStub = sandbox.stub(formsRepository, 'updateById').resolves(toggledForm);

            const result = await formsRepository.toggleActiveStatus(sampleForm._id, sampleUser);

            expect(findByIdStub.calledOnce).to.be.true;
            expect(updateByIdStub.calledOnce).to.be.true;
            expect(result).to.deep.equal(toggledForm);
        });

        it('should throw error if form not found', async () => {
            sandbox.stub(formsRepository, 'findById').resolves(null);

            try {
                await formsRepository.toggleActiveStatus(sampleForm._id, sampleUser);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Form not found');
            }
        });
    });

    describe('findByCreator', () => {
        it('should find forms by creator', async () => {
            const forms = [sampleForm];
            const findStub = sandbox.stub(formsRepository, 'find').resolves(forms);

            const result = await formsRepository.findByCreator(sampleUser);

            expect(findStub.calledOnce).to.be.true;
            expect(findStub.calledWith({
                createdBy: sampleUser,
                isDeleted: false
            })).to.be.true;
            expect(result).to.deep.equal(forms);
        });
    });

    describe('updateFormFields', () => {
        it('should update form fields', async () => {
            const newFields = [
                {
                    name: 'lastName',
                    label: 'Last Name',
                    type: 'text',
                    required: true
                }
            ];
            
            const updatedForm = { ...sampleForm, fields: newFields };
            const updateFormStub = sandbox.stub(formsRepository, 'updateForm').resolves(updatedForm);

            const result = await formsRepository.updateFormFields(sampleForm._id, newFields, sampleUser);

            expect(updateFormStub.calledOnce).to.be.true;
            expect(result).to.deep.equal(updatedForm);
        });

        it('should throw error if fields is not an array', async () => {
            try {
                await formsRepository.updateFormFields(sampleForm._id, 'not an array', sampleUser);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Fields must be an array');
            }
        });
    });

    describe('searchForms', () => {
        it('should search forms by search term', async () => {
            const forms = [sampleForm];
            const findStub = sandbox.stub(formsRepository, 'find').resolves(forms);

            const result = await formsRepository.searchForms('User');

            expect(findStub.calledOnce).to.be.true;
            expect(result).to.deep.equal(forms);
        });

        it('should return empty array for empty search term', async () => {
            const result = await formsRepository.searchForms('');

            expect(result).to.deep.equal([]);
        });

        it('should return empty array for null search term', async () => {
            const result = await formsRepository.searchForms(null);

            expect(result).to.deep.equal([]);
        });
    });

    describe('getFormStatistics', () => {
        it('should get form statistics', async () => {
            const mockStats = {
                totalForms: 10,
                activeForms: 8,
                inactiveForms: 1,
                deletedForms: 1,
                formsByModel: [
                    { model: 'User', count: 5 },
                    { model: 'Event', count: 3 }
                ]
            };

            sandbox.stub(formsRepository, 'countDocuments')
                .onFirstCall().resolves(10)  // totalForms
                .onSecondCall().resolves(8)  // activeForms
                .onThirdCall().resolves(1);  // deletedForms

            sandbox.stub(formsRepository.model, 'aggregate').resolves([
                { _id: 'User', count: 5 },
                { _id: 'Event', count: 3 }
            ]);

            const result = await formsRepository.getFormStatistics();

            expect(result).to.have.property('totalForms', 10);
            expect(result).to.have.property('activeForms', 8);
            expect(result).to.have.property('inactiveForms', 1);
            expect(result).to.have.property('deletedForms', 1);
            expect(result.formsByModel).to.be.an('array').with.length(2);
        });
    });

    describe('bulkUpdateForms', () => {
        it('should bulk update forms', async () => {
            const formIds = [sampleForm._id];
            const updateData = { isActive: false };
            const updateResult = { modifiedCount: 1 };
            
            const updateManyStub = sandbox.stub(formsRepository, 'updateMany').resolves(updateResult);

            const result = await formsRepository.bulkUpdateForms(formIds, updateData, sampleUser);

            expect(updateManyStub.calledOnce).to.be.true;
            expect(result).to.deep.equal(updateResult);
        });

        it('should throw error if formIds is empty', async () => {
            try {
                await formsRepository.bulkUpdateForms([], {}, sampleUser);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Form IDs must be a non-empty array');
            }
        });

        it('should throw error if formIds is not an array', async () => {
            try {
                await formsRepository.bulkUpdateForms('not an array', {}, sampleUser);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Form IDs must be a non-empty array');
            }
        });
    });

    describe('getFormsWithFieldCount', () => {
        it('should get forms with field count', async () => {
            const formsWithCount = [
                { ...sampleForm, fieldCount: 2 }
            ];
            
            sandbox.stub(formsRepository.model, 'aggregate').resolves(formsWithCount);

            const result = await formsRepository.getFormsWithFieldCount();

            expect(result).to.deep.equal(formsWithCount);
        });
    });
});
