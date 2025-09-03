import requests
from PIL import Image
from io import BytesIO
import numpy as np
from tensorflow.keras.applications.mobilenet import MobileNet, preprocess_input, decode_predictions

# Load pre-trained MobileNet model
model = MobileNet(weights='imagenet')

# Your Node.js backend API with API key
BACKEND_URL = "https://telegram-backend-r80h.onrender.com/api/files"
API_KEY = "b7f8a3c9d2e1f0b6a4c5d8e9f1a2b3c4"

def fetch_wallpaper_urls():
    headers = {"x-api-key": API_KEY}
    response = requests.get(BACKEND_URL, headers=headers)
    response.raise_for_status()
    data = response.json()
    if data.get("success"):
        return [file["directLink"] for file in data["files"]]
    return []

def categorize_image(image_url):
    try:
        response = requests.get(image_url)
        img = Image.open(BytesIO(response.content)).convert('RGB')
        img = img.resize((224, 224))
        
        x = np.array(img)
        x = np.expand_dims(x, axis=0)
        x = preprocess_input(x)

        preds = model.predict(x)
        decoded = decode_predictions(preds, top=1)[0]
        category = decoded[0][1]  # e.g., 'mountain', 'beach', 'car'
        return category
    except Exception as e:
        print(f"Error categorizing {image_url}: {e}")
        return "Unknown"

def main():
    urls = fetch_wallpaper_urls()
    categorized = []

    for url in urls:
        category = categorize_image(url)
        print(f"URL: {url}\nCategory: {category}\n")
        categorized.append({"url": url, "category": category})

    return categorized

if __name__ == "__main__":
    main()