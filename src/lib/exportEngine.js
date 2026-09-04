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

/**
 * Resolves various image representations (Blob, Object with .blob, DataURL, Blob URL, Remote HTTPS URL)
 * into a valid binary format (Uint8Array / Blob) ready for reliable JSZip packaging.
 * @param {Blob|object|string} photoItem
 * @param {string} [fallbackUrl]
 * @returns {Promise<Uint8Array|Blob|null>}
 */
async function resolveImageBlob(photoItem, fallbackUrl) {
  let blob = null;

  // 1. Direct Blob or Uint8Array/ArrayBuffer
  if (photoItem instanceof Blob) {
    blob = photoItem;
  } else if (photoItem && photoItem.blob instanceof Blob) {
    blob = photoItem.blob;
  } else if (photoItem instanceof Uint8Array || photoItem instanceof ArrayBuffer) {
    return photoItem;
  }

  // 2. Resolve candidate URL string if blob not yet obtained
  if (!blob) {
    const urlCandidate =
      (typeof photoItem === 'string' ? photoItem : null) ||
      photoItem?.dataUrl ||
      photoItem?.url ||
      fallbackUrl;

    if (!urlCandidate || typeof urlCandidate !== 'string') {
      return null;
    }

    // 3. Data URI (base64)
    if (urlCandidate.startsWith('data:')) {
      try {
        const parts = urlCandidate.split(',');
        const binary = atob(parts[1] || '');
        const len = binary.length;
        const u8 = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          u8[i] = binary.charCodeAt(i);
        }
        return u8;
      } catch (e) {
        try {
          const res = await fetch(urlCandidate);
          blob = await res.blob();
        } catch (fetchErr) {
          console.warn('Failed to parse data URL:', fetchErr);
          return null;
        }
      }
    }

    // 4. Blob URL
    else if (urlCandidate.startsWith('blob:')) {
      try {
        const res = await fetch(urlCandidate);
        blob = await res.blob();
      } catch (e) {
        console.warn('Failed to fetch blob URL:', e);
        return null;
      }
    }

    // 5. Remote HTTPS / HTTP Supabase CDN URL
    else if (urlCandidate.startsWith('http://') || urlCandidate.startsWith('https://')) {
      try {
        blob = await fetchImageBlob(urlCandidate);
      } catch (e) {
        console.warn(`Failed to fetch image from ${urlCandidate}:`, e);
        return null;
      }
    }
  }

  // Convert Blob to Uint8Array for optimal JSZip performance
  if (blob) {
    try {
      const buffer = await blob.arrayBuffer();
      return new Uint8Array(buffer);
    } catch (e) {
      return blob;
    }
  }

  return null;
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

    // Fetch and resolve all 4 poses in parallel for high export speed
    const poseBlobs = await Promise.all(
      poses.map(async (pose) => {
        const photoItem = images ? images[pose] : null;
        const fallbackUrl = student.photoUrls ? student.photoUrls[pose] : null;
        const blob = await resolveImageBlob(photoItem, fallbackUrl);
        return { pose, blob };
      })
    );

    for (const { pose, blob } of poseBlobs) {
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

  // Fallback to IndexedDB if photos object is empty or missing
  let photoMap = photos;
  if (!photoMap || Object.keys(photoMap).length === 0) {
    try {
      photoMap = await getStudentPhotos(student.regNo);
    } catch (e) {
      photoMap = {};
    }
  }

  const poses = ['front', 'left', 'right', 'overall'];
  let validCount = 0;

  // Resolve all 4 poses in parallel
  const poseBlobs = await Promise.all(
    poses.map(async (pose) => {
      const photoItem = photoMap ? photoMap[pose] : null;
      const fallbackUrl = student.photoUrls ? student.photoUrls[pose] : null;
      const blob = await resolveImageBlob(photoItem, fallbackUrl);
      return { pose, blob };
    })
  );

  for (const { pose, blob } of poseBlobs) {
    if (blob) {
      studentFolder.file(`${pose}.jpg`, blob);
      validCount++;
    }
  }

  if (validCount === 0) {
    throw new Error(`No photo files found for student ${student.name} (${student.regNo}).`);
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
