from flask import Flask, request, jsonify
import math

app = Flask(__name__)

def calculate_msc(monthly_salary):
    if monthly_salary < 4250:
        return 4000
    elif monthly_salary >= 29750:
        return 30000
    else:
        return math.round((monthly_salary - 250) / 500) * 500 + 500

@app.route('/api/calculate-sss', methods=['POST'])
def handle_sss_calculation():
    data = request.get_json() or {}
    salary = float(data.get('salary', 0))
    
    msc = calculate_msc(salary)
    ee_share = msc * 0.045  # 4.5% Employee share
    
    return jsonify({
        "sss_deduction": round(ee_share, 2)
    })


 
app.run(port=5000, debug=True)
