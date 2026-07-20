import json
import time
from deep_translator import GoogleTranslator

file_path = 'src/i18n/locales/en.json'

with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

translator = GoogleTranslator(source='fr', target='en')

keys = list(data.keys())
total = len(keys)
print(f"Translating {total} strings...")

chunk_size = 30
for i in range(0, total, chunk_size):
    chunk = keys[i:i+chunk_size]
    print(f"Processing chunk {i} to {i+chunk_size}...")
    
    try:
        translations = translator.translate_batch(chunk)
        for idx, key in enumerate(chunk):
            # Only update if the string is still in French (we check if they are identical, though some might naturally be)
            if data[key] == key:
                data[key] = translations[idx]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        time.sleep(1)
    except Exception as e:
        print(f"Error on chunk {i}: {e}")
        time.sleep(5)
        for key in chunk:
            try:
                if data[key] == key:
                    data[key] = translator.translate(key)
            except:
                pass

print("Translation completed!")
