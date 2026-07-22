import json
import re
import time
import sys
from deep_translator import GoogleTranslator

# Traduction FR -> EN de en.json (couche BROUILLON pour les pages peu visibles).
# Ne touche QUE les stubs non traduits (valeur === cle) et PROTEGE marque, devise,
# emails, URLs, emoji, cles tres courtes et cles multi-lignes fragiles.
# Les traductions soignees a la main (valeur != cle) ne sont jamais ecrasees.

file_path = 'src/i18n/locales/en.json'

# Termes identiques FR/EN a ne jamais envoyer a Google.
PROTECTED = {
    'MiamExpress', 'Yamo', 'WhatsApp', 'MTN', 'MoMo', 'Orange Money', 'FCFA', 'FCFA.',
    'Douala', 'Yaoundé', 'Yaounde', 'Cameroun', 'GPS', 'SMS', 'OTP', 'Email', 'OK',
    'Premium', 'Pizza', 'Standard', 'Configuration', 'Options', 'Zones', 'Transactions',
    'Documents', 'Actions', 'km', 'min',
}

def should_translate(key, value):
    if value != key:
        return False                      # deja traduit (a la main) -> on garde
    k = key.strip()
    if len(k) <= 2:
        return False                      # trop court (symboles, initiales)
    if not re.search(r'[A-Za-zÀ-ÿ]', k):
        return False                      # pas de lettre (chiffres/symboles)
    if key in PROTECTED:
        return False
    if '@' in key or key.startswith('http'):
        return False                      # emails / URLs
    if '\n' in key or '\r' in key:
        return False                      # multi-lignes fragiles -> refactor source
    return True

def main():
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    todo = [k for k in data.keys() if should_translate(k, data[k])]
    protected_stubs = [k for k in data.keys() if data[k] == k and k not in todo]
    print(f"Cles totales: {len(data)} | a traduire: {len(todo)} | protegees/ignorees: {len(protected_stubs)}")
    if not todo:
        print("Rien a traduire.")
        return

    translator = GoogleTranslator(source='fr', target='en')
    chunk_size = 25
    done = 0
    for i in range(0, len(todo), chunk_size):
        chunk = todo[i:i + chunk_size]
        try:
            translations = translator.translate_batch(chunk)
            for key, tr in zip(chunk, translations):
                if tr and isinstance(tr, str) and tr.strip() and data[key] == key:
                    data[key] = tr
                    done += 1
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"  {min(i + chunk_size, len(todo))}/{len(todo)} (+{len(chunk)})")
            time.sleep(0.8)
        except Exception as e:
            print(f"  Erreur chunk {i}: {e}", file=sys.stderr)
            time.sleep(4)
            for key in chunk:
                try:
                    if data[key] == key:
                        tr = translator.translate(key)
                        if tr and tr.strip():
                            data[key] = tr
                            done += 1
                except Exception:
                    pass
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Termine ! {done} chaines traduites (brouillon).")

if __name__ == '__main__':
    main()
