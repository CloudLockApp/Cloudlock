// Vertical Scrolling Security Ticker Module

const RSS_TO_JSON_URL = 'https://api.rss2json.com/v1/api.json';
const SECURITY_FEEDS = [
    'https://feeds.feedburner.com/TheHackersNews', 
    'https://krebsonsecurity.com/feed/', 
    'https://www.bleepingcomputer.com/feed/', 
    'https://www.darkreading.com/rss.xml', 
    'https://www.securityweek.com/feed/', 
    'https://threatpost.com/feed/', 
];

let tickerNews = [];
let currentIndex = 0;

// Fetch security news
async function fetchTickerNews() {
    try {
        const allNews = [];
        
        for (const feedUrl of SECURITY_FEEDS) {
            const response = await fetch(`${RSS_TO_JSON_URL}?rss_url=${encodeURIComponent(feedUrl)}`);
            const data = await response.json();
            
            if (data.status === 'ok' && data.items) {
                const relevantNews = data.items
                    .filter(item => {
                        const text = (item.title + ' ' + item.description).toLowerCase();
                        
                        // Blacklist - filter out garbage (more aggressive)
                        const blacklist = [
                            'ebook', 'e-book', 'free', 'download', 'pdf',
                            'dummies', 'guide', 'tutorial', 'how to',
                            'limited time', 'offer', 'deal', 'discount',
                            'webinar', 'course', 'training', 'learn',
                            'top 10', 'top 5', 'best practices', 'tips',
                            'infographic', 'whitepaper', 'report',
                            'sponsored', 'promo', 'advertisement',
                            'edition', 'book', 'read', 'available now'
                        ];
                        
                        // Check if any blacklisted term exists
                        const hasBlacklisted = blacklist.some(term => text.includes(term));
                        if (hasBlacklisted) return false;
                        
                        // Require at least ONE severity keyword
                        const severityKeywords = [
                            'breach', 'hacked', 'leaked', 'compromised',
                            'vulnerability', 'exploit', 'zero-day', 'cve',
                            'ransomware', 'malware', 'phishing',
                            'million', 'billion',
                            'attack', 'threat', 'incident',
                            'password', 'data', 'security'
                        ];
                        
                        return severityKeywords.some(keyword => text.includes(keyword));
                    })
                    .slice(0, 3);
                
                allNews.push(...relevantNews);
            }
        }
        
        tickerNews = allNews
            .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
            .slice(0, 10);
        
        console.log(`✅ Loaded ${tickerNews.length} ticker news items`);
        return tickerNews;
        
    } catch (error) {
        console.error('❌ Error fetching ticker news:', error);
        return getFallbackTickerNews();
    }
}

// Fallback news
function getFallbackTickerNews() {
    return [
        {
            title: "Major data breach exposes 2M user credentials",
            link: "#",
            pubDate: new Date().toISOString()
        },
        {
            title: "New phishing campaign targets password managers",
            link: "#",
            pubDate: new Date().toISOString()
        },
        {
            title: "Security researchers discover critical vulnerability",
            link: "#",
            pubDate: new Date().toISOString()
        }
    ];
}

// Create vertical ticker in nav
function createVerticalTicker() {
    const nav = document.querySelector('nav .nav-container');
    if (!nav || tickerNews.length === 0) return;
    
    const tickerHTML = `
        <div class="vertical-ticker">
            <div class="ticker-live-indicator">
                <span class="live-dot"></span>
                <span class="live-text">DEBRIEF</span>
            </div>
            <div class="ticker-news-container">
                <div class="ticker-news-track" id="ticker-track">
                    ${tickerNews.map((item, index) => `
                        <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="ticker-news-item ${index === 0 ? 'active' : ''}" data-index="${index}">
                            ${item.title}
                        </a>
                    `).join('')}
                </div>
            </div>
            <a href="${tickerNews[0]?.link || '#'}" target="_blank" rel="noopener noreferrer" class="ticker-link-btn" id="ticker-link-btn" title="Read full article">
                <i class="fas fa-external-link-alt"></i>
            </a>
        </div>
    `;
    
    // Insert after logo
    const logo = nav.querySelector('.logo');
    if (logo) {
        logo.insertAdjacentHTML('afterend', tickerHTML);
    }
    
    // Start vertical scrolling
    startVerticalScroll();
}

// Start vertical scrolling animation
function startVerticalScroll() {
    if (tickerNews.length <= 1) return;
    
    setInterval(() => {
        const track = document.getElementById('ticker-track');
        const linkBtn = document.getElementById('ticker-link-btn');
        if (!track) return;
        
        const items = track.querySelectorAll('.ticker-news-item');
        if (items.length === 0) return;
        
        const currentItem = items[currentIndex];
        
        // Remove active class from current
        if (currentItem) {
            currentItem.classList.remove('active');
        }
        
        // Move to next index
        currentIndex = (currentIndex + 1) % tickerNews.length;
        const nextItem = items[currentIndex];
        
        // Update link button href
        if (linkBtn && tickerNews[currentIndex]) {
            linkBtn.href = tickerNews[currentIndex].link;
        }
        
        // Calculate the offset - multiply by item height (28px)
        const offset = currentIndex * 28;
        
        // Slide up animation
        track.style.transform = `translateY(-${offset}px)`;
        
        // Add active class to next after animation starts
        setTimeout(() => {
            if (nextItem) {
                nextItem.classList.add('active');
            }
        }, 100);
        
    }, 6000); // Change every 6 seconds
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing vertical ticker...');
    
    if (document.querySelector('nav')) {
        await fetchTickerNews();
        createVerticalTicker();
        
        // Refresh news every 10 minutes
        setInterval(fetchTickerNews, 10 * 60 * 1000);
    }
});