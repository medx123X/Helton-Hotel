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



Overview

Helton Hotel is a full-stack luxury hotel management platform built from the ground up, combining a modern guest-facing booking experience with a machine learning system that predicts booking cancellation risk in real time.

The project is split into two tightly integrated parts:


Part 1 — Hotel Booking Platform

A complete hotel reservation system deployed on Vercel, built with vanilla HTML, CSS, and JavaScript on the frontend, and Node.js serverless functions on the backend.

✨ Features


🛎 Luxury multi-screen booking flow — guests enter personal details, choose room type and view, select services, and confirm their reservation
📧 OTP email verification via Brevo SMTP — guests verify their email before a booking is accepted
📅 Real-time availability checking — prevents double bookings by checking date conflicts before confirming
✉️ Automated confirmation emails sent to guests on booking with a unique reference code
❌ Self-serve cancellation — guests receive a signed cancellation link in their email valid for 1 year
🔐 Admin portal — hotel staff log in securely to view all bookings, cancel reservations, and trigger cancellation emails
🌐 Bilingual support — full Arabic and English interface with RTL layout switching
💾 Persistent storage via Upstash Redis — all bookings stored and retrieved in real time
📱 Fully responsive design built with a luxury dark gold aesthetic


🛠 Tech Stack

LayerTechnologyFrontendHTML, CSS, JavaScriptBackendNode.js Serverless Functions (Vercel)StorageUpstash Redis (REST API)EmailBrevo SMTP APIHostingVercel


Part 2 — AI Cancellation Risk Intelligence

A machine learning system that predicts the probability that any given hotel booking will be cancelled, giving hotel staff actionable intelligence before it happens.

📊 Dataset

Trained on the Hotel Booking Demand dataset — 119,390 real hotel bookings from two hotels (city and resort) covering 2015–2017, with 32 features including lead time, deposit type, market segment, guest history, room type, and pricing.

🔬 ML Pipeline

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

🧹 Data Cleaning


Removed leakage columns — reservation_status, reservation_status_date, assigned_room_type
Handled missing values — agent, country, children, company
Removed 180 invalid zero-guest bookings
Fixed 1 negative ADR value, capped outliers at 99.5th percentile
Grouped high-cardinality categoricals — top 15 countries, top 20 agents


🤖 Models Compared

RankModelTest AccuracyTest F1ROC-AUCOverfit Gap🥇XGBoost ⭐87.81%83.10%95.20%0.012🥈Hist Gradient Boosting87.37%82.41%94.87%0.004🥉Random Forest89.54%85.32%96.06%0.0394Decision Tree85.88%80.42%93.00%0.0175Logistic Regression82.16%73.74%90.32%0.007


Why XGBoost over Random Forest?
Random Forest achieved higher raw scores but showed clear overfitting — train accuracy of 99.59% vs test of 89.54% (gap of 0.039). XGBoost achieved nearly the same predictive performance while generalizing significantly better to unseen bookings, making it the preferred model for real-world deployment.



⚙️ Hyperparameter Tuning

RandomizedSearchCV with 30 iterations and 3-fold cross-validation applied to XGBoost:

ParameterBest Valuen_estimators300max_depth8learning_rate0.1443subsample0.7479colsample_bytree0.8404min_child_weight7gamma0.2655

🏆 Final Model Performance

MetricBase XGBoostTuned XGBoostTest Accuracy87.81%88.5%Test F183.10%83.95%ROC-AUC95.20%95.64%Overfit Gap0.0120.023

🚀 Deployment


Model serialized with pickle and served via a Flask REST API (/predict endpoint)
Exposed publicly via ngrok static domain tunnel
predict.html sends booking features as JSON and displays:

Real-time cancellation probability (%)
Risk level — 🟢 Low / 🟡 Medium / 🔴 High
Staff recommendation based on risk
Key risk factor explanations



Fully integrated into the Helton Hotel admin panel — hidden from regular guests, accessible only after secure login


🛠 Tech Stack

LayerTechnologyMLPython, scikit-learn, XGBoost, pandas, numpyAPIFlask, Flask-CORSTunnelngrok static domainFrontendHTML, CSS, JavaScriptNotebookJupyter


📁 Project Structure

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


🔑 Key Highlights


✅ End-to-end ML pipeline with proper leakage prevention at every stage
✅ Real production integration — not a standalone notebook, the model runs live inside a real hotel platform
✅ Bilingual platform serving both English and Arabic guests
✅ Serverless + Redis architecture with zero cold-start storage costs
✅ Admin-only AI tools hidden from regular guests, accessible only after secure login
✅ Full model comparison with overfitting analysis across 5 classifiers
✅ Hyperparameter tuning with RandomizedSearchCV (30 iterations × 3 folds = 90 fits)



👤 Author

medx123X
Built with 🖤 and a lot of PowerShell debugging


Helton Hotel — One of the finest hotels in the Middle East
Contenthotel_bookings.csvcsvmodel.pklpklsend-email.jsjsanalytics.htmlhtmlindex.htmlhtmlmodel.pklpklpredict.htmlhtmlindex.htmlhtmlindex.htmlhtmlbookings.js270 linesjscancel.js129 linesjsmodel_meta.json108 linesjsonadmin-login.js66 linesjs_kv.js60 linesjsavailability.js87 linesjsverify-otp.js87 linesjsapi.py166 linespyconfirm.html231 lineshtmlcancel.html320 lineshtmls) (1.17.0)

[notice] A new release of pip is available: 24.0 -> 26.1.2
[notice] To update, run: C:\Users\Asus\AppData\Local\Programs\Python\Python311\python.exe -m pip install --upgrade pip
Traceback (most recent call last):
  File "C:\Users\Asus\Desktop\Helton-Hotel2-tmp\api\api.py", line 7, pasted
