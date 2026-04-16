const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ============ MONGODB CONNECTION ============
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/kisansetu?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        console.error('Please set the MONGODB_URI environment variable in Render dashboard.');
    });

// ============ MONGOOSE SCHEMAS ============

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['farmer', 'editor'], required: true },
    mobile: { type: String, required: true, unique: true },
    district: { type: String, required: true },
    approved: { type: Boolean, default: true },
    verificationCrop: { type: String, required: true },
    registeredAt: { type: Date, default: Date.now }
});

const mandiPriceSchema = new mongoose.Schema({
    state: { type: String, required: true },
    mandi: { type: String, required: true },
    crop: { type: String, required: true },
    price: { type: Number, required: true }
});
// Compound index for fast lookups
mandiPriceSchema.index({ state: 1, mandi: 1, crop: 1 }, { unique: true });

const priceHistorySchema = new mongoose.Schema({
    state: String,
    mandi: String,
    crop: String,
    oldPrice: Number,
    newPrice: Number,
    editor: String,
    timestamp: { type: String, default: () => new Date().toLocaleString() }
});

const editorApprovalSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    name: String,
    email: String,
    mobile: String,
    district: String
});

const appConfigSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: mongoose.Schema.Types.Mixed
});

const User = mongoose.model('User', userSchema);
const MandiPrice = mongoose.model('MandiPrice', mandiPriceSchema);
const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);
const EditorApproval = mongoose.model('EditorApproval', editorApprovalSchema);
const AppConfig = mongoose.model('AppConfig', appConfigSchema);

// Store verification sessions (in-memory is fine for short-lived sessions)
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

// ============ SEED DATABASE ============
async function initDatabase() {
    try {
        const userCount = await User.countDocuments();
        if (userCount === 0) {
            console.log('⚠️ No users found. Seeding database...');

            // Seed default users
            await User.create([
                {
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
                    name: "Price Editor",
                    email: "editor@kisan.com",
                    password: bcrypt.hashSync("editor123", 10),
                    role: "editor",
                    mobile: "9876543211",
                    district: "Delhi",
                    approved: true,
                    verificationCrop: "rice"
                }
            ]);
            console.log('✅ Default users created');
        }

        const priceCount = await MandiPrice.countDocuments();
        if (priceCount === 0) {
            console.log('⚠️ No mandi prices found. Seeding prices...');

            const crops = ["wheat", "rice", "tomato", "onion", "potato", "chili", "brinjal", "cauliflower", "cabbage", "garlic", "ginger", "mango", "banana", "sugarcane", "cotton", "maize"];
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

            const priceDocs = [];
            for (const [state, mandis] of Object.entries(mandisMap)) {
                for (const mandi of mandis) {
                    for (const crop of crops) {
                        let basePrice = 1500;
                        if (crop === 'wheat') basePrice = 2350 + Math.floor(Math.random() * 200);
                        else if (crop === 'rice') basePrice = 2150 + Math.floor(Math.random() * 200);
                        else if (crop === 'tomato') basePrice = 1750 + Math.floor(Math.random() * 300);
                        else if (crop === 'onion') basePrice = 1550 + Math.floor(Math.random() * 250);
                        else if (crop === 'potato') basePrice = 1350 + Math.floor(Math.random() * 200);
                        else if (crop === 'chili') basePrice = 3100 + Math.floor(Math.random() * 400);
                        else basePrice = 1800 + Math.floor(Math.random() * 300);

                        priceDocs.push({ state, mandi, crop, price: basePrice });
                    }
                }
            }
            await MandiPrice.insertMany(priceDocs);
            console.log(`✅ Seeded ${priceDocs.length} mandi prices`);

            await AppConfig.findOneAndUpdate(
                { key: 'lastUpdated' },
                { value: new Date().toISOString() },
                { upsert: true }
            );
        }
    } catch (err) {
        console.error('Error seeding database:', err.message);
    }
}

// ============ API ROUTES ============

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, mobile, district, password, role, adminCode, verificationCrop } = req.body;

        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ success: false, message: "Email already exists" });
        }

        const existingMobile = await User.findOne({ mobile });
        if (existingMobile) {
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

        const newUser = await User.create({
            name, email, mobile, district,
            password: bcrypt.hashSync(password, 10),
            role,
            approved: role === 'farmer',
            verificationCrop
        });

        if (role === 'editor') {
            await EditorApproval.create({
                userId: newUser._id, name, email, mobile, district
            });
        }

        console.log(`✅ New user registered: ${email} (${role})`);
        res.json({ success: true, message: role === 'editor' ? "Editor registration submitted for approval" : "Registration successful" });
    } catch (err) {
        console.error('Registration error:', err.message);
        res.status(500).json({ success: false, message: "Server error during registration" });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        const user = await User.findOne({ email, role });

        if (user && bcrypt.compareSync(password, user.password)) {
            if (role === 'editor' && !user.approved) {
                return res.status(403).json({ success: false, message: "Account pending approval" });
            }
            res.json({
                success: true,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    district: user.district,
                    mobile: user.mobile
                }
            });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ success: false, message: "Server error during login" });
    }
});

app.post('/api/forgot-password/verify-mobile', async (req, res) => {
    try {
        const { mobile } = req.body;
        const user = await User.findOne({ mobile });

        if (!user) {
            return res.status(404).json({ success: false, message: "Mobile number not registered" });
        }

        const sessionId = Date.now().toString() + user._id;
        verificationSessions.set(sessionId, {
            userId: user._id.toString(),
            mobile: mobile,
            createdAt: Date.now(),
            expiresAt: Date.now() + 15 * 60 * 1000
        });

        res.json({ success: true, userId: user._id, sessionId: sessionId });
    } catch (err) {
        console.error('Verify mobile error:', err.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post('/api/forgot-password/verify-crop', async (req, res) => {
    try {
        const { userId, selectedCrop, sessionId } = req.body;

        const session = verificationSessions.get(sessionId);
        if (!session || Date.now() > session.expiresAt) {
            return res.status(400).json({ success: false, message: "Session expired. Please start over." });
        }

        const user = await User.findById(userId);
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
    } catch (err) {
        console.error('Verify crop error:', err.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post('/api/reset-password', async (req, res) => {
    try {
        const { userId, newPassword, sessionId } = req.body;

        const session = verificationSessions.get(sessionId);
        if (!session || !session.verified || Date.now() > session.expiresAt) {
            return res.status(400).json({ success: false, message: "Verification required. Please start over." });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        user.password = bcrypt.hashSync(newPassword, 10);
        await user.save();
        verificationSessions.delete(sessionId);

        res.json({ success: true, message: "Password reset successfully" });
    } catch (err) {
        console.error('Reset password error:', err.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
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
app.get('/api/states', async (req, res) => {
    try {
        const states = await MandiPrice.distinct('state');
        res.json({ success: true, states });
    } catch (err) {
        console.error('States error:', err.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Get prices (Integrated with Data.gov.in Agmarknet API)
app.get('/api/prices/:state/:crop', async (req, res) => {
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

    // Fallback: If API fails, use MongoDB data
    try {
        const mandiPrices = await MandiPrice.find({ state, crop });
        const prices = mandiPrices.map(mp => {
            const geo = getGeoForMandi(mp.mandi, state);
            return {
                mandi: mp.mandi,
                price: mp.price,
                crop: crop,
                state: state,
                arrival_date: new Date().toISOString().split('T')[0],
                lat: geo.lat,
                lng: geo.lng
            };
        });

        const config = await AppConfig.findOne({ key: 'lastUpdated' });
        const lastUpdated = config ? config.value : new Date().toISOString();

        const fallbackPayload = {
            success: true,
            prices,
            lastUpdated,
            source: "Agmarknet Fallback Mock"
        };
        apiCache[cacheKey] = { timestamp: Date.now(), data: fallbackPayload };
        res.json(fallbackPayload);
    } catch (err) {
        console.error('Prices error:', err.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Get Historical Trends Data
app.get('/api/trends/:state/:crop', async (req, res) => {
    const { state, crop } = req.params;

    try {
        // Calculate average current price from MongoDB
        const result = await MandiPrice.aggregate([
            { $match: { state, crop } },
            { $group: { _id: null, avgPrice: { $avg: "$price" } } }
        ]);

        let avgCurrentPrice = result.length > 0 ? result[0].avgPrice : 1500;

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
    } catch (err) {
        console.error('Trends error:', err.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post('/api/update-price', async (req, res) => {
    try {
        const { state, mandi, crop, newPrice, editorName } = req.body;

        const mandiPrice = await MandiPrice.findOne({ state, mandi, crop });
        if (!mandiPrice) {
            return res.status(404).json({ success: false, message: "Mandi price not found" });
        }

        const oldPrice = mandiPrice.price;
        mandiPrice.price = newPrice;
        await mandiPrice.save();

        await AppConfig.findOneAndUpdate(
            { key: 'lastUpdated' },
            { value: new Date().toISOString() },
            { upsert: true }
        );

        await PriceHistory.create({
            state, mandi, crop, oldPrice, newPrice,
            editor: editorName,
            timestamp: new Date().toLocaleString()
        });

        // Keep only last 30 history entries
        const count = await PriceHistory.countDocuments();
        if (count > 30) {
            const oldest = await PriceHistory.find().sort({ _id: 1 }).limit(count - 30);
            const idsToDelete = oldest.map(doc => doc._id);
            await PriceHistory.deleteMany({ _id: { $in: idsToDelete } });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Update price error:', err.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.get('/api/history', async (req, res) => {
    try {
        const history = await PriceHistory.find().sort({ _id: -1 }).limit(30);
        res.json({ success: true, history });
    } catch (err) {
        console.error('History error:', err.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.get('/api/crops', (req, res) => {
    const crops = ["wheat", "rice", "tomato", "onion", "potato", "chili", "brinjal", "cauliflower", "cabbage", "garlic", "ginger", "mango", "banana", "sugarcane", "cotton", "maize"];
    const cropNames = { wheat: "🌾 Wheat", rice: "🍚 Rice", tomato: "🍅 Tomato", onion: "🧅 Onion", potato: "🥔 Potato", chili: "🌶️ Chili", brinjal: "🍆 Brinjal", cauliflower: "🥦 Cauliflower", cabbage: "🥬 Cabbage", garlic: "🧄 Garlic", ginger: "🫚 Ginger", mango: "🥭 Mango", banana: "🍌 Banana", sugarcane: "🎋 Sugarcane", cotton: "🌿 Cotton", maize: "🌽 Maize" };
    res.json({ success: true, crops: crops.map(c => ({ id: c, name: cropNames[c] })) });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const dbState = mongoose.connection.readyState;
        const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
        const userCount = dbState === 1 ? await User.countDocuments() : 0;
        res.json({
            success: true,
            database: states[dbState],
            users: userCount,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Wait for MongoDB connection before seeding
mongoose.connection.once('open', () => {
    initDatabase();
});

app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`🌾 Picture-based verification enabled!`);
    console.log(`👨‍🌾 Farmer login: farmer@kisan.com / farmer123`);
    console.log(`📝 Editor login: editor@kisan.com / editor123\n`);
});
