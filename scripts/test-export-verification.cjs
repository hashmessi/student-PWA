const JSZip = require('jszip');

// Minimal 1x1 pixel JPEG buffer
const DUMMY_JPEG = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60,
  0x00, 0x60, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
  0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
  0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
  0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
  0x00, 0xBF, 0x80, 0xFF, 0xD9
]);

const DUMMY_BASE64_DATA_URL = `data:image/jpeg;base64,${DUMMY_JPEG.toString('base64')}`;

async function resolveImageBlob(photoItem, fallbackUrl) {
  let blob = null;

  // 1. Direct Blob instance
  if (photoItem instanceof Blob) {
    blob = photoItem;
  } else if (photoItem && photoItem.blob instanceof Blob) {
    blob = photoItem.blob;
  } else if (photoItem instanceof Uint8Array || photoItem instanceof ArrayBuffer) {
    return photoItem;
  }

  if (!blob) {
    const urlCandidate =
      (typeof photoItem === 'string' ? photoItem : null) ||
      photoItem?.dataUrl ||
      photoItem?.url ||
      fallbackUrl;

    if (!urlCandidate || typeof urlCandidate !== 'string') {
      return null;
    }

    if (urlCandidate.startsWith('data:')) {
      try {
        const parts = urlCandidate.split(',');
        const binary = Buffer.from(parts[1] || '', 'base64');
        return new Uint8Array(binary);
      } catch (e) {
        return null;
      }
    }

    if (urlCandidate.startsWith('blob:') || urlCandidate.startsWith('http://') || urlCandidate.startsWith('https://')) {
      try {
        const res = await fetch(urlCandidate);
        blob = await res.blob();
      } catch (e) {
        return null;
      }
    }
  }

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

async function testSingleExport() {
  console.log('\n--- 1. Testing Single Student Export with Cloud/DataURL format ---');
  const student = {
    regNo: '310625205101',
    name: 'Hashvanth Test',
    dept: 'IT',
    section: 'B',
    email: '310625205101@eec.srmrmp.edu.in',
    status: 'complete',
  };

  // Simulating the exact state from StudentDetailModal where photos has { dataUrl, pose, qualityScore }
  const modalPhotosState = {
    front: { dataUrl: DUMMY_BASE64_DATA_URL, pose: 'front', qualityScore: { yaw: 0 } },
    left: { dataUrl: DUMMY_BASE64_DATA_URL, pose: 'left', qualityScore: { yaw: -35 } },
    right: { dataUrl: DUMMY_BASE64_DATA_URL, pose: 'right', qualityScore: { yaw: 35 } },
    overall: { dataUrl: DUMMY_BASE64_DATA_URL, pose: 'overall', qualityScore: { yaw: 0 } },
  };

  const zip = new JSZip();
  const cleanName = student.name.replace(/[^a-zA-Z0-9]/g, '');
  const folderName = `${student.regNo}_${cleanName || 'Student'}`;
  const studentFolder = zip.folder(folderName);

  const poses = ['front', 'left', 'right', 'overall'];
  let validCount = 0;

  const poseBlobs = await Promise.all(
    poses.map(async (pose) => {
      const photoItem = modalPhotosState[pose];
      const fallbackUrl = student.photoUrls?.[pose];
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
    capturedAt: new Date().toISOString(),
    images: {
      front: 'front.jpg',
      left: 'left.jpg',
      right: 'right.jpg',
      overall: 'overall.jpg',
    },
    qualityChecksPassed: true,
  };
  studentFolder.file('metadata.json', JSON.stringify(metadata, null, 2));

  const zipBlob = await zip.generateAsync({ type: 'nodebuffer' });
  console.log(`✓ Single ZIP generated successfully (${zipBlob.length} bytes)`);

  const readZip = await JSZip.loadAsync(zipBlob);
  const files = Object.keys(readZip.files);
  console.log('✓ Files in single student ZIP:');
  files.forEach(f => console.log(`   - ${f}`));

  if (!files.includes(`${folderName}/front.jpg`) || !files.includes(`${folderName}/metadata.json`)) {
    throw new Error('Missing expected files in single ZIP');
  }
  console.log('✅ Single Student Export Verified Cleanly!');
}

async function testWholeExport() {
  console.log('\n--- 2. Testing Master Whole Export with multiple students ---');
  const students = [
    {
      regNo: '310625205065',
      name: 'Dhanush',
      dept: 'IT',
      section: 'A',
      email: '310625205065@eec.srmrmp.edu.in',
      photos: {
        front: { dataUrl: DUMMY_BASE64_DATA_URL },
        left: { dataUrl: DUMMY_BASE64_DATA_URL },
        right: { dataUrl: DUMMY_BASE64_DATA_URL },
        overall: { dataUrl: DUMMY_BASE64_DATA_URL },
      }
    },
    {
      regNo: '310625205101',
      name: 'Hashvanth M U',
      dept: 'IT',
      section: 'B',
      email: '310625205101@eec.srmrmp.edu.in',
      photos: {
        front: new Blob([DUMMY_JPEG], { type: 'image/jpeg' }),
        left: new Blob([DUMMY_JPEG], { type: 'image/jpeg' }),
        right: new Blob([DUMMY_JPEG], { type: 'image/jpeg' }),
        overall: new Blob([DUMMY_JPEG], { type: 'image/jpeg' }),
      }
    }
  ];

  const zip = new JSZip();
  const studentsFolder = zip.folder('students');
  const indexData = [];

  for (const student of students) {
    const cleanName = student.name.replace(/[^a-zA-Z0-9]/g, '');
    const folderName = `${student.regNo}_${cleanName || 'Student'}`;
    const studentFolder = studentsFolder.folder(folderName);

    const poses = ['front', 'left', 'right', 'overall'];
    let validCount = 0;

    const poseBlobs = await Promise.all(
      poses.map(async (pose) => {
        const photoItem = student.photos ? student.photos[pose] : null;
        const blob = await resolveImageBlob(photoItem);
        return { pose, blob };
      })
    );

    for (const { pose, blob } of poseBlobs) {
      if (blob) {
        studentFolder.file(`${pose}.jpg`, blob);
        validCount++;
      }
    }

    const metadata = {
      regNo: student.regNo,
      name: student.name,
      dept: student.dept,
      section: student.section,
      email: student.email,
      capturedAt: new Date().toISOString(),
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

  zip.file('index.json', JSON.stringify(indexData, null, 2));
  zip.file('index.csv', `regNo,name,dept,section,email\n310625205065,Dhanush,IT,A,310625205065@eec.srmrmp.edu.in\n310625205101,Hashvanth M U,IT,B,310625205101@eec.srmrmp.edu.in`);

  const zipBlob = await zip.generateAsync({ type: 'nodebuffer' });
  console.log(`✓ Master ZIP generated successfully (${zipBlob.length} bytes)`);

  const readZip = await JSZip.loadAsync(zipBlob);
  const files = Object.keys(readZip.files);
  console.log('✓ Files in Master ZIP:');
  files.forEach(f => console.log(`   - ${f}`));

  if (!files.includes('index.json') || !files.includes('index.csv')) {
    throw new Error('Missing index files in Master ZIP');
  }
  console.log('✅ Whole Dataset Master Export Verified Cleanly!');
}

async function run() {
  try {
    await testSingleExport();
    await testWholeExport();
    console.log('\n=========================================');
    console.log('🎉 ALL EXPORT PIPELINE TESTS PASSED 100%!');
    console.log('=========================================\n');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exitCode = 1;
  }
}

run();
