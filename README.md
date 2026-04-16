# 🌾 KisanSetu: AI-Powered Farmer Market Aggregator

**KisanSetu** is a dedicated agricultural market platform built specifically to empower farmers. By combining real-time mandi prices, hyper-local weather advisories, and an AI-driven traffic light signal system, KisanSetu helps farmers make optimal decisions about when and where to sell their crops. 

Designed with accessibility primarily in mind, the platform uses visual indicators and **native bilingual voice outputs** to ensure that farmers of all literacy levels can instantly understand complex market data.

![KisanSetu Features](https://img.shields.io/badge/Status-Live-success.svg) ![Language Support](https://img.shields.io/badge/Language-English%20%7C%20Hindi-blue)

---

## 🚀 Key Features

*   🚦 **AI Traffic Light “Sell Signals”:** Analyzes current crop prices against a 7-day moving average and presents a `Green (Sell Now)`, `Yellow (Wait)`, or `Red (Hold)` visual indicator for easy decision-making.
*   🔊 **Bilingual Voice Advisories:** Uses the native browser SpeechSynthesis API to read out market advice and weather tips out loud in both **English** and **Hindi**.
*   🌦️ **Hyper-Local Weather Insights:** Integrates with the OpenWeatherMap API to provide district-level temperature and farming advisories on the main dashboard.
*   📊 **Real-Time Mandi Aggregation:** Displays live crop prices, highlights the highest competitive price in the state, and shows historical 7-day trend charts.
*   📱 **Low-Literacy & Mobile First:** No typing required. A simple point-and-click UI built with big buttons and color-coded information.

---

## 🛠️ Technology Stack

*   **Frontend:** Vanilla HTML5, CSS3, and JavaScript (Hosted on GitHub Pages)
*   **Backend API:** Node.js, Express.js (Hosted on Render)
*   **Database:** MongoDB Atlas (Mongoose ODM)
*   **Data APIs:** OpenWeatherMap API, Native Web Speech API

---

## ⚙️ Running Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/gnikhilm111-ctrl/Farmer-Market-Aggregator-with-AI.git
   cd Farmer-Market-Aggregator-with-AI
   ```

2. **Backend Setup:**
   * Navigate to the backend directory:
     ```bash
     cd backend
     npm install
     ```
   * Create a `.env` file in the `backend` directory and add your credentials:
     ```env
     PORT=5000
     MONGODB_URI=your_mongodb_cluster_connection_string
     OPENWEATHER_API_KEY=your_openweathermap_api_key
     ```
   * Start the development server:
     ```bash
     npm run dev
     ```

3. **Frontend Setup:**
   * No complex build steps required. Simply open `frontend/index.html` in your favorite modern browser or serve it using a simple live server (like VS Code Live Server).

---

## 👨‍🌾 App Walkthrough

1. **Login Page:** Farmers can log in or register with basic details. All sessions are persistent. 
2. **Dashboard:**
   * Top card displays real-time weather alongside a farming tip. (Press the speaker icon to listen!)
   * The "AI Market Signals" horizontal scroll bar assesses all major crops in your state and advises on market timing.
   * "Select Crop" and "Sort By" allow for dynamic price filtering, visualizing market trends via a Chart.js historical line graph.

---

## 📝 License
This project is open-source and free to be adapted to help agricultural communities globally.
