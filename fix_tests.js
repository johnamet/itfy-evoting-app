#!/usr/bin/env node

import fs from 'fs';

const filePath = './app/test/repositories/ActivityRepository.test.js';
let content = fs.readFileSync(filePath, 'utf8');

// Fix chai-sinon patterns
content = content.replace(/expect\(([^)]+)\)\.to\.have\.been\.calledWith\(([^)]+)\)/g, 'expect($1.calledWith($2)).to.be.true');
content = content.replace(/expect\(([^)]+)\)\.to\.have\.been\.called(?!With)/g, 'expect($1.called).to.be.true');
content = content.replace(/expect\(([^)]+)\)\.to\.have\.been\.calledTwice/g, 'expect($1.calledTwice).to.be.true');
content = content.replace(/expect\(([^)]+)\)\.to\.have\.been\.calledThrice/g, 'expect($1.calledThrice).to.be.true');

// Fix the patterns that are like "called).to.be.trueWith(" which is malformed
content = content.replace(/expect\(([^)]+)\.called\)\.to\.be\.trueWith\(/g, 'expect($1.calledWith(');

fs.writeFileSync(filePath, content);
console.log('Fixed ActivityRepository test file!');
