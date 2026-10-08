const fs = require('fs');

console.log('=== DATA/JOBS.JSON ===');
if (fs.existsSync('data/jobs.json')) {
  const jobsData = JSON.parse(fs.readFileSync('data/jobs.json', 'utf8'));
  console.log('Jobs count:', Array.isArray(jobsData) ? jobsData.length : Object.keys(jobsData));
  console.log('Jobs sample:', JSON.stringify(jobsData, null, 2).slice(0, 500));
} else {
  console.log('data/jobs.json not found');
}

console.log('=== DATA/COURSES.JSON ===');
if (fs.existsSync('data/courses.json')) {
  const coursesData = JSON.parse(fs.readFileSync('data/courses.json', 'utf8'));
  console.log('Courses count:', Array.isArray(coursesData) ? coursesData.length : Object.keys(coursesData));
  console.log('Courses sample:', JSON.stringify(coursesData, null, 2).slice(0, 500));
} else {
  console.log('data/courses.json not found');
}

console.log('=== API/GET-JOBS.PHP ===');
if (fs.existsSync('api/get-jobs.php')) {
  console.log(fs.readFileSync('api/get-jobs.php', 'utf8').slice(0, 400));
}

console.log('=== API/GET-COURSES.PHP ===');
if (fs.existsSync('api/get-courses.php')) {
  console.log(fs.readFileSync('api/get-courses.php', 'utf8').slice(0, 400));
}
