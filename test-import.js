import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

// Read the CSV file
const file = readFileSync('/workspace/uploads/customer_import_template (1) (2).csv');
const workbook = XLSX.read(file, { type: 'buffer' });

const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Get raw data
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
console.log('Headers:', rawData[0]);
console.log('First data row:', rawData[1]);

// Get JSON data
const jsonData = XLSX.utils.sheet_to_json(worksheet);
console.log('\nFirst JSON row:');
console.log(JSON.stringify(jsonData[0], null, 2));

// Test column matching
const firstRow = jsonData[0];
console.log('\nColumn keys:', Object.keys(firstRow));
console.log('\nValues:');
console.log('Customer Name:', firstRow['Customer Name']);
console.log('3PL ID:', firstRow['3PL ID']);
console.log('Reference Prefix:', firstRow['Reference Prefix']);
console.log('Reference Counter:', firstRow['Reference Counter']);
console.log('Email 1:', firstRow['Email 1']);