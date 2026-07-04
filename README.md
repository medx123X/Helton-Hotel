🏨 Helton Hotel — Full-Stack Hospitality Platform with AI Cancellation Intelligence


Where every detail is a luxury — including the data.



<img width="1917" height="1087" alt="image" src="https://github.com/user-attachments/assets/99b41876-a553-436f-8826-51833834b5d8" />

<img width="1917" height="1086" alt="image" src="https://github.com/user-attachments/assets/f49bf1da-c983-473c-85bc-89471de62c34" />

<img width="1917" height="1087" alt="image" src="https://github.com/user-attachments/assets/ae0bf6c3-f43c-4b1d-8cba-142999d6322d" />

<img width="1917" height="1087" alt="image" src="https://github.com/user-attachments/assets/856b6830-aafe-4584-a5e7-9a643a3daf1a" />

<img width="1918" height="1091" alt="image" src="https://github.com/user-attachments/assets/a0f9d278-7740-44d0-aa65-88492b4554a7" />
<img width="1917" height="1090" alt="image" src="https://github.com/user-attachments/assets/9c596d3b-8fcb-45d7-b29e-62b2a32e5fd7" />
<img width="1917" height="1091" alt="image" src="https://github.com/user-attachments/assets/1e3383bd-e5af-448e-80d4-5a7d7100cb3d" />
<img width="1917" height="1091" alt="image" src="https://github.com/user-attachments/assets/fc037caa-693c-4fa7-83ce-61fa6eead90f" />
<img width="1917" height="1090" alt="image" src="https://github.com/user-attachments/assets/9ff7a6e7-8d92-4538-b148-120f5351af55" />
<img width="1917" height="1090" alt="image" src="https://github.com/user-attachments/assets/28b8e7cd-a18d-4368-84fa-8fbd97a0b5b3" />
<img width="1917" height="1087" alt="image" src="https://github.com/user-attachments/assets/b5cd251f-73e7-43aa-8fec-23cd994bfe92" />
<img width="1912" height="1091" alt="image" src="https://github.com/user-attachments/assets/ee03eff1-b025-4e70-addb-db778be9de3b" />
<img width="1917" height="1087" alt="image" src="https://github.com/user-attachments/assets/7bb7d15a-af5d-45a2-b9e0-0b22debe2981" />

<img width="1906" height="1087" alt="image" src="https://github.com/user-attachments/assets/d948895c-892f-463d-8009-1a35346f6158" />
<img width="1901" height="1087" alt="image" src="https://github.com/user-attachments/assets/115bce15-b912-465e-a484-977e02283701" />
<img width="1903" height="1091" alt="image" src="https://github.com/user-attachments/assets/c58388a2-3673-4bf6-b18e-d4ef27c9c79d" />
<img width="1901" height="1087" alt="image" src="https://github.com/user-attachments/assets/f761cead-1b8c-4d94-a8b8-f2c26199d77d" />





## Overview

Helton Hotel is a full-stack luxury hotel management platform built from the ground up, combining a modern guest-facing booking experience with a machine learning system that predicts booking cancellation risk in real time.

The project is split into two tightly integrated parts:

---

## Part 1 — Hotel Booking Platform

A complete hotel reservation system deployed on **Vercel**, built with vanilla HTML, CSS, and JavaScript on the frontend, and **Node.js serverless functions** on the backend.

### ✨ Features

- 🛎 **Luxury multi-screen booking flow** — guests enter personal details, choose room type and view, select services, and confirm their reservation
- 📧 **OTP email verification** via Brevo SMTP — guests verify their email before a booking is accepted
- 📅 **Real-time availability checking** — prevents double bookings by checking date conflicts before confirming
- ✉️ **Automated confirmation emails** sent to guests on booking with a unique reference code
- ❌ **Self-serve cancellation** — guests receive a signed cancellation link in their email valid for 1 year
- 🔐 **Admin portal** — hotel staff log in securely to view all bookings, cancel reservations, and trigger cancellation emails
- 🌐 **Bilingual support** — full Arabic and English interface with RTL layout switching
- 💾 **Persistent storage** via Upstash Redis — all bookings stored and retrieved in real time
- 📱 Fully responsive design built with a luxury dark gold aesthetic

### 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js Serverless Functions (Vercel) |
| Storage | Upstash Redis (REST API) |
| Email | Brevo SMTP API |
| Hosting | Vercel |

---

## Part 2 — AI Cancellation Risk Intelligence

A machine learning system that predicts the probability that any given hotel booking will be cancelled, giving hotel staff actionable intelligence before it happens.

### 📊 Dataset

Trained on the **Hotel Booking Demand dataset** — 119,390 real hotel bookings from two hotels (city and resort) covering 2015–2017, with 32 features including lead time, deposit type, market segment, guest history, room type, and pricing.

### 🔬 ML Pipeline

```
Raw Data (119,390 rows)
       ↓
Exploratory Data Analysis
       ↓
Data Cleaning & Leakage Prevention
       ↓
Feature Engineering
       ↓
Train / Test Split (80/20 stratified)
       ↓
ColumnTransformer Pipeline (StandardScaler + OneHotEncoder)
       ↓
Model Training & 3-Fold Cross Validation
       ↓
Model Comparison & Selection
       ↓
Hyperparameter Tuning (RandomizedSearchCV)
       ↓
Flask REST API → ngrok → predict.html
```

### 🧹 Data Cleaning

- Removed leakage columns — `reservation_status`, `reservation_status_date`, `assigned_room_type`
- Handled missing values — `agent`, `country`, `children`, `company`
- Removed 180 invalid zero-guest bookings
- Fixed 1 negative ADR value, capped outliers at 99.5th percentile
- Grouped high-cardinality categoricals — top 15 countries, top 20 agents

### 🤖 Models Compared

| Rank | Model | Test Accuracy | Test F1 | ROC-AUC | Overfit Gap |
|---|---|---|---|---|---|
| 🥇 | **XGBoost** ⭐ | 87.81% | 83.10% | 95.20% | 0.012 |
| 🥈 | Hist Gradient Boosting | 87.37% | 82.41% | 94.87% | 0.004 |
| 🥉 | Random Forest | 89.54% | 85.32% | 96.06% | 0.039 |
| 4 | Decision Tree | 85.88% | 80.42% | 93.00% | 0.017 |
| 5 | Logistic Regression | 82.16% | 73.74% | 90.32% | 0.007 |

> **Why XGBoost over Random Forest?**
> Random Forest achieved higher raw scores but showed clear overfitting — train accuracy of 99.59% vs test of 89.54% (gap of 0.039). XGBoost achieved nearly the same predictive performance while generalizing significantly better to unseen bookings, making it the preferred model for real-world deployment.

### ⚙️ Hyperparameter Tuning

`RandomizedSearchCV` with 30 iterations and 3-fold cross-validation applied to XGBoost:

| Parameter | Best Value |
|---|---|
| `n_estimators` | 300 |
| `max_depth` | 8 |
| `learning_rate` | 0.1443 |
| `subsample` | 0.7479 |
| `colsample_bytree` | 0.8404 |
| `min_child_weight` | 7 |
| `gamma` | 0.2655 |

### 🏆 Final Model Performance

| Metric | Base XGBoost | Tuned XGBoost |
|---|---|---|
| Test Accuracy | 87.81% | **88.5%** |
| Test F1 | 83.10% | **83.95%** |
| ROC-AUC | 95.20% | **95.64%** |
| Overfit Gap | 0.012 | 0.023 |

### 🚀 Deployment

- Model serialized with `pickle` and served via a **Flask REST API** (`/predict` endpoint)
- Exposed publicly via **ngrok** static domain tunnel
- `predict.html` sends booking features as JSON and displays:
  - Real-time cancellation probability (%)
  - Risk level — 🟢 Low / 🟡 Medium / 🔴 High
  - Staff recommendation based on risk
  - Key risk factor explanations
- Fully integrated into the Helton Hotel **admin panel** — hidden from regular guests, accessible only after secure login

### 🛠 Tech Stack

| Layer | Technology |
|---|---|
| ML | Python, scikit-learn, XGBoost, pandas, numpy |
| API | Flask, Flask-CORS |
| Tunnel | ngrok static domain |
| Frontend | HTML, CSS, JavaScript |
| Notebook | Jupyter |

---

## 📁 Project Structure

```
Helton-Hotel/
├── index.html              # Main booking platform
├── predict.html            # AI risk prediction page (admin only)
├── analytics.html          # Booking analytics dashboard (admin only)
├── confirm.html            # Booking confirmation page
├── cancel.html             # Self-serve cancellation page
└── api/
    ├── api.py              # Flask ML prediction API
    ├── model.pkl           # Trained Tuned XGBoost pipeline
    ├── model_meta.json     # Model leaderboard & metadata
    ├── bookings.js         # Booking creation & management
    ├── cancel.js           # Guest cancellation handler
    ├── availability.js     # Room availability checker
    ├── admin-login.js      # Admin authentication
    ├── verify-otp.js       # OTP verification
    ├── send-email.js       # Brevo email sender
    └── _kv.js              # Upstash Redis helper
```

---

## 🔑 Key Highlights

- ✅ End-to-end ML pipeline with proper leakage prevention at every stage
- ✅ Real production integration — not a standalone notebook, the model runs live inside a real hotel platform
- ✅ Bilingual platform serving both English and Arabic guests
- ✅ Serverless + Redis architecture with zero cold-start storage costs
- ✅ Admin-only AI tools hidden from regular guests, accessible only after secure login
- ✅ Full model comparison with overfitting analysis across 5 classifiers
- ✅ Hyperparameter tuning with RandomizedSearchCV (30 iterations × 3 folds = 90 fits)

---

## 👤 Author

**medx123X**
Built with 🖤 and a lot of PowerShell debugging

---

*Helton Hotel — One of the finest hotels in the Middle East*

---

## 🚀 Running the Project Locally

### Prerequisites

Make sure you have the following installed:

- [Python 3.9+](https://www.python.org/downloads/)
- [Node.js 18+](https://nodejs.org/)
- [Git](https://git-scm.com/)
- [ngrok](https://ngrok.com/download) (free account required)

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/medx123X/Helton-Hotel2.git
cd Helton-Hotel2
```

---

### Step 2 — Install Python Dependencies

```bash
cd api
python -m pip install flask flask-cors scikit-learn xgboost pandas numpy
```

---

### Step 3 — Retrain the Model (Required on First Run)

The `model.pkl` must be generated on your machine to match your local sklearn version. Make sure `hotel_bookings.csv` is inside the `api/` folder first.

> 📥 Download the dataset from [Kaggle — Hotel Booking Demand](https://www.kaggle.com/datasets/jessemostipak/hotel-booking-demand) and place `hotel_bookings.csv` inside the `api/` folder.

Then run:

```bash
python RetrainLocal.py
```

You should see:

```
sklearn version: x.x.x — saving model for THIS version
Training… (takes ~1-2 minutes)
Test Accuracy: 0.8848   AUC: 0.9562
✅ model.pkl saved with sklearn x.x.x
Now run: python api.py
```

> ⚠️ **Why retrain?** Python's `pickle` format is not cross-version compatible for scikit-learn models. Running this script generates a fresh `model.pkl` that matches your exact sklearn version, avoiding version mismatch errors.

---

### Step 4 — Set Up ngrok

1. Create a free account at [ngrok.com](https://ngrok.com)
2. Go to **Dashboard → Your Authtoken** and copy your token
3. Run:

```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

4. Go to **Dashboard → Domains** and claim your free static domain (e.g. `your-words.ngrok-free.app`)

---

### Step 5 — Update the API URL in predict.html

Open `predict.html` in the root folder and find line ~486:

```javascript
const API_URL = 'https://your-current-ngrok-url.ngrok-free.app/predict';
```

Replace it with your static ngrok domain:

```javascript
const API_URL = 'https://your-words.ngrok-free.app/predict';
```

---

### Step 6 — Set Up Environment Variables

The Vercel serverless functions need these environment variables. If running locally, create a `.env` file in the root:

```env
BREVO_KEY=your_brevo_api_key
HOTEL_EMAIL=your_hotel_email@gmail.com
OTP_SECRET=your_custom_secret
ADMIN_USER=your_admin_username
ADMIN_PASSWORD=your_admin_password
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

> Get a free Brevo key at [brevo.com](https://brevo.com) and a free Redis at [upstash.com](https://upstash.com)

---

### Step 7 — Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

Add all environment variables from Step 6 in your Vercel project dashboard under **Settings → Environment Variables**.

---

## 🔄 Startup Routine (Every Time You Restart)

Once everything is set up, here's all you need to run each session:

**Window 1 — Start Flask API:**
```bash
cd api
python -c "from api import app; app.run(host='127.0.0.1', port=5000, debug=False)"
```

You should see:
```
✅ Tuned XGBoost pipeline loaded — Accuracy: 88.4%  AUC: 0.956
 * Running on http://127.0.0.1:5000
```

**Window 2 — Start ngrok with your static domain:**
```bash
ngrok http 5000 --domain=your-words.ngrok-free.app
```

That's it — your live Helton site will now route predictions through your local Flask server via ngrok.

> ✅ If you set up a **static ngrok domain** (Step 4), the URL never changes so you never need to update `predict.html` again.

---

## 🧪 Testing the API

Once Flask and ngrok are running, verify everything works:

**Health check (paste in browser):**
```
http://localhost:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "model": "Tuned XGBoost",
  "accuracy": 0.8838,
  "auc": 0.9564
}
```

**On the live site:**
1. Go to your Vercel URL
2. Log in as admin
3. Click **⚡ Risk AI** in the nav
4. Fill in a booking and click **Assess Cancellation Risk**

**Quick sanity check — try these two extremes:**

| Test | Settings | Expected Result |
|---|---|---|
| 🔴 High Risk | Lead time: 400 days, Online TA, No deposit, 2 prior cancellations | 65%+ / Red |
| 🟢 Low Risk | Lead time: 5 days, Direct, Returning guest, 2 special requests | Under 35% / Green |

---

## ⚠️ Common Issues

| Error | Cause | Fix |
|---|---|---|
| `No module named 'flask'` | Wrong Python version running | Use `python -m pip install` instead of `pip install` |
| `_RemainderColsList` error | sklearn version mismatch | Run `python RetrainLocal.py` to rebuild model for your version |
| `Failed to fetch` in browser | ngrok not running or wrong URL | Start ngrok and verify `API_URL` in `predict.html` |
| `502 Bad Gateway` in ngrok | CORS preflight blocked | Restart ngrok with `--request-header-add "ngrok-skip-browser-warning: true"` |
| `0% or 100%` predictions | Old model.pkl loaded | Run `python RetrainLocal.py` and restart Flask |
| Admin login not working | Wrong credentials or browser autofill | Check Vercel env vars in incognito window |
