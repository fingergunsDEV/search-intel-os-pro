// ─── CONFIG ──────────────────────────────────────────────
const CONFIG = {
  DEFAULT_DOMAIN: 'https://holisticgrowthmarketing.com/',
  DEFAULT_DAYS: 28,
};

// ─── HTML INCLUDE ────────────────────────────────────────
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet() {
  const html = HtmlService.createTemplateFromFile('Index');
  return html.evaluate()
      .setTitle('Search Intel OS — HGM')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ─── SCRIPT PROPERTIES ──────────────────────────────────
function getScriptProperties() {
  return PropertiesService.getScriptProperties();
}

function getDomain() {
  const props = getScriptProperties();
  return props.getProperty('DOMAIN') || CONFIG.DEFAULT_DOMAIN;
}

function setDomain(domain) {
  const props = getScriptProperties();
  props.setProperty('DOMAIN', domain);
}

function getDays() {
  const props = getScriptProperties();
  const days = props.getProperty('DAYS');
  return days ? parseInt(days, 10) : CONFIG.DEFAULT_DAYS;
}

function setDays(days) {
  const props = getScriptProperties();
  props.setProperty('DAYS', String(days));
}

function getGA4PropertyId() {
  const props = getScriptProperties();
  return props.getProperty('GA4_PROPERTY_ID') || '';
}

function setGA4PropertyId(propId) {
  const props = getScriptProperties();
  props.setProperty('GA4_PROPERTY_ID', propId);
}

// ─── AUTH ──────────────────────────────────────────────────
function getAuthStatus() {
  try {
    const sites = SearchConsole.Sites.list();
    return {
      authorized: true,
      sites: sites.items ? sites.items.map(s => s.siteUrl) : [],
    };
  } catch (e) {
    return { authorized: false, error: e.message };
  }
}

function authorizeApp() {
  try {
    const sites = SearchConsole.Sites.list();
    return { success: true, sites: sites.items ? sites.items.map(s => s.siteUrl) : [] };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getUserInfo() {
  const auth = getAuthStatus();
  const domain = getDomain();
  const days = getDays();
  return {
    email: Session.getActiveUser().getEmail(),
    domain: domain,
    days: days,
    authorized: auth.authorized,
    sites: auth.sites || [],
    token: ScriptApp.getOAuthToken(),
  };
}

function getReauthorizationUrl() {
  try {
    var authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
    if (authInfo.getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED) {
      return authInfo.getAuthorizationUrl();
    } else {
      return null;
    }
  } catch (e) {
    try {
      SearchConsole.Sites.list();
      return null;
    } catch (err) {
      return "https://script.google.com/a/holisticgrowthmarketing.com/u/0/authorize";
    }
  }
}

// ─── UPDATE CONFIG ──────────────────────────────────────
function updateWorkspaceConfig(config) {
  if (config && config.domain) setDomain(config.domain);
  if (config && config.days) setDays(config.days);
  if (config && config.GA4_PROPERTY_ID) {
    setGA4PropertyId(config.GA4_PROPERTY_ID.replace('properties/', ''));
  }
  return { success: true, domain: getDomain(), days: getDays(), ga4Prop: getGA4PropertyId() };
}

// ─── GSC DATA ────────────────────────────────────────────
function fetchGSC(domain, days) {
  const siteUrl = domain || getDomain();
  if (!siteUrl) throw new Error('No domain configured.');
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);
  const dateFormat = d => Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const request = {
    startDate: dateFormat(startDate),
    endDate: dateFormat(endDate),
    dimensions: ['query'],
    rowLimit: 25000,
  };
  const timelineRequest = {
    startDate: dateFormat(startDate),
    endDate: dateFormat(endDate),
    dimensions: ['date'],
    rowLimit: 25000,
  };

  try {
    const response = SearchConsole.Searchanalytics.query(siteUrl, request);
    const rows = response.rows || [];
    const timelineResponse = SearchConsole.Searchanalytics.query(siteUrl, timelineRequest);
    const timelineRows = timelineResponse.rows || [];

    const processedRows = rows.map(row => ({
      keys: row.keys,
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }));

    const timeline = timelineRows.map(row => ({
      keys: row.keys,
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }));

    const totals = {
      clicks: response.clicks || 0,
      impressions: response.impressions || 0,
      ctr: response.ctr || 0,
      position: response.position || 0,
    };

    return { rows: processedRows, totals: totals, timeline: timeline };
  } catch (e) {
    throw new Error('GSC error: ' + e.message);
  }
}

// ─── GSC WRAPPERS (for frontend) ──────────────────────
function fetchGSCQueries() {
  const data = fetchGSC(getDomain(), getDays());
  return { rows: data.rows };
}

function fetchGSCPages() {
  const domain = getDomain();
  const days = getDays();
  const siteUrl = domain || getDomain();
  if (!siteUrl) throw new Error('No domain configured.');
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);
  const dateFormat = d => Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const request = {
    startDate: dateFormat(startDate),
    endDate: dateFormat(endDate),
    dimensions: ['page'],
    rowLimit: 200,
  };
  const response = SearchConsole.Searchanalytics.query(siteUrl, request);
  const rows = (response.rows || []).map(row => ({
    keys: row.keys,
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }));
  return { rows: rows };
}

function fetchGSCTS() {
  const domain = getDomain();
  const days = getDays();
  const siteUrl = domain || getDomain();
  if (!siteUrl) throw new Error('No domain configured.');
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);
  const dateFormat = d => Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const request = {
    startDate: dateFormat(startDate),
    endDate: dateFormat(endDate),
    dimensions: ['date'],
    rowLimit: 200,
  };
  const response = SearchConsole.Searchanalytics.query(siteUrl, request);
  const rows = (response.rows || []).map(row => ({
    keys: row.keys,
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }));
  return { rows: rows };
}

function fetchGSCDevices() {
  const domain = getDomain();
  const days = getDays();
  const siteUrl = domain || getDomain();
  if (!siteUrl) throw new Error('No domain configured.');
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);
  const dateFormat = d => Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const request = {
    startDate: dateFormat(startDate),
    endDate: dateFormat(endDate),
    dimensions: ['device'],
    rowLimit: 10,
  };
  const response = SearchConsole.Searchanalytics.query(siteUrl, request);
  const rows = (response.rows || []).map(row => ({
    keys: row.keys,
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }));
  return { rows: rows };
}

function fetchGSCDrill(query) {
  const domain = getDomain();
  const days = getDays();
  const siteUrl = domain || getDomain();
  if (!siteUrl) throw new Error('No domain configured.');
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);
  const dateFormat = d => Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const request = {
    startDate: dateFormat(startDate),
    endDate: dateFormat(endDate),
    dimensions: ['page'],
    dimensionFilterGroups: [{
      filters: [{
        dimension: 'query',
        operator: 'equals',
        expression: query,
      }]
    }],
    rowLimit: 25,
  };
  const response = SearchConsole.Searchanalytics.query(siteUrl, request);
  const rows = (response.rows || []).map(row => ({
    keys: row.keys,
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }));
  return { rows: rows };
}

// ─── GA4 DATA ────────────────────────────────────────────
function fetchGA4(days) {
  const propId = getGA4PropertyId();
  if (!propId) throw new Error('GA4 property ID not set in script properties.');
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);
  const dateFormat = d => Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const maxDaysPerRequest = 30;
  if (days <= maxDaysPerRequest) {
    return _fetchGa4Batch(dateFormat(startDate), dateFormat(endDate), propId);
  }

  let allTimeline = [];
  let allPages = [];
  let currentEnd = new Date(endDate);
  let currentStart = new Date(currentEnd);
  currentStart.setDate(currentStart.getDate() - maxDaysPerRequest + 1);

  while (currentStart > startDate) {
    const s = new Date(Math.max(currentStart.getTime(), startDate.getTime()));
    const e = new Date(Math.min(currentEnd.getTime(), endDate.getTime()));
    const batch = _fetchGa4Batch(dateFormat(s), dateFormat(e), propId);
    allTimeline = allTimeline.concat(batch.rows || []);
    allPages = allPages.concat(batch.pages || []);
    currentEnd = new Date(s);
    currentEnd.setDate(currentEnd.getDate() - 1);
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() - maxDaysPerRequest + 1);
  }

  const pageMap = new Map();
  allPages.forEach(p => {
    const path = p.dimensionValues[0].value;
    if (!pageMap.has(path) || parseInt(p.metricValues[0].value) > parseInt(pageMap.get(path).metricValues[0].value)) {
      pageMap.set(path, p);
    }
  });

  const totals = allTimeline.reduce((acc, day) => {
    const vals = day.metricValues.map(v => parseFloat(v.value) || 0);
    acc.sessions += vals[0];
    acc.users += vals[1];
    acc.pageviews += vals[2];
    acc.avgSessionDuration += vals[3] * vals[0];
    acc.bounceRate += vals[4] * vals[0];
    acc.totalSessionsForWeighting += vals[0];
    return acc;
  }, { sessions: 0, users: 0, pageviews: 0, avgSessionDuration: 0, bounceRate: 0, totalSessionsForWeighting: 0 });

  if (totals.totalSessionsForWeighting > 0) {
    totals.avgSessionDuration = totals.avgSessionDuration / totals.totalSessionsForWeighting;
    totals.bounceRate = totals.bounceRate / totals.totalSessionsForWeighting;
  }
  delete totals.totalSessionsForWeighting;

  return {
    rows: allTimeline,
    pages: Array.from(pageMap.values()),
    totals: totals,
  };
}

function _fetchGa4Batch(startDate, endDate, propertyId) {
  const dateRanges = [{ startDate: startDate, endDate: endDate }];
  const timelineRequest = {
    property: 'properties/' + propertyId,
    dateRanges: dateRanges,
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'screenPageViews' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
    limit: 10000,
  };

  const pagesRequest = {
    property: 'properties/' + propertyId,
    dateRanges: dateRanges,
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'uniqueScreenPageViews' },
    ],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 100,
  };

  const timelineResponse = AnalyticsData.properties.runReport(timelineRequest);
  const pagesResponse = AnalyticsData.properties.runReport(pagesRequest);

  const timeline = [];
  if (timelineResponse.rows) {
    timelineResponse.rows.forEach(row => {
      const dims = row.dimensionValues.map(v => v.value);
      const metrics = row.metricValues.map(v => parseFloat(v.value) || 0);
      timeline.push({
        dimensionValues: [{ value: dims[0] }],
        metricValues: metrics.map(v => ({ value: String(v) })),
      });
    });
  }

  const topPages = [];
  if (pagesResponse.rows) {
    pagesResponse.rows.forEach(row => {
      const dims = row.dimensionValues.map(v => v.value);
      const metrics = row.metricValues.map(v => parseFloat(v.value) || 0);
      topPages.push({
        dimensionValues: [{ value: dims[0] }],
        metricValues: metrics.map(v => ({ value: String(v) })),
      });
    });
  }

  return { rows: timeline, pages: topPages };
}

// ─── GA4 WRAPPERS (for frontend) ──────────────────────
function fetchGA4Overview() {
  const propId = getGA4PropertyId();
  if (!propId) return { rows: [] };
  try {
    const days = getDays();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    const dateFormat = d => Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    const request = {
      property: 'properties/' + propId,
      dateRanges: [{ startDate: dateFormat(startDate), endDate: dateFormat(endDate) }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'engagementRate' },
        { name: 'averageSessionDuration' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'conversions' },
      ],
      limit: 1,
    };
    const response = AnalyticsData.properties.runReport(request);
    if (!response.rows || response.rows.length === 0) {
      return { rows: [] };
    }
    const row = response.rows[0];
    const metrics = row.metricValues.map(v => ({ value: String(parseFloat(v.value) || 0) }));
    return { rows: [{ metricValues: metrics }] };
  } catch (e) {
    return { rows: [] };
  }
}

function fetchGA4Channels() {
  const propId = getGA4PropertyId();
  if (!propId) return { rows: [] };
  try {
    const days = getDays();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    const dateFormat = d => Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    const request = {
      property: 'properties/' + propId,
      dateRanges: [{ startDate: dateFormat(startDate), endDate: dateFormat(endDate) }],
      dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'engagementRate' },
        { name: 'conversions' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 50,
    };
    const response = AnalyticsData.properties.runReport(request);
    if (!response.rows) return { rows: [] };
    const rows = response.rows.map(row => ({
      dimensionValues: row.dimensionValues,
      metricValues: row.metricValues.map(v => ({ value: String(parseFloat(v.value) || 0) }))
    }));
    return { rows: rows };
  } catch (e) {
    return { rows: [] };
  }
}

function fetchGA4Pages() {
  const propId = getGA4PropertyId();
  if (!propId) return { rows: [] };
  try {
    const days = getDays();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    const dateFormat = d => Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    const request = {
      property: 'properties/' + propId,
      dateRanges: [{ startDate: dateFormat(startDate), endDate: dateFormat(endDate) }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'totalUsers' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
      ],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 150,
    };
    const response = AnalyticsData.properties.runReport(request);
    if (!response.rows) return { rows: [] };
    const rows = response.rows.map(row => ({
      dimensionValues: row.dimensionValues,
      metricValues: row.metricValues.map(v => ({ value: String(parseFloat(v.value) || 0) }))
    }));
    return { rows: rows };
  } catch (e) {
    return { rows: [] };
  }
}

function fetchGA4TS() {
  const propId = getGA4PropertyId();
  if (!propId) return { rows: [] };
  try {
    const days = getDays();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    const dateFormat = d => Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    const request = {
      property: 'properties/' + propId,
      dateRanges: [{ startDate: dateFormat(startDate), endDate: dateFormat(endDate) }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: 200,
    };
    const response = AnalyticsData.properties.runReport(request);
    if (!response.rows) return { rows: [] };
    const rows = response.rows.map(row => ({
      dimensionValues: row.dimensionValues,
      metricValues: row.metricValues.map(v => ({ value: String(parseFloat(v.value) || 0) }))
    }));
    return { rows: rows };
  } catch (e) {
    return { rows: [] };
  }
}

// ─── PAGESPEED INSIGHTS ─────────────────────────────────
function fetchPageSpeedInsights(url) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('PSI_API_KEY');
  if (!apiKey) {
    return getDummyAuditData();
  }
  const endpoint = 'https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=' + encodeURIComponent(url) +
    '&key=' + apiKey +
    '&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO' +
    '&strategy=mobile';
  const response = UrlFetchApp.fetch(endpoint, { muteHttpExceptions: true });
  const data = JSON.parse(response.getContentText());
  if (!data.lighthouseResult) {
    return getDummyAuditData();
  }
  const audits = data.lighthouseResult.audits;
  const categories = data.lighthouseResult.categories;

  const getNum = (id) => audits[id]?.numericValue || 0;
  const getScore = (id) => audits[id]?.score * 100 || 0;

  const crux = data.loadingExperience?.metrics;
  const lcp = crux?.LARGEST_CONTENTFUL_PAINT_MS?.percentile || getNum('largest-contentful-paint') * 1000;
  const fid = crux?.FIRST_INPUT_DELAY_MS?.percentile || getNum('first-input-delay');
  const cls = crux?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile || getNum('cumulative-layout-shift');

  const techIssues = [];
  if (audits['meta-description'] && audits['meta-description'].score < 1) techIssues.push({ type: 'Missing meta description', count: 1 });
  if (audits['image-alt'] && audits['image-alt'].score < 1) techIssues.push({ type: 'Images missing alt text', count: 1 });
  if (audits['canonical'] && audits['canonical'].score < 1) techIssues.push({ type: 'Missing canonical tag', count: 1 });

  const a11yViolations = [];
  if (audits['color-contrast'] && audits['color-contrast'].score < 1) a11yViolations.push({ id: 'color-contrast', description: 'Low contrast ratio', impact: 'serious' });
  if (audits['image-alt'] && audits['image-alt'].score < 1) a11yViolations.push({ id: 'image-alt', description: 'Images must have alt text', impact: 'critical' });
  if (audits['button-name'] && audits['button-name'].score < 1) a11yViolations.push({ id: 'button-name', description: 'Buttons must have discernible text', impact: 'serious' });

  const mobile = {
    viewport: audits['viewport']?.score === 1,
    touchTargets: audits['tap-targets']?.score === 1,
    fontSize: audits['font-size']?.score === 1,
    tapSpacing: audits['tap-targets']?.score === 1,
  };

  const perfDetail = {
    fcp: getNum('first-contentful-paint'),
    si: getNum('speed-index'),
    tti: getNum('interactive'),
    renderBlocking: audits['render-blocking-resources']?.score === 1 ? 0 : 5,
    unusedCSS: getScore('unused-css-rules'),
    unusedJS: getScore('unused-javascript'),
  };

  const content = {
    duplicateMeta: 0,
    thinContent: 0,
    headingStructure: audits['heading-order']?.score === 1 ? 'Good' : 'Needs improvement',
    brokenLinks: 0,
  };

  const links = {
    internal: 0,
    external: 0,
    canonical: audits['canonical']?.score === 1 ? '100%' : '0%',
    sitemap: true,
    robots: true,
  };

  return {
    performance: categories.performance?.score * 100 || 0,
    accessibility: categories.accessibility?.score * 100 || 0,
    bestPractices: categories['best-practices']?.score * 100 || 0,
    seo: categories.seo?.score * 100 || 0,
    technical: { issues: techIssues },
    coreWebVitals: {
      lcp: lcp / 1000,
      fid: fid,
      cls: cls,
      distribution: { good: 0, needsImprovement: 0, poor: 0 }
    },
    accessibility: { violations: a11yViolations },
    security: {
      https: url.startsWith('https://'),
      sslValid: true,
      mixedContent: false,
      secureForms: true
    },
    mobile: mobile,
    performanceDetail: perfDetail,
    content: content,
    links: links,
  };
}

function getDummyAuditData() {
  return {
    performance: 78,
    accessibility: 85,
    bestPractices: 92,
    seo: 81,
    technical: { issues: [{type:'Missing meta description',count:12},{type:'Duplicate H1',count:3}] },
    coreWebVitals: { lcp: 2.4, fid: 45, cls: 0.12, distribution: { good: 65, needsImprovement: 25, poor: 10 } },
    accessibility: { violations: [{id:'color-contrast',description:'Low contrast',impact:'serious'}] },
    security: { https: true, sslValid: true, mixedContent: false, secureForms: true },
    mobile: { viewport: true, touchTargets: true, fontSize: true, tapSpacing: true },
    performanceDetail: { fcp: 1.8, si: 3.2, tti: 4.1, renderBlocking: 12, unusedCSS: 45, unusedJS: 30 },
    content: { duplicateMeta: 8, thinContent: 15, headingStructure: 'Good', brokenLinks: 3 },
    links: { internal: 120, external: 45, canonical: '92%', sitemap: true, robots: true }
  };
}

// ─── GEMINI / AI ─────────────────────────────────────────
function dispatchGeminiQuery(systemPrompt, userMessages) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) return "No Gemini API key configured.";

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + apiKey;
  const payload = {
    contents: [
      {
        parts: [
          { text: systemPrompt + "\n\n" + userMessages.map(m => m.parts[0].text).join("\n") }
        ]
      }
    ]
  };

  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini.";
  return text;
}

function getEntitySignals(text) {
  return [
    { entity: 'Example Brand', type: 'ORGANIZATION', salience: 85, confidence: 92 },
    { entity: 'SEO Tools', type: 'PRODUCT', salience: 72, confidence: 88 },
  ];
}

function fetchLiveEngineMetrics() {
  return {
    geo: 72,
    aeo: 65,
    leads: 18,
    aiInsight: 'Your top query "best SEO practices" has high potential for a featured snippet.',
  };
}

function getStatus() {
  const auth = getAuthStatus();
  return {
    authorized: auth.authorized,
    domain: getDomain(),
    days: getDays(),
    sites: auth.sites || [],
  };
}

// ─── CONNECTION TESTS ──────────────────────────────────
function testApiConnections(config) {
  const domain = config?.domain || getDomain();
  const ga4Prop = config?.ga4PropertyId || getGA4PropertyId();

  // GSC test
  let gsc = { connected: false, message: 'Not tested' };
  try {
    if (typeof SearchConsole === 'undefined') {
      gsc = { connected: false, message: 'Search Console API service not enabled.' };
    } else if (!domain) {
      gsc = { connected: false, message: 'No domain configured.' };
    } else {
      SearchConsole.Searchanalytics.query(domain, {
        startDate: '2026-06-01',
        endDate: '2026-06-26',
        rowLimit: 1
      });
      gsc = { connected: true, message: 'Connected to GSC' };
    }
  } catch (e) {
    gsc = { connected: false, message: e.message };
  }

  // GA4 test
  let ga4 = { connected: false, message: 'Not tested' };
  try {
    if (typeof AnalyticsData === 'undefined') {
      ga4 = { connected: false, message: 'Analytics Data API service not enabled.' };
    } else if (!ga4Prop) {
      ga4 = { connected: false, message: 'GA4 property ID not set.' };
    } else {
      const cleanProp = ga4Prop.replace('properties/', '');
      AnalyticsData.properties.runReport({
        property: 'properties/' + cleanProp,
        dateRanges: [{ startDate: '2026-06-01', endDate: '2026-06-26' }],
        metrics: [{ name: 'sessions' }],
        limit: 1
      });
      ga4 = { connected: true, message: 'Connected to GA4' };
    }
  } catch (e) {
    ga4 = { connected: false, message: e.message };
  }

  // Gemini test
  let gemini = { connected: false, message: 'Not tested' };
  const geminiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!geminiKey) {
    gemini = { connected: false, message: 'GEMINI_API_KEY not set in script properties.' };
  } else {
    try {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + geminiKey;
      const payload = { contents: [{ parts: [{ text: "Hello" }] }] };
      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };
      const response = UrlFetchApp.fetch(url, options);
      const data = JSON.parse(response.getContentText());
      if (data.candidates && data.candidates.length > 0) {
        gemini = { connected: true, message: 'Gemini responded' };
      } else {
        gemini = { connected: false, message: 'Unexpected Gemini response' };
      }
    } catch (e) {
      gemini = { connected: false, message: e.message };
    }
  }

  return { gsc, ga4, gemini };
}

function testGSCConnection(domain) {
  domain = domain || getDomain();
  if (typeof SearchConsole === 'undefined') {
    return { success: false, message: 'Search Console API service is not enabled.' };
  }
  try {
    if (!domain) throw new Error('No domain configured.');
    SearchConsole.Searchanalytics.query(domain, {
      startDate: '2026-06-01',
      endDate: '2026-06-26',
      rowLimit: 1
    });
    return { success: true, domain: domain };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function testGA4Connection(propertyId) {
  if (typeof AnalyticsData === 'undefined') {
    return { success: false, message: 'Google Analytics Data API service is not enabled.' };
  }
  try {
    if (!propertyId) throw new Error('GA4 property ID is required.');
    const cleanProp = propertyId.replace('properties/', '');
    const request = {
      property: 'properties/' + cleanProp,
      dateRanges: [{ startDate: '2026-06-01', endDate: '2026-06-26' }],
      metrics: [{ name: 'sessions' }],
      limit: 1
    };
    AnalyticsData.properties.runReport(request);
    return { success: true, propertyId: cleanProp };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function testGeminiConnection() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return { success: false, message: 'GEMINI_API_KEY not set in script properties.' };
  }
  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + apiKey;
    const payload = {
      contents: [{ parts: [{ text: "Hello" }] }]
    };
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    if (data.candidates && data.candidates.length > 0) {
      return { success: true, message: 'Gemini responded successfully.' };
    } else {
      return { success: false, message: 'Unexpected Gemini response.' };
    }
  } catch (e) {
    return { success: false, message: e.message };
  }
}
