import JSZip from 'jszip';
import { getAllStudents, getStudentPhotos } from './db';
import { isSupabaseConfigured, fetchStudentsFromSupabase, fetchImageBlob } from './supabase';

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
  // 1. Merge completed records from both Local IndexedDB and Supabase Cloud
  const mergedMap = new Map();

  // Local records
  try {
    const localStudents = await getAllStudents();
    for (const s of localStudents) {
      if (s.status === 'complete') {
        mergedMap.set(s.regNo, { ...s, source: 'local' });
      }
    }
  } catch (e) {
    console.warn('Local student fetch error:', e);
  }

  // Cloud records (from other mobile devices)
  if (isSupabaseConfigured()) {
    try {
      const cloudStudents = await fetchStudentsFromSupabase();
      for (const s of cloudStudents) {
        if (s.status === 'complete') {
          if (!mergedMap.has(s.regNo)) {
            mergedMap.set(s.regNo, { ...s, source: 'cloud' });
          } else {
            // Merge cloud photoUrls if local is missing blobs
            const existing = mergedMap.get(s.regNo);
            mergedMap.set(s.regNo, {
              ...existing,
              photoUrls: s.photoUrls || existing.photoUrls,
            });
          }
        }
      }
    } catch (e) {
      console.warn('Cloud student fetch error:', e);
    }
  }

  const completedStudents = Array.from(mergedMap.values());

  if (completedStudents.length === 0) {
    throw new Error('No completed student datasets found to export.');
  }

  const zip = new JSZip();
  const studentsFolder = zip.folder('students');
  const indexData = [];

  for (let i = 0; i < completedStudents.length; i++) {
    const student = completedStudents[i];

    if (onProgress) {
      onProgress(Math.round(((i) / completedStudents.length) * 100));
    }

    const cleanName = student.name.replace(/[^a-zA-Z0-9]/g, '');
    const folderName = `${student.regNo}_${cleanName || 'Student'}`;
    const studentFolder = studentsFolder.folder(folderName);

    // Retrieve 4 image blobs (from IndexedDB or Supabase Cloud)
    let images = student.photos;
    if (!images) {
      try {
        images = await getStudentPhotos(student.regNo);
      } catch (e) {
        images = null;
      }
    }

    const poses = ['front', 'left', 'right', 'overall'];
    let validCount = 0;

    for (const pose of poses) {
      let blob = null;
      if (images && images[pose]) {
        blob = images[pose].blob || images[pose];
      }

      // Fallback: download from Supabase storage URL
      if (!blob && student.photoUrls && student.photoUrls[pose]) {
        try {
          blob = await fetchImageBlob(student.photoUrls[pose]);
        } catch (downloadErr) {
          console.warn(`Failed to download ${pose} for ${student.regNo}:`, downloadErr);
        }
      }

      if (blob) {
        studentFolder.file(`${pose}.jpg`, blob);
        validCount++;
      }
    }

    if (validCount === 0) {
      console.warn(`Skipping ${student.regNo} due to missing photos`);
      continue;
    }

    // Create metadata.json for the student
    const metadata = {
      regNo: student.regNo,
      name: student.name,
      dept: student.dept,
      section: student.section,
      email: student.email,
      capturedAt: student.createdAt || student.capturedAt || new Date().toISOString(),
      images: {
        front: 'front.jpg',
        left: 'left.jpg',
        right: 'right.jpg',
        overall: 'overall.jpg',
      },
      qualityChecksPassed: true,
    };

    studentFolder.file('metadata.json', JSON.stringify(metadata, null, 2));

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
      capturedAt: metadata.capturedAt,
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

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return zipBlob;
}

export async function generateSingleStudentZip(student, photos) {
  const zip = new JSZip();
  const cleanName = student.name.replace(/[^a-zA-Z0-9]/g, '');
  const folderName = `${student.regNo}_${cleanName || 'Student'}`;
  const studentFolder = zip.folder(folderName);

  const poses = ['front', 'left', 'right', 'overall'];
  for (const pose of poses) {
    let blob = photos[pose]?.blob || photos[pose];
    if (!blob && student.photoUrls && student.photoUrls[pose]) {
      try {
        blob = await fetchImageBlob(student.photoUrls[pose]);
      } catch (err) {
        console.warn(`Error fetching ${pose} blob:`, err);
      }
    }
    if (blob) {
      studentFolder.file(`${pose}.jpg`, blob);
    }
  }

  const metadata = {
    regNo: student.regNo,
    name: student.name,
    dept: student.dept,
    section: student.section,
    email: student.email,
    capturedAt: student.capturedAt || student.createdAt || new Date().toISOString(),
    images: {
      front: 'front.jpg',
      left: 'left.jpg',
      right: 'right.jpg',
      overall: 'overall.jpg',
    },
    qualityChecksPassed: true,
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
