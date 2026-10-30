import requests
import json
import os

API_URL = "http://127.0.0.1:8000/api/analyze"
IMAGE_PATH = r"d:\Carbon-emission-Calculator\frontend\assets\logo.svg"

def test_api():
    print(f"1. Checking if test image exists at {IMAGE_PATH}...")
    if not os.path.exists(IMAGE_PATH):
        print(f"Error: {IMAGE_PATH} not found.")
        return

    print("2. Sending POST request to backend API (image + 2.5 kg)...")
    try:
        with open(IMAGE_PATH, "rb") as img_file:
            files = {"image": ("test_logo.png", img_file, "image/png")}
            data = {"weight": "2.5", "unit": "kg"}
            response = requests.post(API_URL, files=files, data=data)

        print(f"\nResponse Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print("\n" + "="*50)
            print(" SUCCESS! LIVE BACKEND & DB RESPONSE:")
            print("="*50)
            print(f"  • Classified Material  : {result.get('material')}")
            print(f"  • Confidence Score     : {result.get('confidence') * 100:.1f}%")
            print(f"  • Input Weight         : {result.get('weightInput')} {result.get('inputUnit')}")
            print(f"  • Converted Weight     : {result.get('weightGrams')} grams")
            print(f"  • Avg Emission Factor  : {result.get('emissionFactor')}")
            print(f"  • Calculated CO2e      : {result.get('emissionOutput')}")
            print(f"  • Coins Awarded        : +{result.get('coinsAwarded')} coins")
            print(f"  • Current Wallet Total : {result.get('walletCoins')} coins")
            print(f"  • Daily Streak Count   : Day {result.get('currentStreak')}")
            print("="*50)
        else:
            print("Error response from server:")
            print(response.text)
    except Exception as e:
        print(f"\nCould not connect to backend: {e}")
        print("Make sure your backend server is running in another terminal window:")
        print("  cd d:\\Carbon-emission-Calculator\\backend")
        print("  python -m uvicorn app.main:app --reload --port 8000")

if __name__ == "__main__":
    test_api()
