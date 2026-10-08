const fs = require('fs');

function cleanRead(filePath) {
  if (!fs.existsSync(filePath)) return null;
  let str = fs.readFileSync(filePath, 'utf8');
  if (str.charCodeAt(0) === 0xFEFF) {
    str = str.slice(1);
  }
  return str;
}

const jobsRaw = cleanRead('data/jobs.json');
console.log('jobsRaw length:', jobsRaw.length);
try {
  const jobs = JSON.parse(jobsRaw);
  console.log('jobs parsed:', jobs);
} catch(e) {
  console.log('jobs parse error:', e.message);
}

const coursesRaw = cleanRead('data/courses.json');
console.log('coursesRaw length:', coursesRaw ? coursesRaw.length : 'none');
try {
  const courses = JSON.parse(coursesRaw);
  console.log('courses count:', courses.length);
  console.log('courses sample:', JSON.stringify(courses.slice(0, 2), null, 2));
} catch(e) {
  console.log('courses parse error:', e.message);
}
