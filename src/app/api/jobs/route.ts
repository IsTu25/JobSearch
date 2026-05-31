import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface SerperJob {
  title?: string;
  companyName?: string;
  location?: string;
  link?: string;
  via?: string;
  description?: string;
  extensions?: string[];
}

async function searchSerper(query: string, location: string): Promise<SerperJob[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch('https://google.serper.dev/jobs', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: `${query} ${location}`,
        num: 20,
      }),
    });
    const data = await res.json();
    return data.jobs || [];
  } catch {
    return [];
  }
}

interface AdzunaJob {
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  redirect_url?: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
  created?: string;
  category?: { tag?: string };
}

async function searchAdzuna(query: string, location: string): Promise<AdzunaJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  const country = location.toLowerCase().includes('bangladesh') ? 'bd' :
    location.toLowerCase().includes('uk') ? 'gb' :
    location.toLowerCase().includes('us') || location.toLowerCase().includes('united states') ? 'us' :
    location.toLowerCase().includes('canad') ? 'ca' :
    location.toLowerCase().includes('india') ? 'in' : 'us';

  try {
    const res = await fetch(
      `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=15&what=${encodeURIComponent(query)}&content-type=application/json`
    );
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

function computeFitScore(
  job: { title: string; description: string; requirements: string[]; jobLocation: string },
  cvText: string,
  targetRole: string,
  queryLocation: string
) {
  const cvLower = cvText.toLowerCase();
  const descLower = (job.description + ' ' + job.requirements.join(' ')).toLowerCase();
  const titleLower = job.title.toLowerCase();
  const roleLower = targetRole.toLowerCase();

  // Skill overlap
  const techSkills = ['python', 'javascript', 'typescript', 'react', 'node', 'java', 'c++', 'sql', 'mongodb',
    'aws', 'docker', 'kubernetes', 'git', 'linux', 'html', 'css', 'flask', 'django', 'express',
    'tensorflow', 'pytorch', 'machine learning', 'deep learning', 'data analysis', 'figma',
    'next.js', 'vue', 'angular', 'go', 'rust', 'swift', 'kotlin', 'flutter', 'dart',
    'postgresql', 'redis', 'graphql', 'rest api', 'ci/cd', 'agile', 'scrum'];

  const jobSkills = techSkills.filter(s => descLower.includes(s));
  const userSkills = techSkills.filter(s => cvLower.includes(s));
  const matched = jobSkills.filter(s => userSkills.includes(s));
  const skillScore = jobSkills.length > 0 ? (matched.length / jobSkills.length) * 100 : 50;

  // Experience relevance (keyword overlap)
  const roleWords = roleLower.split(/\s+/);
  const titleMatch = roleWords.filter(w => titleLower.includes(w)).length / Math.max(roleWords.length, 1);
  const expScore = Math.min(titleMatch * 100 + 20, 100);

  // Education (assume match if CV has degree keywords)
  const eduKeywords = ['bachelor', 'master', 'phd', 'bsc', 'msc', 'degree', 'university', 'b.sc', 'm.sc'];
  const hasEdu = eduKeywords.some(k => cvLower.includes(k));
  const eduScore = hasEdu ? 85 : 50;

  // Dynamic location scoring
  const jobLoc = job.jobLocation.toLowerCase();
  const qLoc = queryLocation.toLowerCase();
  const isRemote = jobLoc.includes('remote') || jobLoc.includes('anywhere') || jobLoc.includes('work from home');
  const locationKeywords = qLoc.split(/[\s,]+/).filter(w => w.length > 2);
  const locMatches = locationKeywords.filter(k => jobLoc.includes(k)).length;
  const locationScore = isRemote ? 95
    : locMatches > 0 ? 85
    : qLoc.includes('remote') && isRemote ? 95
    : qLoc.length === 0 ? 70
    : 40;

  const total = Math.round(skillScore * 0.45 + expScore * 0.30 + eduScore * 0.15 + locationScore * 0.10);

  return {
    total: Math.min(total, 99),
    skills: Math.round(skillScore),
    experience: Math.round(expScore),
    education: Math.round(eduScore),
    location: Math.round(locationScore),
    matchReasons: matched.map(s => `Your ${s} skill matches this requirement`).slice(0, 3),
    gaps: jobSkills.filter(s => !userSkills.includes(s)).map(s => `Missing: ${s}`).slice(0, 3),
  };
}

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
  publication_date?: string;
}

async function searchRemotive(query: string): Promise<RemotiveJob[]> {
  try {
    const res = await fetch(
      `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=15`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.jobs || [];
  } catch (err) {
    console.error('Remotive search failed:', err);
    return [];
  }
}

interface JobicyJob {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  jobCategory?: string[];
  jobGeo?: string;
  annualSalaryMin?: string | number;
  annualSalaryMax?: string | number;
  pubDate?: string;
  jobDescription?: string;
}

async function searchJobicy(query: string): Promise<JobicyJob[]> {
  try {
    const res = await fetch(
      `https://jobicy.com/api/v2/remote-jobs?count=15&tag=${encodeURIComponent(query)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.jobs || [];
  } catch (err) {
    console.error('Jobicy search failed:', err);
    return [];
  }
}

interface TheMuseJob {
  id: number;
  name: string;
  contents: string;
  locations?: { name: string }[];
  company?: { name: string };
  categories?: { name: string }[];
  publication_date?: string;
  refs?: { landing_page: string };
}

async function searchTheMuse(query: string, location: string): Promise<TheMuseJob[]> {
  try {
    const params = new URLSearchParams();
    if (location && location !== 'Remote') {
      params.append('location', location);
    }
    params.append('page', '1');
    
    const res = await fetch(`https://www.themuse.com/api/public/jobs?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    const results = data.results || [];
    
    const qLower = query.toLowerCase();
    return results.filter((job: TheMuseJob) => 
      job.name.toLowerCase().includes(qLower) || 
      (job.contents || '').toLowerCase().includes(qLower)
    );
  } catch (err) {
    console.error('The Muse search failed:', err);
    return [];
  }
}

interface ReedJob {
  jobId: number;
  jobTitle: string;
  employerName: string;
  locationName: string;
  minimumSalary?: number;
  maximumSalary?: number;
  expirationDate?: string;
  jobDescription?: string;
  jobUrl: string;
  date: string;
}

async function searchReed(query: string, location: string): Promise<ReedJob[]> {
  const apiKey = process.env.REED_API_KEY;
  if (!apiKey) return [];

  try {
    const authHeader = `Basic ${Buffer.from(apiKey + ':').toString('base64')}`;
    const url = `https://www.reed.co.uk/api/1.0/search?keywords=${encodeURIComponent(query)}&locationName=${encodeURIComponent(location)}&resultsToTake=10`;
    
    const res = await fetch(url, {
      headers: { Authorization: authHeader }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error('Reed search failed:', err);
    return [];
  }
}

interface UpworkJobItem {
  id: string;
  title: string;
  snippet: string;
  category2: string;
  subcategory2: string;
  client: { country: string };
  url: string;
  date_created: string;
}

async function searchUpwork(query: string): Promise<UpworkJobItem[]> {
  const token = process.env.UPWORK_ACCESS_TOKEN;
  if (!token) return [];

  try {
    const res = await fetch(
      `https://www.upwork.com/api/profiles/v2/search/jobs.json?q=${encodeURIComponent(query)}&paging=0;10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.jobs?.job || [];
  } catch (err) {
    console.error('Upwork search failed:', err);
    return [];
  }
}

interface JSearchJobItem {
  job_id: string;
  job_title: string;
  employer_name: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_publisher?: string;
  job_employment_type?: string;
  job_description?: string;
  job_apply_link?: string;
  job_posted_at_timestamp?: number;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
  job_salary_period?: string;
}

async function searchJSearch(query: string, location: string): Promise<JSearchJobItem[]> {
  const apiKey = process.env.RAPIDAPI_KEY || process.env.NEXT_PUBLIC_RAPIDAPI_KEY;
  if (!apiKey) return [];

  try {
    const searchQuery = `${query} in ${location}`;
    const res = await fetch(
      `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(searchQuery)}&page=1&num_pages=1`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error('JSearch search failed:', err);
    return [];
  }
}

interface RemoteOKJobItem {
  id: string;
  epoch: string;
  date: string;
  company: string;
  company_logo: string;
  position: string;
  tags: string[];
  description: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
  url: string;
  legal?: string;
}

async function searchRemoteOK(query: string): Promise<RemoteOKJobItem[]> {
  try {
    const res = await fetch(`https://remoteok.com/api?tags=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.filter(item => item && !item.legal);
  } catch (err) {
    console.error('RemoteOK search failed:', err);
    return [];
  }
}

interface ArbeitnowJobItem {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: string;
}

async function searchArbeitnow(query: string): Promise<ArbeitnowJobItem[]> {
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api');
    if (!res.ok) return [];
    const data = await res.json();
    const allJobs = (data.data || []) as ArbeitnowJobItem[];
    if (query) {
      const qLower = query.toLowerCase();
      return allJobs.filter(j => 
        (j.title || '').toLowerCase().includes(qLower) || 
        (j.description || '').toLowerCase().includes(qLower) ||
        (j.tags || []).some(t => t.toLowerCase().includes(qLower))
      );
    }
    return allJobs;
  } catch (err) {
    console.error('Arbeitnow search failed:', err);
    return [];
  }
}

interface CareerjetJobItem {
  url: string;
  title: string;
  locations: string;
  company: string;
  salary: string;
  date: string;
  description: string;
}

async function searchCareerjet(query: string, location: string): Promise<CareerjetJobItem[]> {
  const apiKey = process.env.CAREERJET_API_KEY;
  if (!apiKey) return [];

  try {
    const authHeader = `Basic ${Buffer.from(apiKey + ':').toString('base64')}`;
    const params = new URLSearchParams({
      keywords: query,
      location: location || '',
      user_ip: '127.0.0.1',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      url: 'http://localhost:3000',
      page_size: '15'
    });

    const res = await fetch(`https://search.api.careerjet.net/v4/query?${params.toString()}`, {
      headers: { Authorization: authHeader }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.jobs || [];
  } catch (err) {
    console.error('Careerjet search failed:', err);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { query, location, cvText, targetRole } = await req.json();

    let searchQuery = query || targetRole || '';
    let searchLocation = location || 'Remote';

    const apiKey = process.env.GEMINI_API_KEY;
    if (query && apiKey && (
      query.trim().split(/\s+/).length > 2 ||
      query.toLowerCase().includes('in ') ||
      query.toLowerCase().includes('near') ||
      query.toLowerCase().includes('open')
    )) {
      // Run the query parsing request with Gemini 2.5 Flash
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        const prompt = `Analyze this natural-language job search query and extract structured search parameters.
Query: "${query}"

Return response STRICTLY in this JSON format:
{
  "roleKeywords": "search query for role (e.g. 'ML Internship' or 'Frontend React Developer')",
  "location": "location (e.g. 'Dhaka' or 'Remote')",
  "timeFilter": "time restriction if any, or null"
}
Do not wrap in markdown blocks, only return raw JSON.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();
        const cleanedText = responseText.replace(/^```json/, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(cleanedText);
        
        if (parsed.roleKeywords) {
          searchQuery = parsed.roleKeywords;
        }
        if (parsed.location) {
          searchLocation = parsed.location;
        }
        console.log(`[Job Agent NLP] Parsed: "${query}" -> Role: "${searchQuery}", Location: "${searchLocation}"`);
      } catch (err) {
        console.error('[Job Agent NLP] Failed to parse query with Gemini, using fallback:', err);
      }
    }

    const [
      serperJobs, adzunaJobs, remotiveJobs, jobicyJobs, museJobs, reedJobs, upworkJobs, jsearchJobs,
      remoteokJobs, arbeitnowJobs, careerjetJobs
    ] = await Promise.all([
      searchSerper(searchQuery, searchLocation),
      searchAdzuna(searchQuery, searchLocation),
      searchRemotive(searchQuery),
      searchJobicy(searchQuery),
      searchTheMuse(searchQuery, searchLocation),
      searchReed(searchQuery, searchLocation),
      searchUpwork(searchQuery),
      searchJSearch(searchQuery, searchLocation),
      searchRemoteOK(searchQuery),
      searchArbeitnow(searchQuery),
      searchCareerjet(searchQuery, searchLocation),
    ]);

    const jobs: {
      id: string; title: string; company: string; location: string;
      salary: string; deadline: string; source: string; url: string;
      description: string; requirements: string[]; fitScore: number;
      fitBreakdown: { skills: number; experience: number; education: number; location: number };
      matchReasons: string[]; gaps: string[]; tags: string[]; postedDate: string;
    }[] = [];

    // Process Serper results
    serperJobs.forEach((j: SerperJob, i: number) => {
      const title = j.title || 'Untitled';
      const desc = j.description || '';
      const requirements = desc.split(/[.;,]/).filter(s => s.trim().length > 10).slice(0, 5);
      const jobLocation = j.location || searchLocation || 'Not specified';
      const fit = computeFitScore({ title, description: desc, requirements, jobLocation }, cvText || '', targetRole || searchQuery, searchLocation);

      jobs.push({
        id: `serper-${i}`,
        title,
        company: j.companyName || 'Company not listed',
        location: j.location || searchLocation || 'Not specified',
        salary: (j.extensions || []).find(e => e.includes('$') || e.includes('k') || e.includes('salary')) || 'Not listed',
        deadline: 'Open',
        source: j.via?.replace('via ', '') || 'Google Jobs',
        url: j.link || '#',
        description: desc,
        requirements,
        fitScore: fit.total,
        fitBreakdown: { skills: fit.skills, experience: fit.experience, education: fit.education, location: fit.location },
        matchReasons: fit.matchReasons,
        gaps: fit.gaps,
        tags: (j.extensions || []).slice(0, 3),
        postedDate: (j.extensions || []).find(e => e.includes('ago') || e.includes('day')) || 'Recently',
      });
    });

    // Process Adzuna results
    adzunaJobs.forEach((j: AdzunaJob, i: number) => {
      const title = j.title || 'Untitled';
      const desc = j.description || '';
      const requirements = desc.split(/[.;,]/).filter(s => s.trim().length > 10).slice(0, 5);
      const jobLocation = j.location?.display_name || searchLocation || 'Not specified';
      const fit = computeFitScore({ title, description: desc, requirements, jobLocation }, cvText || '', targetRole || searchQuery, searchLocation);
      const salary = j.salary_min && j.salary_max
        ? `$${Math.round(j.salary_min / 1000)}k - $${Math.round(j.salary_max / 1000)}k`
        : 'Not listed';

      jobs.push({
        id: `adzuna-${i}`,
        title,
        company: j.company?.display_name || 'Company not listed',
        location: j.location?.display_name || searchLocation || 'Not specified',
        salary,
        deadline: 'Open',
        source: 'Adzuna',
        url: j.redirect_url || '#',
        description: desc,
        requirements,
        fitScore: fit.total,
        fitBreakdown: { skills: fit.skills, experience: fit.experience, education: fit.education, location: fit.location },
        matchReasons: fit.matchReasons,
        gaps: fit.gaps,
        tags: j.category?.tag ? [j.category.tag] : [],
        postedDate: j.created ? new Date(j.created).toLocaleDateString() : 'Recently',
      });
    });

    // Process Remotive results
    remotiveJobs.forEach((j: RemotiveJob) => {
      const title = j.title || 'Untitled';
      const desc = j.description || '';
      const requirements = desc.split(/[.;,]/).filter(s => s.trim().length > 10).slice(0, 5);
      const jobLocation = j.candidate_required_location || 'Remote';
      const fit = computeFitScore({ title, description: desc, requirements, jobLocation }, cvText || '', targetRole || searchQuery, searchLocation);

      jobs.push({
        id: `remotive-${j.id}`,
        title,
        company: j.company_name || 'Company not listed',
        location: jobLocation,
        salary: j.salary || 'Not listed',
        deadline: 'Open',
        source: 'Remotive',
        url: j.url || '#',
        description: desc,
        requirements,
        fitScore: fit.total,
        fitBreakdown: { skills: fit.skills, experience: fit.experience, education: fit.education, location: fit.location },
        matchReasons: fit.matchReasons,
        gaps: fit.gaps,
        tags: j.category ? [j.category] : ['Remote'],
        postedDate: j.publication_date ? new Date(j.publication_date).toLocaleDateString() : 'Recently',
      });
    });

    // Process Jobicy results
    jobicyJobs.forEach((j: JobicyJob) => {
      const title = j.jobTitle || 'Untitled';
      const desc = j.jobDescription || '';
      const requirements = desc.split(/[.;,]/).filter(s => s.trim().length > 10).slice(0, 5);
      const jobLocation = j.jobGeo || 'Remote';
      const fit = computeFitScore({ title, description: desc, requirements, jobLocation }, cvText || '', targetRole || searchQuery, searchLocation);
      
      const salary = j.annualSalaryMin && j.annualSalaryMax
        ? `$${Math.round(Number(j.annualSalaryMin) / 1000)}k - $${Math.round(Number(j.annualSalaryMax) / 1000)}k`
        : 'Not listed';

      jobs.push({
        id: `jobicy-${j.id}`,
        title,
        company: j.companyName || 'Company not listed',
        location: jobLocation,
        salary,
        deadline: 'Open',
        source: 'Jobicy',
        url: j.url || '#',
        description: desc,
        requirements,
        fitScore: fit.total,
        fitBreakdown: { skills: fit.skills, experience: fit.experience, education: fit.education, location: fit.location },
        matchReasons: fit.matchReasons,
        gaps: fit.gaps,
        tags: j.jobCategory || ['Remote'],
        postedDate: j.pubDate ? new Date(j.pubDate).toLocaleDateString() : 'Recently',
      });
    });

    // Process The Muse results
    museJobs.forEach((j: TheMuseJob) => {
      const title = j.name || 'Untitled';
      const desc = j.contents || '';
      const requirements = desc.split(/[.;,]/).filter(s => s.trim().length > 10).slice(0, 5);
      const jobLocation = (j.locations || []).map(l => l.name).join(', ') || searchLocation || 'Not specified';
      const fit = computeFitScore({ title, description: desc, requirements, jobLocation }, cvText || '', targetRole || searchQuery, searchLocation);

      jobs.push({
        id: `themuse-${j.id}`,
        title,
        company: j.company?.name || 'Company not listed',
        location: jobLocation,
        salary: 'Not listed',
        deadline: 'Open',
        source: 'The Muse',
        url: j.refs?.landing_page || '#',
        description: desc.replace(/<[^>]*>/g, ''), // Clean HTML tags
        requirements,
        fitScore: fit.total,
        fitBreakdown: { skills: fit.skills, experience: fit.experience, education: fit.education, location: fit.location },
        matchReasons: fit.matchReasons,
        gaps: fit.gaps,
        tags: (j.categories || []).map(c => c.name),
        postedDate: j.publication_date ? new Date(j.publication_date).toLocaleDateString() : 'Recently',
      });
    });

    // Process Reed results
    reedJobs.forEach((j: ReedJob) => {
      const title = j.jobTitle || 'Untitled';
      const desc = j.jobDescription || '';
      const requirements = desc.split(/[.;,]/).filter(s => s.trim().length > 10).slice(0, 5);
      const jobLocation = j.locationName || searchLocation || 'UK';
      const fit = computeFitScore({ title, description: desc, requirements, jobLocation }, cvText || '', targetRole || searchQuery, searchLocation);
      const salary = j.minimumSalary && j.maximumSalary
        ? `£${Math.round(j.minimumSalary / 1000)}k - £${Math.round(j.maximumSalary / 1000)}k`
        : 'Not listed';

      jobs.push({
        id: `reed-${j.jobId}`,
        title,
        company: j.employerName || 'Company not listed',
        location: jobLocation,
        salary,
        deadline: j.expirationDate || 'Open',
        source: 'Reed.co.uk',
        url: j.jobUrl || '#',
        description: desc,
        requirements,
        fitScore: fit.total,
        fitBreakdown: { skills: fit.skills, experience: fit.experience, education: fit.education, location: fit.location },
        matchReasons: fit.matchReasons,
        gaps: fit.gaps,
        tags: ['UK'],
        postedDate: j.date ? new Date(j.date).toLocaleDateString() : 'Recently',
      });
    });

    // Process Upwork results
    upworkJobs.forEach((j: UpworkJobItem) => {
      const title = j.title || 'Untitled';
      const desc = j.snippet || '';
      const requirements = desc.split(/[.;,]/).filter(s => s.trim().length > 10).slice(0, 5);
      const jobLocation = j.client?.country || 'Remote';
      const fit = computeFitScore({ title, description: desc, requirements, jobLocation }, cvText || '', targetRole || searchQuery, searchLocation);

      jobs.push({
        id: `upwork-${j.id}`,
        title,
        company: 'Freelance (Upwork)',
        location: jobLocation,
        salary: 'Contract rates',
        deadline: 'Open',
        source: 'Upwork',
        url: j.url || '#',
        description: desc,
        requirements,
        fitScore: fit.total,
        fitBreakdown: { skills: fit.skills, experience: fit.experience, education: fit.education, location: fit.location },
        matchReasons: fit.matchReasons,
        gaps: fit.gaps,
        tags: [j.category2, j.subcategory2].filter(Boolean),
        postedDate: j.date_created ? new Date(j.date_created).toLocaleDateString() : 'Recently',
      });
    });

    // Process JSearch results
    (jsearchJobs || []).forEach((j: JSearchJobItem) => {
      const title = j.job_title || 'Untitled';
      const desc = j.job_description || '';
      const requirements = desc.split(/[.;,]/).filter(s => s.trim().length > 10).slice(0, 5);
      
      const parts = [j.job_city, j.job_state, j.job_country].filter(Boolean);
      const jobLocation = parts.length > 0 ? parts.join(', ') : 'Remote';
      
      const fit = computeFitScore({ title, description: desc, requirements, jobLocation }, cvText || '', targetRole || searchQuery, searchLocation);
      
      const salary = j.job_min_salary && j.job_max_salary
        ? `${j.job_salary_currency || '$'}${Math.round(j.job_min_salary / 1000)}k - ${Math.round(j.job_max_salary / 1000)}k`
        : 'Not listed';

      jobs.push({
        id: `jsearch-${j.job_id}`,
        title,
        company: j.employer_name || 'Company not listed',
        location: jobLocation,
        salary,
        deadline: 'Open',
        source: j.job_publisher || 'JSearch',
        url: j.job_apply_link || '#',
        description: desc,
        requirements,
        fitScore: fit.total,
        fitBreakdown: { skills: fit.skills, experience: fit.experience, education: fit.education, location: fit.location },
        matchReasons: fit.matchReasons,
        gaps: fit.gaps,
        tags: [j.job_employment_type].filter(Boolean) as string[],
        postedDate: j.job_posted_at_timestamp ? new Date(j.job_posted_at_timestamp * 1000).toLocaleDateString() : 'Recently',
      });
    });

    // Process RemoteOK results
    (remoteokJobs || []).forEach((j: RemoteOKJobItem, idx: number) => {
      const title = j.position || 'Untitled';
      const desc = j.description || '';
      const requirements = desc.split(/[.;,]/).filter(s => s.trim().length > 10).slice(0, 5);
      const jobLocation = j.location || 'Remote';
      const fit = computeFitScore({ title, description: desc, requirements, jobLocation }, cvText || '', targetRole || searchQuery, searchLocation);
      
      const salary = j.salary_min && j.salary_max
        ? `$${Math.round(j.salary_min / 1000)}k - $${Math.round(j.salary_max / 1000)}k`
        : 'Not listed';

      jobs.push({
        id: `remoteok-${j.id || idx}`,
        title,
        company: j.company || 'Company not listed',
        location: jobLocation,
        salary,
        deadline: 'Open',
        source: 'RemoteOK',
        url: j.url || '#',
        description: desc.replace(/<[^>]*>/g, ''),
        requirements,
        fitScore: fit.total,
        fitBreakdown: { skills: fit.skills, experience: fit.experience, education: fit.education, location: fit.location },
        matchReasons: fit.matchReasons,
        gaps: fit.gaps,
        tags: j.tags || ['Remote'],
        postedDate: j.date ? new Date(j.date).toLocaleDateString() : 'Recently',
      });
    });

    // Process Arbeitnow results
    (arbeitnowJobs || []).forEach((j: ArbeitnowJobItem, idx: number) => {
      const title = j.title || 'Untitled';
      const desc = j.description || '';
      const requirements = desc.split(/[.;,]/).filter(s => s.trim().length > 10).slice(0, 5);
      const jobLocation = j.location || 'Remote';
      const fit = computeFitScore({ title, description: desc, requirements, jobLocation }, cvText || '', targetRole || searchQuery, searchLocation);

      jobs.push({
        id: `arbeitnow-${j.slug || idx}`,
        title,
        company: j.company_name || 'Company not listed',
        location: jobLocation,
        salary: 'Not listed',
        deadline: 'Open',
        source: 'Arbeitnow',
        url: j.url || '#',
        description: desc.replace(/<[^>]*>/g, ''),
        requirements,
        fitScore: fit.total,
        fitBreakdown: { skills: fit.skills, experience: fit.experience, education: fit.education, location: fit.location },
        matchReasons: fit.matchReasons,
        gaps: fit.gaps,
        tags: j.tags || [],
        postedDate: j.created_at ? new Date(j.created_at).toLocaleDateString() : 'Recently',
      });
    });

    // Process Careerjet results
    (careerjetJobs || []).forEach((j: CareerjetJobItem, idx: number) => {
      const title = j.title || 'Untitled';
      const desc = j.description || '';
      const requirements = desc.split(/[.;,]/).filter(s => s.trim().length > 10).slice(0, 5);
      const jobLocation = j.locations || 'Remote';
      const fit = computeFitScore({ title, description: desc, requirements, jobLocation }, cvText || '', targetRole || searchQuery, searchLocation);

      jobs.push({
        id: `careerjet-${idx}`,
        title,
        company: j.company || 'Company not listed',
        location: jobLocation,
        salary: j.salary || 'Not listed',
        deadline: 'Open',
        source: 'Careerjet',
        url: j.url || '#',
        description: desc.replace(/<[^>]*>/g, ''),
        requirements,
        fitScore: fit.total,
        fitBreakdown: { skills: fit.skills, experience: fit.experience, education: fit.education, location: fit.location },
        matchReasons: fit.matchReasons,
        gaps: fit.gaps,
        tags: ['Careerjet'],
        postedDate: j.date ? new Date(j.date).toLocaleDateString() : 'Recently',
      });
    });

    // Deduplication by title+company hash
    const seen = new Set<string>();
    const dedupedJobs = jobs.filter(job => {
      const key = `${job.title.toLowerCase().trim()}|${job.company.toLowerCase().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by fit score
    dedupedJobs.sort((a, b) => b.fitScore - a.fitScore);

    return NextResponse.json({ jobs: dedupedJobs, totalFound: dedupedJobs.length });
  } catch (error: unknown) {
    console.error('Job search error:', error);
    return NextResponse.json({ error: 'Job search failed' }, { status: 500 });
  }
}
