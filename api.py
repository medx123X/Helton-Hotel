"""
Helton Hotel — Prediction API (Real Model)
==========================================
Column order matches notebook pipeline exactly.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import pandas as pd
import os

app = Flask(__name__)
CORS(app)

BASE = os.path.dirname(__file__)

with open(os.path.join(BASE, 'model.pkl'), 'rb') as f:
    MODEL = pickle.load(f)

print("✅ Tuned XGBoost pipeline loaded — Accuracy: 88.4%  AUC: 0.956")

TOP_COUNTRIES = {
    'PRT','GBR','FRA','ESP','DEU','IRL','ITA','BEL','BRA',
    'NLD','USA','CHE','CN','AUT','NOR'
}

TOP_AGENTS = {
    '0','9','240','1','14','7','250','6','241','11',
    '23','28','3','40','177','103','210','134','38','153'
}

MONTH_MAP = {
    '1':'January','2':'February','3':'March','4':'April',
    '5':'May','6':'June','7':'July','8':'August',
    '9':'September','10':'October','11':'November','12':'December'
}

# Exact column order from notebook (X.columns.tolist())
ALL_COLS = [
    'hotel', 'lead_time', 'arrival_date_year', 'arrival_date_month',
    'arrival_date_week_number', 'arrival_date_day_of_month',
    'stays_in_weekend_nights', 'stays_in_week_nights',
    'adults', 'children', 'babies', 'meal', 'country',
    'market_segment', 'distribution_channel', 'is_repeated_guest',
    'previous_cancellations', 'previous_bookings_not_canceled',
    'reserved_room_type', 'booking_changes', 'deposit_type',
    'agent', 'days_in_waiting_list', 'customer_type', 'adr',
    'required_car_parking_spaces', 'total_of_special_requests',
    'total_guests', 'total_nights',
]

NUMERIC_COLS = [
    'lead_time', 'arrival_date_year', 'arrival_date_week_number',
    'arrival_date_day_of_month', 'stays_in_weekend_nights', 'stays_in_week_nights',
    'adults', 'children', 'babies', 'is_repeated_guest',
    'previous_cancellations', 'previous_bookings_not_canceled',
    'booking_changes', 'days_in_waiting_list', 'adr',
    'required_car_parking_spaces', 'total_of_special_requests',
    'total_guests', 'total_nights',
]

CATEGORICAL_COLS = [
    'hotel', 'arrival_date_month', 'meal', 'country',
    'market_segment', 'distribution_channel', 'reserved_room_type',
    'deposit_type', 'agent', 'customer_type',
]


def build_dataframe(data: dict) -> pd.DataFrame:
    adults   = int(data.get('adults', 2))
    children = float(data.get('children', 0))
    babies   = int(data.get('babies', 0))
    wkend    = int(data.get('stays_in_weekend_nights', 1))
    wkday    = int(data.get('stays_in_week_nights', 2))

    country = str(data.get('country', 'PRT')).upper().strip()
    if country not in TOP_COUNTRIES:
        country = 'Other'

    month_raw = str(data.get('arrival_date_month', '7'))
    month = MONTH_MAP.get(month_raw, month_raw)

    agent = str(data.get('agent', '0'))
    if agent not in TOP_AGENTS:
        agent = '-1'

    row = {
        'hotel':                          str(data.get('hotel', 'City Hotel')),
        'lead_time':                      int(data.get('lead_time', 60)),
        'arrival_date_year':              2017,
        'arrival_date_month':             month,
        'arrival_date_week_number':       int(data.get('arrival_date_week_number', 27)),
        'arrival_date_day_of_month':      int(data.get('arrival_date_day_of_month', 15)),
        'stays_in_weekend_nights':        wkend,
        'stays_in_week_nights':           wkday,
        'adults':                         adults,
        'children':                       children,
        'babies':                         babies,
        'meal':                           str(data.get('meal', 'BB')),
        'country':                        country,
        'market_segment':                 str(data.get('market_segment', 'Direct')),
        'distribution_channel':           str(data.get('distribution_channel', 'Direct')),
        'is_repeated_guest':              int(data.get('is_repeated_guest', 0)),
        'previous_cancellations':         int(data.get('previous_cancellations', 0)),
        'previous_bookings_not_canceled': int(data.get('previous_bookings_not_canceled', 0)),
        'reserved_room_type':             str(data.get('reserved_room_type', 'A')),
        'booking_changes':                int(data.get('booking_changes', 0)),
        'deposit_type':                   str(data.get('deposit_type', 'No Deposit')),
        'agent':                          agent,
        'days_in_waiting_list':           int(data.get('days_in_waiting_list', 0)),
        'customer_type':                  str(data.get('customer_type', 'Transient')),
        'adr':                            float(data.get('adr', 100)),
        'required_car_parking_spaces':    int(data.get('required_car_parking_spaces', 0)),
        'total_of_special_requests':      int(data.get('total_of_special_requests', 0)),
        'total_guests':                   adults + children + babies,
        'total_nights':                   wkend + wkday,
    }

    df = pd.DataFrame([row])

    # enforce dtypes
    for col in NUMERIC_COLS:
        df[col] = pd.to_numeric(df[col])
    for col in CATEGORICAL_COLS:
        df[col] = df[col].astype(str)

    # return in exact column order pipeline was fit on
    return df[ALL_COLS]


@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json(force=True)
        df   = build_dataframe(data)
        prob = float(MODEL.predict_proba(df)[0][1])

        if prob < 0.35:
            risk_level = 'low'
        elif prob < 0.65:
            risk_level = 'medium'
        else:
            risk_level = 'high'

        return jsonify({
            'cancellation_probability': round(prob, 4),
            'risk_pct':   round(prob * 100, 1),
            'risk_level': risk_level,
            'model': 'Tuned XGBoost',
            'model_accuracy': 0.8838,
            'model_auc': 0.9564,
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status':'ok','model':'Tuned XGBoost','accuracy':0.8838,'auc':0.9564})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
