const { createClient } = require('@supabase/supabase-js');
const JSZip = require('jszip');

const SUPABASE_URL = 'https://yeikfafilyhqjcavzqov.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllaWtmYWZpbHlocWpjYXZ6cW92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NTQyMDYsImV4cCI6MjEwNDAzMDIwNn0.2721yFM2SmsA70BqT8Of2qNVDd_DBs8zbO8DNOJz08o';

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Minimal 1x1 pixel JPEG header as dummy valid JPEG
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

async function runEndToEndVerification() {
  console.log('\n======================================================');
  console.log('🚀 BRUTAL PRODUCT ENGINE: END-TO-END JOURNEY AUDIT');
  console.log('======================================================\n');

  const testRegNo = '310625205065_TEST';
  const testStudent = {
    reg_no: testRegNo,
    name: 'Dhanush',
    dept: 'IT',
    section: 'A',
    email: '310625205065@eec.srmrmp.edu.in',
    status: 'complete',
    device_info: 'E2E Automated Verifier / Headless Agent',
  };

  const poses = ['front', 'left', 'right', 'overall'];
  const photoUrls = {};

  try {
    // 1. Upload 4 poses to Supabase Storage
    console.log('STEP 1: Uploading 4 verified poses to storage bucket "student-faces"…');
    for (const pose of poses) {
      const filePath = `${testRegNo}/${pose}.jpg`;
      const { data, error } = await client.storage
        .from('student-faces')
        .upload(filePath, DUMMY_JPEG, { contentType: 'image/jpeg', upsert: true });

      if (error) {
        throw new Error(`Failed to upload ${pose}: ${error.message}`);
      }

      const { data: urlData } = client.storage.from('student-faces').getPublicUrl(filePath);
      photoUrls[pose] = urlData.publicUrl;
      console.log(`  ✓ Uploaded ${pose}.jpg -> ${urlData.publicUrl}`);
    }

    // 2. Upsert student metadata into 'students' table
    console.log('\nSTEP 2: Upserting student record into "students" table…');
    testStudent.photo_urls = photoUrls;
    testStudent.quality_scores = {
      front: { yaw: 0, brightness: 120, sharpness: 45 },
      left: { yaw: -38, brightness: 115, sharpness: 42 },
      right: { yaw: 35, brightness: 118, sharpness: 44 },
      overall: { yaw: 2, brightness: 125, sharpness: 48 },
    };

    const { data: dbData, error: dbError } = await client
      .from('students')
      .upsert(testStudent, { onConflict: 'reg_no' })
      .select();

    if (dbError) throw new Error(`Database upsert error: ${dbError.message}`);
    console.log('  ✓ Student record upserted successfully in Postgres table');

    // 3. Query back from database to verify integrity
    console.log('\nSTEP 3: Querying database to verify contract integrity…');
    const { data: fetched, error: fetchErr } = await client
      .from('students')
      .select('*')
      .eq('reg_no', testRegNo)
      .single();

    if (fetchErr || !fetched) throw new Error(`Fetch error: ${fetchErr?.message}`);
    console.log(`  ✓ Name: ${fetched.name}, RegNo: ${fetched.reg_no}, Dept: ${fetched.dept}, Section: ${fetched.section}`);
    console.log(`  ✓ Stored Photo URLs: ${Object.keys(fetched.photo_urls).join(', ')}`);

    // 4. Verify public URL HTTP accessibility
    console.log('\nSTEP 4: Testing public CDN image accessibility via HTTP fetch…');
    for (const pose of poses) {
      const url = fetched.photo_urls[pose];
      const res = await fetch(url);
      if (res.status !== 200) {
        throw new Error(`HTTP ${res.status} when fetching image from ${url}`);
      }
      console.log(`  ✓ HTTP ${res.status} OK: ${pose}.jpg (${res.headers.get('content-type')})`);
    }

    // 5. Test Master ZIP Generation
    console.log('\nSTEP 5: Simulating Admin Master ZIP Export assembly…');
    const zip = new JSZip();
    const studentsFolder = zip.folder('students');
    const folderName = `${fetched.reg_no}_${fetched.name.replace(/[^a-zA-Z0-9]/g, '')}`;
    const studentFolder = studentsFolder.folder(folderName);

    for (const pose of poses) {
      const res = await fetch(fetched.photo_urls[pose]);
      const arrayBuffer = await res.arrayBuffer();
      studentFolder.file(`${pose}.jpg`, arrayBuffer);
    }

    const metadata = {
      regNo: fetched.reg_no,
      name: fetched.name,
      dept: fetched.dept,
      section: fetched.section,
      email: fetched.email,
      capturedAt: fetched.created_at,
      images: { front: 'front.jpg', left: 'left.jpg', right: 'right.jpg', overall: 'overall.jpg' },
      qualityChecksPassed: true,
    };
    studentFolder.file('metadata.json', JSON.stringify(metadata, null, 2));

    zip.file('index.json', JSON.stringify([metadata], null, 2));
    zip.file('index.csv', `regNo,name,dept,section,email\n${fetched.reg_no},${fetched.name},${fetched.dept},${fetched.section},${fetched.email}`);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    console.log(`  ✓ Successfully built Master ZIP (${zipBuffer.length} bytes)`);

    // 6. Inspect ZIP contents
    const verifiedZip = await JSZip.loadAsync(zipBuffer);
    const filesInZip = Object.keys(verifiedZip.files);
    console.log('  ✓ Files inside Master ZIP:');
    filesInZip.forEach(f => console.log(`    - ${f}`));

    console.log('\n======================================================');
    console.log('✅ ALL BOUNDARIES VERIFIED & CONTRACTS PROVEN WORKING!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ AUDIT FAILED AT BOUNDARY:', err);
    process.exitCode = 1;
  } finally {
    // 7. Clean up test record
    console.log('CLEANUP: Removing test student record and files from cloud…');
    const filesToRemove = poses.map(p => `${testRegNo}/${p}.jpg`);
    await client.storage.from('student-faces').remove(filesToRemove);
    await client.from('students').delete().eq('reg_no', testRegNo);
    console.log('✓ Test records cleaned up cleanly.\n');
  }
}

runEndToEndVerification();
