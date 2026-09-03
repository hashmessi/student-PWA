import JSZip from 'jszip';
import { getAllStudents } from './db';

// Helper to escape CSV fields
function escapeCSV(field) {
  if (field === null || field === undefined) return '';
  const stringField = String(field);
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return stringField;
}

export async function generateExportZip(onProgress) {
  const students = await getAllStudents();
  const completedStudents = students.filter(s => s.status === 'complete');
  
  if (completedStudents.length === 0) {
    throw new Error('No completed student datasets found to export.');
  }

  const zip = new JSZip();
  const studentsFolder = zip.folder('students');
  const indexData = [];

  for (let i = 0; i < completedStudents.length; i++) {
    const student = completedStudents[i];
    
    // Progress callback (e.g., 0 to 100)
    if (onProgress) {
      onProgress(Math.round(((i) / completedStudents.length) * 100));
    }

    // Format: 21IT001_JohnDoe
    const cleanName = student.name.replace(/[^a-zA-Z0-9]/g, '');
    const folderName = `${student.regNo}_${cleanName}`;
    const studentFolder = studentsFolder.folder(folderName);
    
    // Save images (blobs)
    const images = student.photos; // The blob data from db
    if (!images || !images.front || !images.left || !images.right || !images.overall) {
      console.warn(`Skipping ${student.regNo} due to missing photos`);
      continue; // Skip if missing required photos
    }

    studentFolder.file('front.jpg', images.front);
    studentFolder.file('left.jpg', images.left);
    studentFolder.file('right.jpg', images.right);
    studentFolder.file('overall.jpg', images.overall);

    // Create metadata.json for the student
    const metadata = {
      regNo: student.regNo,
      name: student.name,
      dept: student.dept,
      section: student.section,
      email: student.email,
      capturedAt: student.timestamp || new Date().toISOString(),
      images: {
        front: 'front.jpg',
        left: 'left.jpg',
        right: 'right.jpg',
        overall: 'overall.jpg'
      },
      qualityChecksPassed: true
    };
    
    studentFolder.file('metadata.json', JSON.stringify(metadata, null, 2));

    // Prepare index data for CSV/JSON
    indexData.push({
      regNo: metadata.regNo,
      name: metadata.name,
      dept: metadata.dept,
      section: metadata.section,
      email: metadata.email,
      front: `students/${folderName}/front.jpg`,
      left: `students/${folderName}/left.jpg`,
      right: `students/${folderName}/right.jpg`,
      overall: `students/${folderName}/overall.jpg`,
      capturedAt: metadata.capturedAt
    });
  }

  // Create index.json
  zip.file('index.json', JSON.stringify(indexData, null, 2));

  // Create index.csv
  const csvHeaders = ['regNo', 'name', 'dept', 'section', 'email', 'front', 'left', 'right', 'overall', 'capturedAt'];
  const csvRows = indexData.map(row => {
    return csvHeaders.map(header => escapeCSV(row[header])).join(',');
  });
  const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
  zip.file('index.csv', csvContent);
  
  if (onProgress) onProgress(100);

  // Generate the final zip file Blob
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return zipBlob;
}

export async function generateSingleStudentZip(student, photos) {
  const zip = new JSZip();
  const cleanName = student.name.replace(/[^a-zA-Z0-9]/g, '');
  const folderName = `${student.regNo}_${cleanName}`;
  const studentFolder = zip.folder(folderName);

  const poses = ['front', 'left', 'right', 'overall'];
  for (const pose of poses) {
    if (photos[pose] && photos[pose].blob) {
      studentFolder.file(`${pose}.jpg`, photos[pose].blob);
    }
  }

  const metadata = {
    regNo: student.regNo,
    name: student.name,
    dept: student.dept,
    section: student.section,
    email: student.email,
    capturedAt: student.capturedAt || new Date().toISOString(),
    images: {
      front: 'front.jpg',
      left: 'left.jpg',
      right: 'right.jpg',
      overall: 'overall.jpg'
    },
    qualityChecksPassed: true
  };
  studentFolder.file('metadata.json', JSON.stringify(metadata, null, 2));

  return await zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

