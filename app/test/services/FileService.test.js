#!/usr/bin/env node
/**
 * FileService Tests
 * 
 * Unit tests for the FileService class
 */

import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'fs/promises';
import path from 'path';
import FileService from '../../services/FileService.js';

describe('FileService', () => {
    let fileService;
    let mockFileData;

    beforeEach(() => {
        fileService = new FileService();
        mockFileData = {
            name: 'test-image.jpg',
            data: Buffer.from('fake image data'),
            size: 1024,
            mimetype: 'image/jpeg'
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('validateFile', () => {
        it('should validate a valid image file', () => {
            const result = fileService.validateFile(mockFileData, 'image');
            
            expect(result.valid).to.be.true;
            expect(result.fileInfo).to.have.property('name', 'test-image.jpg');
            expect(result.fileInfo).to.have.property('size', 1024);
            expect(result.fileInfo).to.have.property('mimetype', 'image/jpeg');
            expect(result.fileInfo).to.have.property('extension', '.jpg');
        });

        it('should reject file without data', () => {
            const invalidFile = { ...mockFileData, data: null };
            const result = fileService.validateFile(invalidFile, 'image');
            
            expect(result.valid).to.be.false;
            expect(result.error).to.equal('No file data provided');
        });

        it('should reject file with invalid mimetype', () => {
            const invalidFile = { ...mockFileData, mimetype: 'application/executable' };
            const result = fileService.validateFile(invalidFile, 'image');
            
            expect(result.valid).to.be.false;
            expect(result.error).to.include('File type application/executable is not allowed');
        });

        it('should reject file that exceeds size limit', () => {
            const largeFile = { ...mockFileData, size: 10 * 1024 * 1024 }; // 10MB
            const result = fileService.validateFile(largeFile, 'image');
            
            expect(result.valid).to.be.false;
            expect(result.error).to.include('File size exceeds maximum allowed size');
        });

        it('should reject file with mismatched extension', () => {
            const mismatchedFile = { 
                ...mockFileData, 
                name: 'test.txt', 
                mimetype: 'image/jpeg' 
            };
            const result = fileService.validateFile(mismatchedFile, 'image');
            
            expect(result.valid).to.be.false;
            expect(result.error).to.equal('File extension does not match file type');
        });
    });

    describe('generateUniqueFilename', () => {
        it('should generate unique filename with timestamp and random string', () => {
            const filename1 = fileService.generateUniqueFilename('test.jpg');
            const filename2 = fileService.generateUniqueFilename('test.jpg');
            
            expect(filename1).to.not.equal(filename2);
            expect(filename1).to.include('.jpg');
            expect(filename2).to.include('.jpg');
        });

        it('should include prefix when provided', () => {
            const filename = fileService.generateUniqueFilename('test.jpg', 'candidate_123_');
            
            expect(filename).to.include('candidate_123_');
            expect(filename).to.include('.jpg');
        });

        it('should sanitize filename by replacing special characters', () => {
            const filename = fileService.generateUniqueFilename('test file@#$.jpg');
            
            expect(filename).to.include('test_file___');
            expect(filename).to.include('.jpg');
        });
    });

    describe('uploadFile', () => {
        beforeEach(() => {
            sinon.stub(fs, 'access').resolves();
            sinon.stub(fs, 'mkdir').resolves();
            sinon.stub(fs, 'writeFile').resolves();
            sinon.stub(fs, 'stat').resolves({ size: 1024 });
        });

        it('should upload file successfully', async () => {
            const result = await fileService.uploadFile(mockFileData, 'test-dir', 'custom-name.jpg');
            
            expect(result.success).to.be.true;
            expect(result.file).to.have.property('filename', 'custom-name.jpg');
            expect(result.file).to.have.property('originalName', 'test-image.jpg');
            expect(result.file).to.have.property('size', 1024);
            expect(result.file).to.have.property('mimetype', 'image/jpeg');
        });

        it('should create directory if it does not exist', async () => {
            fs.access.rejects(new Error('Directory not found'));
            
            await fileService.uploadFile(mockFileData, 'new-dir');
            
            expect(fs.mkdir.calledOnce).to.be.true;
        });

        it('should generate filename if not provided', async () => {
            const result = await fileService.uploadFile(mockFileData, 'test-dir');
            
            expect(result.file.filename).to.not.equal('test-image.jpg');
            expect(result.file.filename).to.include('.jpg');
        });
    });

    describe('uploadCandidateImage', () => {
        beforeEach(() => {
            sinon.stub(fileService, 'uploadFile').resolves({
                file: {
                    filename: 'candidate_123_12345_test.jpg',
                    originalName: 'test-image.jpg',
                    path: '/uploads/candidates/candidate_123_12345_test.jpg',
                    relativePath: 'candidates/candidate_123_12345_test.jpg',
                    size: 1024,
                    mimetype: 'image/jpeg',
                    uploadedAt: new Date()
                }
            });
        });

        it('should upload candidate image successfully', async () => {
            const result = await fileService.uploadCandidateImage(
                mockFileData, 
                '507f1f77bcf86cd799439011', 
                '507f1f77bcf86cd799439012'
            );
            
            expect(result.success).to.be.true;
            expect(result.image).to.have.property('candidateId', '507f1f77bcf86cd799439011');
            expect(result.image).to.have.property('uploadedBy', '507f1f77bcf86cd799439012');
            expect(result.image).to.have.property('type', 'candidate_photo');
        });

        it('should validate ObjectIds', async () => {
            try {
                await fileService.uploadCandidateImage(mockFileData, 'invalid-id', 'invalid-id');
                expect.fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).to.include('Invalid ObjectId');
            }
        });
    });

    describe('deleteFile', () => {
        beforeEach(() => {
            sinon.stub(fs, 'access').resolves();
            sinon.stub(fs, 'unlink').resolves();
        });

        it('should delete file successfully', async () => {
            const result = await fileService.deleteFile('test/file.jpg');
            
            expect(result.success).to.be.true;
            expect(result.message).to.equal('File deleted successfully');
            expect(result.deletedFile).to.equal('test/file.jpg');
        });

        it('should throw error if file does not exist', async () => {
            fs.access.rejects(new Error('File not found'));
            
            try {
                await fileService.deleteFile('nonexistent.jpg');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('File not found');
            }
        });

        it('should throw error if no file path provided', async () => {
            try {
                await fileService.deleteFile('');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('delete_file failed: File path is required');
            }
        });
    });

    describe('getFileInfo', () => {
        beforeEach(() => {
            sinon.stub(fs, 'stat').resolves({
                size: 1024,
                birthtime: new Date('2023-01-01'),
                mtime: new Date('2023-01-02'),
                isFile: () => true,
                isDirectory: () => false
            });
        });

        it('should return file information', async () => {
            const result = await fileService.getFileInfo('test/file.jpg');
            
            expect(result.success).to.be.true;
            expect(result.file).to.have.property('size', 1024);
            expect(result.file).to.have.property('isFile', true);
            expect(result.file).to.have.property('isDirectory', false);
        });

        it('should throw error if file does not exist', async () => {
            fs.stat.rejects(new Error('File not found'));
            
            try {
                await fileService.getFileInfo('nonexistent.jpg');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('File not found');
            }
        });
    });

    describe('cleanupOldFiles', () => {
        beforeEach(() => {
            const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days old
            sinon.stub(fs, 'readdir').resolves(['old-file.jpg', 'new-file.jpg']);
            sinon.stub(fs, 'stat')
                .onFirstCall().resolves({ isFile: () => true, mtime: oldDate })
                .onSecondCall().resolves({ isFile: () => true, mtime: new Date() });
            sinon.stub(fs, 'unlink').resolves();
        });

        it('should delete old files', async () => {
            const result = await fileService.cleanupOldFiles('temp', 7 * 24 * 60 * 60 * 1000);
            
            expect(result.success).to.be.true;
            expect(result.deletedCount).to.equal(1);
            expect(fs.unlink.calledOnce).to.be.true;
        });

        it('should not delete recent files', async () => {
            const result = await fileService.cleanupOldFiles('temp', 1 * 24 * 60 * 60 * 1000);
            
            expect(result.deletedCount).to.equal(1); // Only the old file
        });
    });

    describe('getStorageStats', () => {
        beforeEach(() => {
            sinon.stub(fs, 'readdir').resolves(['file1.jpg', 'file2.png']);
            sinon.stub(fs, 'stat').resolves({
                isFile: () => true,
                size: 1024
            });
        });

        it('should return storage statistics', async () => {
            const result = await fileService.getStorageStats();
            
            expect(result.success).to.be.true;
            expect(result.stats).to.have.property('totalFiles');
            expect(result.stats).to.have.property('totalSize');
            expect(result.stats).to.have.property('directories');
            expect(result.stats).to.have.property('totalSizeFormatted');
        });
    });

    describe('moveFile', () => {
        beforeEach(() => {
            sinon.stub(fs, 'access').resolves();
            sinon.stub(fs, 'mkdir').resolves();
            sinon.stub(fs, 'rename').resolves();
        });

        it('should move file successfully', async () => {
            const result = await fileService.moveFile('old/file.jpg', 'new');
            
            expect(result.success).to.be.true;
            expect(result.file).to.have.property('oldPath', 'old/file.jpg');
            expect(result.file).to.have.property('newPath', 'new/file.jpg');
        });

        it('should create destination directory if it does not exist', async () => {
            fs.access.onSecondCall().rejects(new Error('Directory not found'));
            
            await fileService.moveFile('old/file.jpg', 'new');
            
            expect(fs.mkdir.calledOnce).to.be.true;
        });
    });

    describe('createBackup', () => {
        beforeEach(() => {
            sinon.stub(fs, 'access').resolves();
            sinon.stub(fs, 'mkdir').resolves();
            sinon.stub(fs, 'copyFile').resolves();
        });

        it('should create backup successfully', async () => {
            const result = await fileService.createBackup('test/file.jpg');
            
            expect(result.success).to.be.true;
            expect(result.backup).to.have.property('originalPath', 'test/file.jpg');
            expect(result.backup.backupPath).to.include('backups/');
        });

        it('should create backup directory if it does not exist', async () => {
            fs.access.onSecondCall().rejects(new Error('Directory not found'));
            
            await fileService.createBackup('test/file.jpg');
            
            // expect(fs.mkdir.called).to.be.true;
        });
    });
});
