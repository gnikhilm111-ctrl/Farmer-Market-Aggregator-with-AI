const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, 'data', 'database.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// Store verification sessions
const verificationSessions = new Map();

// API Cache
const apiCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Available crops
const availableCrops = [
    { id: "wheat", name: "Wheat", emoji: "🌾" },
    { id: "rice", name: "Rice", emoji: "🍚" },
    { id: "maize", name: "Maize", emoji: "🌽" },
    { id: "tomato", name: "Tomato", emoji: "🍅" },
    { id: "onion", name: "Onion", emoji: "🧅" },
    { id: "potato", name: "Potato", emoji: "🥔" },
    { id: "chili", name: "Chili", emoji: "🌶️" },
    { id: "mango", name: "Mango", emoji: "🥭" },
    { id: "banana", name: "Banana", emoji: "🍌" },
    { id: "brinjal", name: "Brinjal", emoji: "🍆" }
];

function initDatabase() {
    if (!fs.existsSync(DB_PATH)) {
        const crops = ["wheat", "rice", "tomato", "onion", "potato", "chili", "brinjal", "cauliflower", "cabbage", "garlic", "ginger", "mango", "banana", "sugarcane", "cotton", "maize"];
        const states = ["Uttar Pradesh", "Maharashtra", "Punjab", "Haryana", "Madhya Pradesh", "Rajasthan", "Gujarat", "West Bengal", "Bihar", "Tamil Nadu", "Karnataka", "Andhra Pradesh", "Telangana", "Odisha", "Assam"];
        
        const mandisMap = {
            "Uttar Pradesh": ["Lucknow Mandi", "Agra Mandi", "Varanasi Mandi", "Kanpur Mandi", "Bareilly Mandi"],
            "Maharashtra": ["Mumbai APMC", "Nagpur Mandi", "Pune Mandi", "Nashik Mandi"],
            "Punjab": ["Ludhiana Mandi", "Amritsar Mandi", "Jalandhar Mandi"],
            "Haryana": ["Karnal Mandi", "Hisar Mandi"],
            "Madhya Pradesh": ["Indore Mandi", "Bhopal Mandi"],
            "Rajasthan": ["Jaipur Mandi", "Jodhpur Mandi"],
            "Gujarat": ["Ahmedabad Mandi", "Surat Mandi"],
            "West Bengal": ["Kolkata Mandi", "Howrah Mandi"],
            "Bihar": ["Patna Mandi", "Gaya Mandi"],
            "Tamil Nadu": ["Chennai Mandi", "Coimbatore Mandi"],
            "Karnataka": ["Bangalore Mandi", "Mysore Mandi"],
            "Andhra Pradesh": ["Vijayawada Mandi", "Visakhapatnam Mandi"],
            "Telangana": ["Hyderabad Mandi", "Warangal Mandi"],
            "Odisha": ["Bhubaneswar Mandi", "Cuttack Mandi"],
            "Assam": ["Guwahati Mandi", "Jorhat Mandi"]
        };
        
        const mandiPrices = {};
        states.forEach(state => {
            mandiPrices[state] = {};
            const mandis = mandisMap[state] || [`${state} Central Mandi`];
            mandis.forEach(mandi => {
                mandiPrices[state][mandi] = {};
                crops.forEach(crop => {
                    let basePrice = 1500;
                    if (crop === 'wheat') basePrice = 2350 + Math.floor(Math.random() * 200);
                    else if (crop === 'rice') basePrice = 2150 + Math.floor(Math.random() * 200);
                    else if (crop === 'tomato') basePrice = 1750 + Math.floor(Math.random() * 300);
                    else if (crop === 'onion') basePrice = 1550 + Math.floor(Math.random() * 250);
                    else if (crop === 'potato') basePrice = 1350 + Math.floor(Math.random() * 200);
                    else if (crop === 'chili') basePrice = 3100 + Math.floor(Math.random() * 400);
                    else basePrice = 1800 + Math.floor(Math.random() * 300);
                    mandiPrices[state][mandi][crop] = basePrice;
                });
            });
        });
        
        const initialData = {
            users: [
                {
                    id: 1,
                    name: "Ramesh Farmer",
                    email: "farmer@kisan.com",
                    password: bcrypt.hashSync("farmer123", 10),
                    role: "farmer",
                    mobile: "9876543210",
                    district: "Lucknow",
                    approved: true,
                    verificationCrop: "wheat"
                },
                {
                    id: 2,
                    name: "Price Editor",
                    email: "editor@kisan.com",
                    password: bcrypt.hashSync("editor123", 10),
                    role: "editor",
                    mobile: "9876543211",
                    district: "Delhi",
                    approved: true,
                    verificationCrop: "rice"
                }
            ],
            mandiPrices: mandiPrices,
            priceUpdateHistory: [],
            lastUpdated: new Date().toISOString(),
            editorApprovalList: []
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
    }
}

// ============ API ROUTES ============

app.post('/api/register', (req, res) => {
    const { name, email, mobile, district, password, role, adminCode, verificationCrop } = req.body;
    const db = JSON.parse(fs.readFileSync(DB_PATH));
    
    if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ success: false, message: "Email already exists" });
    }
    if (db.users.find(u => u.mobile === mobile)) {
        return res.status(400).json({ success: false, message: "Mobile number already registered" });
    }
    if (!verificationCrop) {
        return res.status(400).json({ success: false, message: "Please select a verification crop" });
    }
    
    if (role === 'editor') {
        const ADMIN_CODE = "KISANADMIN2024";
        if (!adminCode || adminCode !== ADMIN_CODE) {
            return res.status(403).json({ success: false, message: "Invalid admin code" });
        }
    }
    
    const newUser = {
        id: db.users.length + 1,
        name, email, mobile, district,
        password: bcrypt.hashSync(password, 10),
        role,
        approved: role === 'farmer',
        registeredAt: new Date().toISOString(),
        verificationCrop: verificationCrop
    };
    
    db.users.push(newUser);
    if (role === 'editor') {
        db.editorApprovalList = db.editorApprovalList || [];
        db.editorApprovalList.push({ userId: newUser.id, name, email, mobile, district });
    }
    
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    res.json({ success: true, message: role === 'editor' ? "Editor registration submitted for approval" : "Registration successful" });
});

app.post('/api/login', (req, res) => {
    const { email, password, role } = req.body;
    const db = JSON.parse(fs.readFileSync(DB_PATH));
    const user = db.users.find(u => u.email === email && u.role === role);
    
    if (user && bcrypt.compareSync(password, user.password)) {
        if (role === 'editor' && !user.approved) {
            return res.status(403).json({ success: false, message: "Account pending approval" });
        }
        res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, district: user.district, mobile: user.mobile } });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});

app.post('/api/forgot-password/verify-mobile', (req, res) => {
    const { mobile } = req.body;
    const db = JSON.parse(fs.readFileSync(DB_PATH));
    const user = db.users.find(u => u.mobile === mobile);
    
    if (!user) {
        return res.status(404).json({ success: false, message: "Mobile number not registered" });
    }
    
    const sessionId = Date.now().toString() + user.id;
    verificationSessions.set(sessionId, {
        userId: user.id,
        mobile: mobile,
        createdAt: Date.now(),
        expiresAt: Date.now() + 15 * 60 * 1000
    });
    
    res.json({ success: true, userId: user.id, sessionId: sessionId });
});

app.post('/api/forgot-password/verify-crop', (req, res) => {
    const { userId, selectedCrop, sessionId } = req.body;
    const db = JSON.parse(fs.readFileSync(DB_PATH));
    
    const session = verificationSessions.get(sessionId);
    if (!session || Date.now() > session.expiresAt) {
        return res.status(400).json({ success: false, message: "Session expired. Please start over." });
    }
    
    const user = db.users.find(u => u.id === parseInt(userId));
    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }
    
    if (user.verificationCrop === selectedCrop) {
        session.verified = true;
        verificationSessions.set(sessionId, session);
        res.json({ success: true, message: "Crop verified successfully" });
    } else {
        res.status(401).json({ success: false, message: "Incorrect crop selection. Please try again." });
    }
});

app.post('/api/reset-password', (req, res) => {
    const { userId, newPassword, sessionId } = req.body;
    const db = JSON.parse(fs.readFileSync(DB_PATH));
    
    const session = verificationSessions.get(sessionId);
    if (!session || !session.verified || Date.now() > session.expiresAt) {
        return res.status(400).json({ success: false, message: "Verification required. Please start over." });
    }
    
    const userIndex = db.users.findIndex(u => u.id === parseInt(userId));
    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: "User not found" });
    }
    
    db.users[userIndex].password = bcrypt.hashSync(newPassword, 10);
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    verificationSessions.delete(sessionId);
    
    res.json({ success: true, message: "Password reset successfully" });
});

// A simple dictionary mapping common cities/mandis to approximate coordinates
const cityCoordinates = {
    "Lucknow Mandi": { lat: 26.8467, lng: 80.9462 },
    "Agra Mandi": { lat: 27.1767, lng: 78.0081 },
    "Varanasi Mandi": { lat: 25.3176, lng: 82.9739 },
    "Kanpur Mandi": { lat: 26.4499, lng: 80.3319 },
    "Bareilly Mandi": { lat: 28.3670, lng: 79.4304 },
    "Mumbai APMC": { lat: 19.0760, lng: 72.8777 },
    "Nagpur Mandi": { lat: 21.1458, lng: 79.0882 },
    "Pune Mandi": { lat: 18.5204, lng: 73.8567 },
    "Nashik Mandi": { lat: 20.0110, lng: 73.7903 },
    "Ludhiana Mandi": { lat: 30.9010, lng: 75.8573 },
    "Amritsar Mandi": { lat: 31.6340, lng: 74.8723 },
    "Jalandhar Mandi": { lat: 31.3260, lng: 75.5762 },
    "Karnal Mandi": { lat: 29.6857, lng: 76.9905 },
    "Hisar Mandi": { lat: 29.1492, lng: 75.7217 },
    "Indore Mandi": { lat: 22.7196, lng: 75.8577 },
    "Bhopal Mandi": { lat: 23.2599, lng: 77.4126 },
    "Jaipur Mandi": { lat: 26.9124, lng: 75.7873 },
    "Jodhpur Mandi": { lat: 26.2389, lng: 73.0243 },
    "Ahmedabad Mandi": { lat: 23.0225, lng: 72.5714 },
    "Surat Mandi": { lat: 21.1702, lng: 72.8311 },
    "Kolkata Mandi": { lat: 22.5726, lng: 88.3639 },
    "Howrah Mandi": { lat: 22.5958, lng: 88.3110 },
    "Patna Mandi": { lat: 25.5941, lng: 85.1376 },
    "Gaya Mandi": { lat: 24.7914, lng: 85.0002 },
    "Chennai Mandi": { lat: 13.0827, lng: 80.2707 },
    "Coimbatore Mandi": { lat: 11.0168, lng: 76.9558 },
    "Bangalore Mandi": { lat: 12.9716, lng: 77.5946 },
    "Mysore Mandi": { lat: 12.2958, lng: 76.6394 },
    "Vijayawada Mandi": { lat: 16.5062, lng: 80.6480 },
    "Visakhapatnam Mandi": { lat: 17.6868, lng: 83.2185 },
    "Hyderabad Mandi": { lat: 17.3850, lng: 78.4867 },
    "Warangal Mandi": { lat: 17.9689, lng: 79.5941 },
    "Bhubaneswar Mandi": { lat: 20.2961, lng: 85.8245 },
    "Cuttack Mandi": { lat: 20.4625, lng: 85.8830 },
    "Guwahati Mandi": { lat: 26.1445, lng: 91.7362 },
    "Jorhat Mandi": { lat: 26.7509, lng: 94.2037 }
};

function getGeoForMandi(mandiName, fallbackState) {
    if (cityCoordinates[mandiName]) return cityCoordinates[mandiName];
    // Fallback: random coordinate somewhere in central India
    return {
        lat: 22.0 + (Math.random() * 6 - 3),
        lng: 78.0 + (Math.random() * 8 - 4)
    };
}

// Get all states
app.get('/api/states', (req, res) => {
    const db = JSON.parse(fs.readFileSync(DB_PATH));
    res.json({ success: true, states: Object.keys(db.mandiPrices) });
});

// Get prices (Integrated with Data.gov.in Agmarknet API)
app.get('/api/prices/:state/:crop', async (req, res) => {
    const db = JSON.parse(fs.readFileSync(DB_PATH));
    const { state, crop } = req.params;
    
    const cacheKey = `${state}_${crop}`;
    if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_DURATION) {
        return res.json(apiCache[cacheKey].data);
    }
    
    // Official Data.gov.in API Key
    const apiKey = process.env.DATA_GOV_IN_API_KEY || "579b464db66ec23bdd00000195b8dd1f867649657a7e29db475bdbc1";
    
    // Capitalize crop for API keyword filtering
    const cropTitleCase = crop.charAt(0).toUpperCase() + crop.slice(1);
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 sec timeout
        
        const url = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${apiKey}&format=json&filters[state.keyword]=${encodeURIComponent(state)}&filters[commodity.keyword]=${encodeURIComponent(cropTitleCase)}&limit=50`;
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            if (data.records && data.records.length > 0) {
                const realPrices = data.records.map(record => {
                    const geo = getGeoForMandi(record.market, state);
                    return {
                        mandi: record.market,
                        price: parseFloat(record.modal_price) || 1500,
                        crop: crop,
                        state: state,
                        arrival_date: record.arrival_date,
                        lat: geo.lat,
                        lng: geo.lng
                    };
                });
                const payload = { 
                    success: true, 
                    prices: realPrices, 
                    lastUpdated: new Date().toISOString(),
                    source: "Data.gov.in Live Official API" 
                };
                apiCache[cacheKey] = { timestamp: Date.now(), data: payload };
                return res.json(payload);
            }
        }
    } catch (e) {
        console.error("Data.gov API error, using fallback:", e.message || e);
    }
    
    // Fallback: If API fails, throws, or returns empty records, use local mock
    const prices = [];
    if (db.mandiPrices[state]) {
        Object.keys(db.mandiPrices[state]).forEach(mandi => {
            const basePrice = db.mandiPrices[state][mandi][crop] || 1500;
            const geo = getGeoForMandi(mandi, state);
            prices.push({ 
                mandi: mandi, 
                price: basePrice, 
                crop: crop,
                state: state,
                arrival_date: new Date().toISOString().split('T')[0],
                lat: geo.lat,
                lng: geo.lng
            });
        });
    }
    
    const fallbackPayload = { 
        success: true, 
        prices, 
        lastUpdated: db.lastUpdated,
        source: "Agmarknet Fallback Mock"
    };
    apiCache[cacheKey] = { timestamp: Date.now(), data: fallbackPayload };
    res.json(fallbackPayload);
});

// Get Historical Trends Data
app.get('/api/trends/:state/:crop', (req, res) => {
    const db = JSON.parse(fs.readFileSync(DB_PATH));
    const { state, crop } = req.params;
    
    // In a real scenario, this fetches from Data.gov.in historic sets.
    // For now, we generate a 7-day realistic fluctuating trend around the average current state price.
    let avgCurrentPrice = 1500;
    let mandiCount = 0;
    
    if (db.mandiPrices[state]) {
        Object.keys(db.mandiPrices[state]).forEach(mandi => {
            if (db.mandiPrices[state][mandi][crop]) {
                avgCurrentPrice += db.mandiPrices[state][mandi][crop];
                mandiCount++;
            }
        });
        if (mandiCount > 0) {
            avgCurrentPrice = avgCurrentPrice / (mandiCount + 1); // rough average
        }
    }
    
    const trends = [];
    const labels = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toISOString().split('T')[0]);
        // Historical variations are +- up to 4% per day
        const volatility = avgCurrentPrice * 0.04; 
        const simulatedHistPrice = Math.round(avgCurrentPrice + (Math.sin(i * 1.5) * volatility) + (Math.random() * volatility * 0.5));
        trends.push(Math.max(500, simulatedHistPrice));
    }
    
    res.json({ success: true, labels, prices: trends });
});

app.post('/api/update-price', (req, res) => {
    const { state, mandi, crop, newPrice, editorName } = req.body;
    const db = JSON.parse(fs.readFileSync(DB_PATH));
    const oldPrice = db.mandiPrices[state][mandi][crop];
    db.mandiPrices[state][mandi][crop] = newPrice;
    db.lastUpdated = new Date().toISOString();
    db.priceUpdateHistory.unshift({ state, mandi, crop, oldPrice, newPrice, editor: editorName, timestamp: new Date().toLocaleString() });
    db.priceUpdateHistory = db.priceUpdateHistory.slice(0, 30);
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    res.json({ success: true });
});

app.get('/api/history', (req, res) => {
    const db = JSON.parse(fs.readFileSync(DB_PATH));
    res.json({ success: true, history: db.priceUpdateHistory });
});

app.get('/api/crops', (req, res) => {
    const crops = ["wheat", "rice", "tomato", "onion", "potato", "chili", "brinjal", "cauliflower", "cabbage", "garlic", "ginger", "mango", "banana", "sugarcane", "cotton", "maize"];
    const cropNames = { wheat: "🌾 Wheat", rice: "🍚 Rice", tomato: "🍅 Tomato", onion: "🧅 Onion", potato: "🥔 Potato", chili: "🌶️ Chili", brinjal: "🍆 Brinjal", cauliflower: "🥦 Cauliflower", cabbage: "🥬 Cabbage", garlic: "🧄 Garlic", ginger: "🫚 Ginger", mango: "🥭 Mango", banana: "🍌 Banana", sugarcane: "🎋 Sugarcane", cotton: "🌿 Cotton", maize: "🌽 Maize" };
    res.json({ success: true, crops: crops.map(c => ({ id: c, name: cropNames[c] })) });
});

initDatabase();
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`🌾 Picture-based verification enabled!`);
    console.log(`👨‍🌾 Farmer login: farmer@kisan.com / farmer123`);
    console.log(`📝 Editor login: editor@kisan.com / editor123\n`);
});